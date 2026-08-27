-- Closer — three findings from an adversarial audit of the guards themselves.
--
-- All three were reproduced before being fixed, and the first is the reason
-- this migration exists at all.

/* ------------------------------------------------------------------ *
 * F1 — a suppressed domain did not protect addresses at that domain
 * ------------------------------------------------------------------ */

/*
 * `closer_is_suppressed` compared the domain list against the *company's*
 * `domain` column and the address list by exact equality. The domain inside an
 * address was never compared to anything.
 *
 * `closer_upsert_company` deliberately allows a null domain — a repository with
 * no resolvable homepage is exactly the early-stage team discovery looks for —
 * and for such a company neither arm can match. Reproduced end to end: after a
 * company at `blocked.example` opted out, a second company with a null domain
 * and a contact at `colleague@blocked.example` was created, opened a lead,
 * walked to `ready_for_outreach`, drafted a message and **had it approved**.
 * Five stacked guards all passed, because every one of them asks this same
 * function and this function was looking at the wrong field.
 *
 * The fix is here rather than in the callers, and that is the point: five
 * guards sharing one blind spot is what made a single omission reach an
 * approved message. Adding a check to `closer_draft_message` would have closed
 * one of the five.
 *
 * `split_part` on a value with no `@` returns the empty string, so the
 * non-empty test stops a malformed address from matching a suppression row
 * that somehow held an empty domain.
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
        or (
          p_email is not null
          and s.domain is not null
          and lower(split_part(p_email, '@', 2)) <> ''
          and s.domain = lower(split_part(p_email, '@', 2))
        )
      )
  );
$$;

/*
 * The two places that reached past the guard rather than through it.
 *
 * `closer_suppress` matched leads with a hand-written join, and
 * `closer_open_lead` looked for a suppressed contact with another one. Both
 * compared addresses by exact equality, so both inherited the same blind spot
 * and would have kept it after the fix above. They now ask
 * `closer_is_suppressed`, which is what "centralise" has to mean if it is to be
 * worth anything.
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

  /*
   * Every lead the list now reaches, asked through the one guard.
   *
   * Re-evaluated against the whole list rather than against the identifier just
   * added, because a lead can be caught by a row written earlier — a company
   * whose domain was blank when an address at that domain was suppressed is
   * precisely the case F1 was about.
   */
  for affected in
    select l.* from public.closer_leads l
    join public.closer_companies c on c.id = l.company_id
    where l.organization_id = p_organization_id
      and l.stage <> 'do_not_contact'
      and (
        public.closer_is_suppressed(p_organization_id, c.domain, null)
        or exists (
          select 1 from public.closer_contacts ct
          where ct.company_id = c.id
            and public.closer_is_suppressed(p_organization_id, null, ct.email)
        )
      )
  loop
    perform public.closer_set_stage(
      affected.id, 'do_not_contact', 'Suppressed: ' || p_reason::text
    );
  end loop;

  return created;
end;
$$;

create or replace function public.closer_open_lead(p_company_id uuid)
returns public.closer_leads
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  company public.closer_companies;
  created public.closer_leads;
  blocked_contact text;
begin
  select * into company from public.closer_companies where id = p_company_id;
  if company.id is null then
    raise exception 'company not found' using errcode = '42704';
  end if;
  if not public.is_org_member(company.organization_id) then
    raise exception 'not a member of this workspace' using errcode = '42501';
  end if;

  if public.closer_is_suppressed(company.organization_id, company.domain, null) then
    raise exception 'this company is suppressed' using errcode = '42501';
  end if;

  select ct.email into blocked_contact
  from public.closer_contacts ct
  where ct.company_id = company.id
    and public.closer_is_suppressed(company.organization_id, null, ct.email)
  limit 1;

  if blocked_contact is not null then
    raise exception 'a contact at this company has asked not to be contacted'
      using errcode = '42501';
  end if;

  insert into public.closer_leads (organization_id, company_id)
  values (company.organization_id, company.id)
  on conflict (organization_id, company_id) do nothing
  returning * into created;

  if created.id is null then
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

/* ------------------------------------------------------------------ *
 * F2 — a classification could erase a confirmed disagreement
 * ------------------------------------------------------------------ */

/*
 * `closer_classify_reply` had no guard on `operator_intent`. Reproduced: model
 * said `question`, the operator confirmed `not_a_fit`, a second classification
 * wrote `not_a_fit`, and the disagreement was gone.
 *
 * Those two columns exist for exactly one purpose — measuring how often the
 * classifier is right — and `summariseLearning` counts agreements from what the
 * table holds. An agent free to re-classify after confirmation turns its own
 * mistakes into successes, silently, in the direction that flatters it.
 *
 * Re-classifying an *unconfirmed* reply stays allowed: that is re-running a
 * model on something nobody has judged yet, which is ordinary.
 */
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

  if reply.operator_intent is not null then
    raise exception 'a person has already judged this reply as %; re-classifying would erase the comparison', reply.operator_intent
      using errcode = '22023';
  end if;

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

/* ------------------------------------------------------------------ *
 * F3 — the audit trail took the actor from the caller
 * ------------------------------------------------------------------ */

/*
 * `closer_set_stage` accepted `p_actor` and wrote it into
 * `closer_stage_history` unchecked. Reproduced: a signed-in member attributed a
 * stage change to a real account that was not even a member of the workspace.
 * The column's own comment says "who decided this" is the question an audit
 * asks first — and the answer was whatever the caller typed.
 *
 * The parameter is **removed** rather than ignored. Keeping it would leave an
 * argument that looks load-bearing and is not, which is the same shape as the
 * three comments this repository has already found asserting checks that did
 * not exist.
 *
 * `auth.uid()` reproduces the intended semantics exactly and unforgeably: a
 * signed-in person records their own id, and an agent holding a service token
 * has no `auth.uid()`, so it records null — which is what null already meant.
 */
drop function if exists public.closer_set_stage(uuid, public.closer_stage, text, uuid);

create or replace function public.closer_set_stage(
  p_lead_id uuid,
  p_to_stage public.closer_stage,
  p_reason text
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

  select * into company from public.closer_companies where id = lead.company_id;
  if lead.contact_id is not null then
    select * into contact from public.closer_contacts where id = lead.contact_id;
  end if;

  /*
   * The suppression test now also covers every contact of the company, not
   * only the lead's chosen one. `closer_leads.contact_id` is written by
   * nothing in this repository, so the previous form's address arm was
   * unreachable — the same dead-column shape already fixed once in
   * `closer_suppress`.
   */
  if p_to_stage <> 'do_not_contact'
     and (
       public.closer_is_suppressed(lead.organization_id, company.domain, contact.email)
       or exists (
         select 1 from public.closer_contacts ct
         where ct.company_id = company.id
           and public.closer_is_suppressed(lead.organization_id, null, ct.email)
       )
     )
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
    (lead.organization_id, lead.id, lead.stage, p_to_stage, auth.uid(), trim(p_reason));

  return updated;
end;
$$;

revoke execute on function public.closer_set_stage(uuid, public.closer_stage, text)
  from public, anon;
grant execute on function public.closer_set_stage(uuid, public.closer_stage, text)
  to authenticated;
