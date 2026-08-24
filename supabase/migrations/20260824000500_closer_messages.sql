-- Closer — outreach drafts, and the gate a human has to open.
--
-- Everything before this migration reads. This is the first thing Closer writes
-- that leaves the building, so it is the first that can do harm, and the shape
-- of the table is mostly a list of ways it must not.
--
-- Two facts about this repository decided the design, and neither is a
-- limitation to be worked around:
--
--   1. **Nothing here can send an email.** There is no provider dependency in
--      any package. So `sent` is not something the system does; it is something
--      an operator records after sending it themselves. A `closer_send_message`
--      that quietly wrote `sent` without a message leaving would be the exact
--      button-that-pretends-to-work the brief forbids.
--
--   2. **An agent has no `auth.uid()`.** Approval is therefore not a column an
--      agent could set with the right argument — it reads the caller's identity
--      and refuses when there is none. That is what makes "a human approved
--      this" a property of the database rather than a promise made by the UI.

/* ------------------------------------------------------------------ *
 * States
 * ------------------------------------------------------------------ */

/*
 * There is no `draft` member, deliberately.
 *
 * A draft nobody has to approve is precisely the dangerous object, and a state
 * whose only occupant is "the agent is still typing" buys nothing: the row is
 * written once, complete. Every message therefore enters the world already
 * waiting on a person.
 */
create type public.closer_message_state as enum (
  'pending_approval',
  'approved',
  'rejected',
  'sent'
);

-- The two channels outreach actually uses. Both are copy-and-send by hand
-- here; the enum records which one a draft was written *for*, because a
-- LinkedIn note and an email are not the same text.
create type public.closer_message_channel as enum (
  'email',
  'linkedin'
);

/* ------------------------------------------------------------------ *
 * Messages
 * ------------------------------------------------------------------ */

create table public.closer_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  lead_id uuid not null references public.closer_leads (id) on delete cascade,
  /*
   * Not nullable. Outreach addressed to nobody is not a draft, it is a
   * template, and a template is what this system exists to avoid producing.
   */
  contact_id uuid not null references public.closer_contacts (id) on delete cascade,
  channel public.closer_message_channel not null,
  state public.closer_message_state not null default 'pending_approval',

  subject text check (subject is null or length(trim(subject)) between 1 and 200),
  body text not null check (length(trim(body)) between 1 and 5000),

  /*
   * The evidence this text claims to be personalised from.
   *
   * Non-empty, and `closer_draft_message` checks that every id belongs to the
   * same company — so "grounded" is a property something verified rather than a
   * word in a comment. A draft that cites nothing is a mail merge, and the
   * whole difference between this and a mail merge is that a reader can follow
   * each claim back to an observation with a URL and a date.
   */
  grounded_in uuid[] not null check (coalesce(array_length(grounded_in, 1), 0) >= 1),

  -- Which model wrote it, kept beside the text so a bad batch is traceable to
  -- a prompt rather than to a vibe.
  model text,
  ai_execution_id uuid references public.closer_ai_executions (id) on delete set null,

  created_at timestamptz not null default now(),

  -- A person changed the words before approving. The common case, and worth
  -- distinguishing from approving what the model wrote unaltered.
  edited_by uuid references auth.users (id) on delete set null,
  edited_at timestamptz,

  approved_by uuid references auth.users (id) on delete set null,
  approved_at timestamptz,

  rejected_by uuid references auth.users (id) on delete set null,
  rejected_at timestamptz,
  rejection_reason text check (rejection_reason is null or length(trim(rejection_reason)) between 1 and 500),

  -- Recorded by the person who sent it. See the header: the system does not
  -- send, so this is a log entry about the world, not a receipt for an action.
  sent_by uuid references auth.users (id) on delete set null,
  sent_at timestamptz,

  /*
   * The states carry their evidence or they are not reachable.
   *
   * Written as one check per state rather than a trigger so that the constraint
   * is visible beside the columns it constrains.
   */
  constraint closer_messages_approved_has_approver check (
    state <> 'approved' or (approved_by is not null and approved_at is not null)
  ),
  constraint closer_messages_rejected_has_reason check (
    state <> 'rejected' or (rejected_by is not null and rejection_reason is not null)
  ),
  constraint closer_messages_sent_was_approved check (
    state <> 'sent' or (approved_by is not null and sent_by is not null and sent_at is not null)
  ),
  -- An email needs a subject; a LinkedIn note does not have one.
  constraint closer_messages_email_has_subject check (
    channel <> 'email' or subject is not null
  )
);

create index closer_messages_queue_idx
  on public.closer_messages (organization_id, state, created_at desc);
create index closer_messages_lead_idx on public.closer_messages (lead_id, created_at desc);

alter table public.closer_messages enable row level security;

create policy closer_messages_select on public.closer_messages
  for select using (public.is_org_member(organization_id));

/* ------------------------------------------------------------------ *
 * Writing a draft
 * ------------------------------------------------------------------ */

/*
 * The checks below run before a draft exists rather than before it is sent,
 * because a suppressed contact sitting in an approval queue is already a
 * mistake waiting for a tired reviewer.
 */
create or replace function public.closer_draft_message(
  p_lead_id uuid,
  p_contact_id uuid,
  p_channel public.closer_message_channel,
  p_body text,
  p_grounded_in uuid[],
  p_subject text default null,
  p_model text default null,
  p_ai_execution_id uuid default null
)
returns public.closer_messages
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  lead public.closer_leads;
  contact public.closer_contacts;
  company public.closer_companies;
  ungrounded int;
  result public.closer_messages;
begin
  select * into lead from public.closer_leads where id = p_lead_id;
  if lead is null then
    raise exception 'no such lead' using errcode = 'P0002';
  end if;

  if not public.is_org_member(lead.organization_id) then
    raise exception 'not a member of this workspace' using errcode = '42501';
  end if;

  -- A lead somebody has asked not to be contacted is not a lead to write to.
  if lead.stage = 'do_not_contact' then
    raise exception 'this lead is marked do_not_contact' using errcode = '42501';
  end if;

  select * into contact from public.closer_contacts where id = p_contact_id;
  if contact is null or contact.company_id <> lead.company_id then
    raise exception 'contact belongs to a different company than this lead'
      using errcode = '22023';
  end if;

  select * into company from public.closer_companies where id = lead.company_id;

  if public.closer_is_suppressed(lead.organization_id, company.domain, contact.email) then
    raise exception 'this company or address is suppressed' using errcode = '42501';
  end if;

  /*
   * Every cited id must be evidence of this company.
   *
   * Without this the column is decoration: an agent could cite three ids it
   * invented, or three real ones belonging to somebody else, and the approval
   * screen would show a personalised message beside evidence that has nothing
   * to do with it. Counting the misses rather than testing containment, so the
   * error can say how many.
   */
  select count(*) into ungrounded
  from unnest(p_grounded_in) as cited(id)
  where not exists (
    select 1 from public.closer_evidence e
    where e.id = cited.id and e.company_id = lead.company_id
  );

  if ungrounded > 0 then
    raise exception '% cited evidence row(s) do not belong to this company', ungrounded
      using errcode = '22023';
  end if;

  insert into public.closer_messages
    (organization_id, lead_id, contact_id, channel, subject, body,
     grounded_in, model, ai_execution_id)
  values
    (lead.organization_id, p_lead_id, p_contact_id, p_channel, p_subject, p_body,
     p_grounded_in, p_model, p_ai_execution_id)
  returning * into result;

  return result;
end;
$$;

/* ------------------------------------------------------------------ *
 * Editing, before approval only
 * ------------------------------------------------------------------ */

create or replace function public.closer_revise_message(
  p_message_id uuid,
  p_body text,
  p_subject text default null
)
returns public.closer_messages
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  message public.closer_messages;
  result public.closer_messages;
begin
  select * into message from public.closer_messages where id = p_message_id;
  if message is null then
    raise exception 'no such message' using errcode = 'P0002';
  end if;
  if not public.is_org_member(message.organization_id) then
    raise exception 'not a member of this workspace' using errcode = '42501';
  end if;

  -- Editing an approved message would make the approval a signature on a
  -- document that no longer exists.
  if message.state <> 'pending_approval' then
    raise exception 'only a message awaiting approval can be revised (state: %)', message.state
      using errcode = '22023';
  end if;

  if auth.uid() is null then
    raise exception 'revision requires a signed-in person' using errcode = '42501';
  end if;

  update public.closer_messages
     set body = p_body,
         subject = coalesce(p_subject, subject),
         edited_by = auth.uid(),
         edited_at = now()
   where id = p_message_id
  returning * into result;

  return result;
end;
$$;

/* ------------------------------------------------------------------ *
 * Approval — the gate
 * ------------------------------------------------------------------ */

/*
 * Two limits are enforced here rather than in the interface, because a limit
 * the client applies is a limit the next client forgets.
 *
 * The daily cap makes a blast impossible: twenty approvals in a workspace per
 * day is more outreach than one person writes by hand and far less than a
 * campaign. The per-company cooldown is the one that matters more — it stops
 * the same company being written to twice in a fortnight, which is the
 * difference between persistence and harassment, and no daily cap catches it.
 */
create or replace function public.closer_approve_message(p_message_id uuid)
returns public.closer_messages
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  message public.closer_messages;
  contact public.closer_contacts;
  company public.closer_companies;
  lead public.closer_leads;
  approved_today int;
  recent_to_company int;
  result public.closer_messages;
begin
  select * into message from public.closer_messages where id = p_message_id;
  if message is null then
    raise exception 'no such message' using errcode = 'P0002';
  end if;
  if not public.is_org_member(message.organization_id) then
    raise exception 'not a member of this workspace' using errcode = '42501';
  end if;

  /*
   * The whole point of the function. An agent holds a service token and has no
   * `auth.uid()`, so it cannot reach past this line however it calls in.
   */
  if auth.uid() is null then
    raise exception 'approval requires a signed-in person' using errcode = '42501';
  end if;

  if message.state <> 'pending_approval' then
    raise exception 'message is not awaiting approval (state: %)', message.state
      using errcode = '22023';
  end if;

  select * into lead from public.closer_leads where id = message.lead_id;
  select * into contact from public.closer_contacts where id = message.contact_id;
  select * into company from public.closer_companies where id = lead.company_id;

  -- Re-checked at approval, not only at drafting: an opt-out that arrives
  -- while a draft sits in the queue is exactly the case a single check misses.
  if public.closer_is_suppressed(message.organization_id, company.domain, contact.email) then
    raise exception 'this company or address is suppressed' using errcode = '42501';
  end if;

  if lead.stage = 'do_not_contact' then
    raise exception 'this lead is marked do_not_contact' using errcode = '42501';
  end if;

  select count(*) into approved_today
  from public.closer_messages m
  where m.organization_id = message.organization_id
    and m.approved_at > now() - interval '24 hours';

  if approved_today >= 20 then
    raise exception 'daily approval limit reached (20 in 24 hours)' using errcode = '54000';
  end if;

  select count(*) into recent_to_company
  from public.closer_messages m
  join public.closer_leads l on l.id = m.lead_id
  where l.company_id = lead.company_id
    and m.approved_at > now() - interval '14 days';

  if recent_to_company >= 1 then
    raise exception 'this company was already approached in the last 14 days'
      using errcode = '54000';
  end if;

  update public.closer_messages
     set state = 'approved',
         approved_by = auth.uid(),
         approved_at = now()
   where id = p_message_id
  returning * into result;

  return result;
end;
$$;

create or replace function public.closer_reject_message(
  p_message_id uuid,
  p_reason text
)
returns public.closer_messages
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  message public.closer_messages;
  result public.closer_messages;
begin
  select * into message from public.closer_messages where id = p_message_id;
  if message is null then
    raise exception 'no such message' using errcode = 'P0002';
  end if;
  if not public.is_org_member(message.organization_id) then
    raise exception 'not a member of this workspace' using errcode = '42501';
  end if;
  if auth.uid() is null then
    raise exception 'rejection requires a signed-in person' using errcode = '42501';
  end if;
  if message.state <> 'pending_approval' then
    raise exception 'message is not awaiting approval (state: %)', message.state
      using errcode = '22023';
  end if;

  /*
   * A reason is required because rejections are the only feedback this system
   * gets. "Too long", "the claim about their locale count is wrong" and "wrong
   * person" are three different failures, and a queue of bare rejections cannot
   * tell them apart.
   */
  update public.closer_messages
     set state = 'rejected',
         rejected_by = auth.uid(),
         rejected_at = now(),
         rejection_reason = p_reason
   where id = p_message_id
  returning * into result;

  return result;
end;
$$;

/* ------------------------------------------------------------------ *
 * Recording that a person sent it
 * ------------------------------------------------------------------ */

/*
 * Named `mark_sent` and not `send`, because this repository cannot send.
 *
 * It writes down that somebody pasted the approved text into their mail client
 * and pressed send. If a provider is ever integrated, the honest change is a
 * second function that sends and then calls this one — not a rename of this.
 */
create or replace function public.closer_mark_message_sent(p_message_id uuid)
returns public.closer_messages
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  message public.closer_messages;
  result public.closer_messages;
begin
  select * into message from public.closer_messages where id = p_message_id;
  if message is null then
    raise exception 'no such message' using errcode = 'P0002';
  end if;
  if not public.is_org_member(message.organization_id) then
    raise exception 'not a member of this workspace' using errcode = '42501';
  end if;
  if auth.uid() is null then
    raise exception 'only a signed-in person can record a send' using errcode = '42501';
  end if;
  if message.state <> 'approved' then
    raise exception 'only an approved message can be recorded as sent (state: %)', message.state
      using errcode = '22023';
  end if;

  update public.closer_messages
     set state = 'sent',
         sent_by = auth.uid(),
         sent_at = now()
   where id = p_message_id
  returning * into result;

  return result;
end;
$$;

revoke execute on function public.closer_draft_message(uuid, uuid, public.closer_message_channel, text, uuid[], text, text, uuid) from public, anon;
revoke execute on function public.closer_revise_message(uuid, text, text) from public, anon;
revoke execute on function public.closer_approve_message(uuid) from public, anon;
revoke execute on function public.closer_reject_message(uuid, text) from public, anon;
revoke execute on function public.closer_mark_message_sent(uuid) from public, anon;

grant execute on function public.closer_draft_message(uuid, uuid, public.closer_message_channel, text, uuid[], text, text, uuid) to authenticated;
grant execute on function public.closer_revise_message(uuid, text, text) to authenticated;
grant execute on function public.closer_approve_message(uuid) to authenticated;
grant execute on function public.closer_reject_message(uuid, text) to authenticated;
grant execute on function public.closer_mark_message_sent(uuid) to authenticated;
