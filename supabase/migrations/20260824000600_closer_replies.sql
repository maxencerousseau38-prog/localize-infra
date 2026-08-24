-- Closer — what came back, and what was done about it.
--
-- The mirror of the previous migration, and it has the same shape for the same
-- reason. Nothing here can send an email; nothing here can receive one either.
-- There is no inbox integration, no webhook, no IMAP client. So a reply enters
-- the system the only honest way it can: a person pastes it in, and the row
-- records who did.
--
-- That is not a placeholder for a mailbox connector. It changes what the table
-- means: `recorded_by` is never null, `received_at` is a fact the operator
-- asserts rather than a header the system parsed, and a reply that nobody
-- pasted does not exist. If a connector is ever added, it adds a second path
-- into this table — it does not make this one dishonest in retrospect.

create type public.closer_reply_intent as enum (
  'interested',
  'question',
  'not_now',
  'not_a_fit',
  'opt_out',
  'referral',
  'auto_reply',
  'bounce',
  'unclear'
);

create table public.closer_replies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  /*
   * The message this answers.
   *
   * Not nullable, and `closer_record_reply` additionally requires that message
   * to be in `sent`. A reply to something never sent is not a reply — it is
   * either a mistake or an attempt to write history, and both are worth
   * refusing at the door.
   */
  message_id uuid not null references public.closer_messages (id) on delete cascade,
  lead_id uuid not null references public.closer_leads (id) on delete cascade,
  contact_id uuid not null references public.closer_contacts (id) on delete cascade,

  body text not null check (length(trim(body)) between 1 and 20000),
  received_at timestamptz not null,

  -- Who pasted it in. Never null: see the header.
  recorded_by uuid not null references auth.users (id) on delete restrict,

  /*
   * What the classifier said, and what the person said.
   *
   * Kept as two columns rather than one that gets overwritten, because the
   * difference between them is the only training signal this system produces.
   * Collapsing them would make "how often is the classifier right" a question
   * the database cannot answer, and that question is the whole of the learning
   * loop.
   */
  model_intent public.closer_reply_intent,
  model_confidence numeric(4, 3) check (
    model_confidence is null or (model_confidence >= 0 and model_confidence <= 1)
  ),
  model_evidence text,
  model_id text,
  classified_at timestamptz,

  operator_intent public.closer_reply_intent,
  operator_intent_by uuid references auth.users (id) on delete set null,
  operator_intent_at timestamptz,

  /*
   * The deterministic opt-out detector's verdict, kept beside the model's.
   *
   * Recorded even when the classifier agrees, because the point of the
   * detector is that it does not depend on the classifier. A suppression
   * traced back to this column can be explained by pointing at the phrase; one
   * traced only to a classification can be explained by pointing at a model.
   */
  opt_out_phrase text,
  opt_out_excerpt text,

  created_at timestamptz not null default now(),

  constraint closer_replies_classified_has_intent check (
    (classified_at is null) = (model_intent is null)
  ),
  constraint closer_replies_confirmed_has_actor check (
    operator_intent is null
      or (operator_intent_by is not null and operator_intent_at is not null)
  ),
  -- A reply cannot arrive before the message it answers was written. Cheap, and
  -- the only guard against a typo in a date somebody enters by hand.
  constraint closer_replies_not_in_the_future check (received_at <= now() + interval '1 day')
);

create index closer_replies_queue_idx
  on public.closer_replies (organization_id, operator_intent, received_at desc);
create index closer_replies_lead_idx on public.closer_replies (lead_id, received_at desc);

alter table public.closer_replies enable row level security;

create policy closer_replies_select on public.closer_replies
  for select using (public.is_org_member(organization_id));

/* ------------------------------------------------------------------ *
 * Recording one
 * ------------------------------------------------------------------ */

create or replace function public.closer_record_reply(
  p_message_id uuid,
  p_body text,
  p_received_at timestamptz default now(),
  p_opt_out_phrase text default null,
  p_opt_out_excerpt text default null
)
returns public.closer_replies
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  message public.closer_messages;
  result public.closer_replies;
begin
  select * into message from public.closer_messages where id = p_message_id;
  if message is null then
    raise exception 'no such message' using errcode = 'P0002';
  end if;
  if not public.is_org_member(message.organization_id) then
    raise exception 'not a member of this workspace' using errcode = '42501';
  end if;

  -- See the header: a reply is something a person transcribes.
  if auth.uid() is null then
    raise exception 'a reply is recorded by the person who received it' using errcode = '42501';
  end if;

  if message.state <> 'sent' then
    raise exception 'that message was never sent (state: %), so nothing can have answered it', message.state
      using errcode = '22023';
  end if;

  insert into public.closer_replies
    (organization_id, message_id, lead_id, contact_id, body, received_at,
     recorded_by, opt_out_phrase, opt_out_excerpt)
  values
    (message.organization_id, message.id, message.lead_id, message.contact_id,
     p_body, p_received_at, auth.uid(), p_opt_out_phrase, p_opt_out_excerpt)
  returning * into result;

  return result;
end;
$$;

/* ------------------------------------------------------------------ *
 * Classifying, and confirming
 * ------------------------------------------------------------------ */

create or replace function public.closer_classify_reply(
  p_reply_id uuid,
  p_intent public.closer_reply_intent,
  p_confidence numeric,
  p_evidence text,
  p_model text
)
returns public.closer_replies
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  reply public.closer_replies;
  result public.closer_replies;
begin
  select * into reply from public.closer_replies where id = p_reply_id;
  if reply is null then
    raise exception 'no such reply' using errcode = 'P0002';
  end if;
  if not public.is_org_member(reply.organization_id) then
    raise exception 'not a member of this workspace' using errcode = '42501';
  end if;

  /*
   * Deliberately not requiring `auth.uid()`, unlike everything a person is
   * accountable for. Classifying is a machine reading a message; it changes no
   * stage, contacts nobody, and is superseded by `operator_intent` the moment a
   * person disagrees. The gate belongs on the actions that follow, not here.
   */
  update public.closer_replies
     set model_intent = p_intent,
         model_confidence = p_confidence,
         model_evidence = p_evidence,
         model_id = p_model,
         classified_at = now()
   where id = p_reply_id
  returning * into result;

  return result;
end;
$$;

create or replace function public.closer_confirm_reply_intent(
  p_reply_id uuid,
  p_intent public.closer_reply_intent
)
returns public.closer_replies
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  reply public.closer_replies;
  result public.closer_replies;
begin
  select * into reply from public.closer_replies where id = p_reply_id;
  if reply is null then
    raise exception 'no such reply' using errcode = 'P0002';
  end if;
  if not public.is_org_member(reply.organization_id) then
    raise exception 'not a member of this workspace' using errcode = '42501';
  end if;
  if auth.uid() is null then
    raise exception 'confirming an intent requires a signed-in person' using errcode = '42501';
  end if;

  update public.closer_replies
     set operator_intent = p_intent,
         operator_intent_by = auth.uid(),
         operator_intent_at = now()
   where id = p_reply_id
  returning * into result;

  return result;
end;
$$;

revoke execute on function public.closer_record_reply(uuid, text, timestamptz, text, text) from public, anon;
revoke execute on function public.closer_classify_reply(uuid, public.closer_reply_intent, numeric, text, text) from public, anon;
revoke execute on function public.closer_confirm_reply_intent(uuid, public.closer_reply_intent) from public, anon;

grant execute on function public.closer_record_reply(uuid, text, timestamptz, text, text) to authenticated;
grant execute on function public.closer_classify_reply(uuid, public.closer_reply_intent, numeric, text, text) to authenticated;
grant execute on function public.closer_confirm_reply_intent(uuid, public.closer_reply_intent) to authenticated;
