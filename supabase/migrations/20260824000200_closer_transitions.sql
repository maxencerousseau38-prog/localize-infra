-- Closer — the state machine, and the only doors into the tables.
--
-- The funnel is enforced here rather than in TypeScript. An agent that can set
-- `stage` to anything is a funnel that records nothing, and the brief's rule —
-- "do NOT allow every agent to freely mutate everything" — is a property of the
-- database or it is a convention somebody will forget under deadline.

/* ------------------------------------------------------------------ *
 * The allowed edges, as data.
 * ------------------------------------------------------------------ */

/*
 * A table rather than a CASE expression.
 *
 * Three things follow from that choice and none of them from the alternative:
 * the graph can be queried ("what can this lead do next?" is the UI's question
 * and it is a SELECT), a forbidden transition is a row that is absent rather
 * than a branch somebody forgot to write, and the whole machine is testable
 * from SQL without executing a transition.
 */
create table public.closer_stage_transitions (
  from_stage public.closer_stage not null,
  to_stage public.closer_stage not null,
  note text not null,
  primary key (from_stage, to_stage)
);

alter table public.closer_stage_transitions enable row level security;

-- Readable by any authenticated user: it is the shape of the funnel, not data
-- about anybody. The UI needs it to know which moves to offer.
create policy closer_stage_transitions_select on public.closer_stage_transitions
  for select to authenticated using (true);

-- The forward chain.
insert into public.closer_stage_transitions (from_stage, to_stage, note) values
  ('discovered', 'researching', 'Research begins'),
  ('researching', 'qualified', 'Evidence supports a fit'),
  ('qualified', 'ready_for_outreach', 'A contact and an angle exist'),
  ('ready_for_outreach', 'outreach_approved', 'A human approved the draft'),
  ('outreach_approved', 'contacted', 'The message left'),
  ('contacted', 'replied', 'They answered'),
  ('replied', 'interested', 'The answer was positive'),
  ('interested', 'qualified_opportunity', 'Budget, need or timing confirmed'),
  ('qualified_opportunity', 'meeting_requested', 'A meeting was proposed'),
  ('meeting_requested', 'meeting_booked', 'A time is in the calendar'),
  ('meeting_booked', 'trial', 'They are using it'),
  ('trial', 'negotiation', 'Terms are being discussed'),
  ('negotiation', 'won', 'They are a customer');

-- Legitimate shortcuts. A funnel that forbids skipping a step is a funnel
-- people work around by lying about the step.
insert into public.closer_stage_transitions (from_stage, to_stage, note) values
  ('interested', 'meeting_requested', 'Straight to a meeting'),
  ('meeting_booked', 'negotiation', 'No trial needed'),
  ('trial', 'won', 'Closed without a negotiation phase'),
  ('replied', 'qualified_opportunity', 'The first reply was already a buying question');

-- Rework. Research that turns out thin, or a lead promoted too early.
insert into public.closer_stage_transitions (from_stage, to_stage, note) values
  ('qualified', 'researching', 'Sent back for more evidence'),
  ('ready_for_outreach', 'qualified', 'The angle did not hold up'),
  ('outreach_approved', 'ready_for_outreach', 'Approval withdrawn before sending');

/*
 * Coming back from "not now".
 *
 * The only re-entry into the funnel from a terminal state, and it re-enters at
 * `ready_for_outreach` rather than at the top: the research is not stale
 * because a quarter passed, and making somebody redo it is how a system
 * teaches its operator to lie about stages.
 */
insert into public.closer_stage_transitions (from_stage, to_stage, note) values
  ('not_now', 'ready_for_outreach', 'The agreed time arrived');

/*
 * Terminal edges, generated from the enum.
 *
 * Written as selects rather than a hundred literals so that adding a stage
 * later cannot silently leave it unable to reach a terminal state — the most
 * likely way a lead gets stuck somewhere forever.
 */

-- Do-not-contact is reachable from everywhere and is absorbing. It has no
-- outgoing edge, which is what makes it mean what it says.
insert into public.closer_stage_transitions (from_stage, to_stage, note)
select s, 'do_not_contact', 'Suppressed — absorbing, no way out'
from unnest(enum_range(null::public.closer_stage)) s
where s <> 'do_not_contact';

-- Not a fit: available until somebody has shown interest. After that the
-- honest terminal is `lost`, which records that there was something to lose.
insert into public.closer_stage_transitions (from_stage, to_stage, note)
select s, 'not_a_fit', 'Evidence does not support a fit'
from unnest(enum_range(null::public.closer_stage)) s
where s in ('discovered', 'researching', 'qualified', 'ready_for_outreach',
            'outreach_approved', 'contacted', 'replied');

-- Not now: only meaningful once there is somebody to say it.
insert into public.closer_stage_transitions (from_stage, to_stage, note)
select s, 'not_now', 'They asked to be approached later'
from unnest(enum_range(null::public.closer_stage)) s
where s in ('contacted', 'replied', 'interested', 'qualified_opportunity',
            'meeting_requested', 'meeting_booked');

-- Unresponsive: reachable only from `contacted`. A lead that replied and then
-- went quiet is `lost` or `not_now`; calling it unresponsive would erase the
-- fact that it once answered.
insert into public.closer_stage_transitions (from_stage, to_stage, note) values
  ('contacted', 'unresponsive', 'No reply after the follow-up budget');

-- Lost: from the point where there was a real opportunity.
insert into public.closer_stage_transitions (from_stage, to_stage, note)
select s, 'lost', 'An opportunity that did not close'
from unnest(enum_range(null::public.closer_stage)) s
where s in ('interested', 'qualified_opportunity', 'meeting_requested',
            'meeting_booked', 'trial', 'negotiation');

/* ------------------------------------------------------------------ *
 * Suppression check, used by every write path.
 * ------------------------------------------------------------------ */

/*
 * Is this company or contact on the list?
 *
 * Checked by identifier rather than by row, so a company deleted and
 * rediscovered tomorrow is still suppressed. Discovery has no memory;
 * the list is the memory.
 */
create or replace function public.closer_is_suppressed(
  p_organization_id uuid,
  p_domain text,
  p_email text
)
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select exists (
    select 1 from public.closer_suppressions s
    where s.organization_id = p_organization_id
      and (
        (p_domain is not null and s.domain = lower(p_domain))
        or (p_email is not null and s.email = lower(p_email))
      )
  );
$$;

revoke execute on function public.closer_is_suppressed(uuid, text, text) from public, anon;
grant execute on function public.closer_is_suppressed(uuid, text, text) to authenticated;

/* ------------------------------------------------------------------ *
 * The only writer of `stage`.
 * ------------------------------------------------------------------ */

create or replace function public.closer_set_stage(
  p_lead_id uuid,
  p_to_stage public.closer_stage,
  p_reason text,
  -- Null when an agent moved it; the caller's id when a person did. Recorded
  -- rather than inferred, because "who decided this" is the question an audit
  -- asks first.
  p_actor uuid default null
)
returns public.closer_leads
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  lead public.closer_leads;
  company public.closer_companies;
  contact public.closer_contacts;
  updated public.closer_leads;
begin
  select * into lead from public.closer_leads where id = p_lead_id;
  if lead.id is null then
    raise exception 'lead not found' using errcode = '42704';
  end if;
  if not public.is_org_member(lead.organization_id) then
    raise exception 'not a member of this workspace' using errcode = '42501';
  end if;

  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'a stage change needs a reason' using errcode = '22023';
  end if;

  -- A no-op transition is a caller bug, not a silent success: it would write a
  -- history row saying nothing happened.
  if lead.stage = p_to_stage then
    raise exception 'lead is already at %', p_to_stage using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.closer_stage_transitions t
    where t.from_stage = lead.stage and t.to_stage = p_to_stage
  ) then
    raise exception 'no transition from % to %', lead.stage, p_to_stage
      using errcode = '22023';
  end if;

  /*
   * Suppression outranks the graph.
   *
   * The transition table allows a suppressed lead to move like any other, and
   * that is deliberate: the graph describes the funnel, not the policy. The
   * policy is here, in one place, where it applies to every caller — an agent,
   * the UI, a future import — rather than being re-implemented per path.
   */
  select * into company from public.closer_companies where id = lead.company_id;
  if lead.contact_id is not null then
    select * into contact from public.closer_contacts where id = lead.contact_id;
  end if;

  if p_to_stage <> 'do_not_contact'
     and public.closer_is_suppressed(lead.organization_id, company.domain, contact.email)
  then
    raise exception 'this company or contact is suppressed'
      using errcode = '42501';
  end if;

  update public.closer_leads
     set stage = p_to_stage,
         stage_changed_at = now()
   where id = lead.id
  returning * into updated;

  insert into public.closer_stage_history
    (organization_id, lead_id, from_stage, to_stage, actor, reason)
  values
    (lead.organization_id, lead.id, lead.stage, p_to_stage, p_actor, trim(p_reason));

  return updated;
end;
$$;

revoke execute on function public.closer_set_stage(uuid, public.closer_stage, text, uuid)
  from public, anon;
grant execute on function public.closer_set_stage(uuid, public.closer_stage, text, uuid)
  to authenticated;

/* ------------------------------------------------------------------ *
 * Suppressing, and what it does to work already in flight.
 * ------------------------------------------------------------------ */

/*
 * Adding to the list also stops anything already moving.
 *
 * A suppression that only prevented *future* leads would leave a lead sitting
 * at `outreach_approved` with a message queued behind it. The whole point of an
 * opt-out is that it takes effect now.
 */
create or replace function public.closer_suppress(
  p_organization_id uuid,
  p_domain text,
  p_email text,
  p_reason public.closer_suppression_reason,
  p_note text default null
)
returns public.closer_suppressions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  created public.closer_suppressions;
  affected public.closer_leads;
begin
  if not public.is_org_member(p_organization_id) then
    raise exception 'not a member of this workspace' using errcode = '42501';
  end if;

  insert into public.closer_suppressions
    (organization_id, domain, email, reason, note)
  values
    (p_organization_id, lower(p_domain), lower(p_email), p_reason, p_note)
  on conflict do nothing
  returning * into created;

  if created.id is null then
    select * into created from public.closer_suppressions
     where organization_id = p_organization_id
       and (domain is not distinct from lower(p_domain))
       and (email is not distinct from lower(p_email));
  end if;

  -- Stop every lead this identifier reaches, unless it has already stopped.
  for affected in
    select l.* from public.closer_leads l
    join public.closer_companies c on c.id = l.company_id
    left join public.closer_contacts ct on ct.id = l.contact_id
    where l.organization_id = p_organization_id
      and l.stage <> 'do_not_contact'
      and (
        (p_domain is not null and c.domain = lower(p_domain))
        or (p_email is not null and ct.email = lower(p_email))
      )
  loop
    perform public.closer_set_stage(
      affected.id, 'do_not_contact', 'Suppressed: ' || p_reason::text, auth.uid()
    );
  end loop;

  return created;
end;
$$;

revoke execute on function
  public.closer_suppress(uuid, text, text, public.closer_suppression_reason, text)
  from public, anon;
grant execute on function
  public.closer_suppress(uuid, text, text, public.closer_suppression_reason, text)
  to authenticated;

/* ------------------------------------------------------------------ *
 * Creating a lead. The one place a company enters the funnel.
 * ------------------------------------------------------------------ */

create or replace function public.closer_open_lead(p_company_id uuid)
returns public.closer_leads
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  company public.closer_companies;
  created public.closer_leads;
begin
  select * into company from public.closer_companies where id = p_company_id;
  if company.id is null then
    raise exception 'company not found' using errcode = '42704';
  end if;
  if not public.is_org_member(company.organization_id) then
    raise exception 'not a member of this workspace' using errcode = '42501';
  end if;

  -- Checked before the row exists, so a suppressed domain never acquires a lead
  -- that then has to be walked back.
  if public.closer_is_suppressed(company.organization_id, company.domain, null) then
    raise exception 'this company is suppressed' using errcode = '42501';
  end if;

  insert into public.closer_leads (organization_id, company_id)
  values (company.organization_id, company.id)
  on conflict (organization_id, company_id) do nothing
  returning * into created;

  if created.id is null then
    -- Rediscovery is normal and is not an error: discovery runs repeatedly and
    -- finds the same companies. The existing lead, at whatever stage it reached,
    -- is the answer.
    select * into created from public.closer_leads
     where organization_id = company.organization_id and company_id = company.id;
    return created;
  end if;

  insert into public.closer_stage_history
    (organization_id, lead_id, from_stage, to_stage, actor, reason)
  values
    (company.organization_id, created.id, null, 'discovered', auth.uid(), 'Discovered');

  return created;
end;
$$;

revoke execute on function public.closer_open_lead(uuid) from public, anon;
grant execute on function public.closer_open_lead(uuid) to authenticated;
