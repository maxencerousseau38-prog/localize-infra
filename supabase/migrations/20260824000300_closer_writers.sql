-- Closer — the write paths.
--
-- The two migrations before this one closed every table to direct writes and
-- gave the lifecycle its only door. That left the system unable to take input:
-- discovery had nowhere to put a company, research nowhere to put evidence.
-- Found by probing the state machine against the database and being refused by
-- the very policy that was working correctly.
--
-- Each function below checks membership, then writes one kind of thing. None of
-- them touches `stage` — that stays with `closer_set_stage`, so an agent that
-- can record evidence still cannot advance a lead on the strength of it.

/* ------------------------------------------------------------------ *
 * Companies — discovery's only door.
 * ------------------------------------------------------------------ */

/*
 * Upsert on the domain, because discovery runs repeatedly.
 *
 * The same company will be found again from a different source next week, and
 * a second row would split its evidence and its history in two. Where the
 * domain is unknown the row is inserted unconditionally: refusing would drop a
 * real discovery, and merging on name alone would fuse two companies that
 * happen to share one.
 */
create or replace function public.closer_upsert_company(
  p_organization_id uuid,
  p_name text,
  p_domain text,
  p_discovered_from public.closer_evidence_source,
  p_discovered_url text default null,
  p_repository text default null,
  p_tech_stack text[] default '{}',
  p_locales text[] default '{}',
  p_employee_estimate int default null
)
returns public.closer_companies
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  result public.closer_companies;
begin
  if not public.is_org_member(p_organization_id) then
    raise exception 'not a member of this workspace' using errcode = '42501';
  end if;

  if p_domain is null then
    insert into public.closer_companies
      (organization_id, name, domain, repository, discovered_from, discovered_url,
       tech_stack, locales, employee_estimate)
    values
      (p_organization_id, p_name, null, p_repository, p_discovered_from, p_discovered_url,
       coalesce(p_tech_stack, '{}'), coalesce(p_locales, '{}'), p_employee_estimate)
    returning * into result;
    return result;
  end if;

  insert into public.closer_companies
    (organization_id, name, domain, repository, discovered_from, discovered_url,
     tech_stack, locales, employee_estimate)
  values
    (p_organization_id, p_name, lower(p_domain), p_repository, p_discovered_from,
     p_discovered_url, coalesce(p_tech_stack, '{}'), coalesce(p_locales, '{}'),
     p_employee_estimate)
  on conflict (organization_id, domain) do update
    set name = excluded.name,
        -- Coalesced rather than overwritten: a later discovery that happens not
        -- to carry a repository must not erase one an earlier pass found.
        repository = coalesce(excluded.repository, public.closer_companies.repository),
        tech_stack = case when array_length(excluded.tech_stack, 1) is null
                          then public.closer_companies.tech_stack
                          else excluded.tech_stack end,
        locales = case when array_length(excluded.locales, 1) is null
                       then public.closer_companies.locales
                       else excluded.locales end,
        employee_estimate = coalesce(excluded.employee_estimate,
                                     public.closer_companies.employee_estimate),
        updated_at = now()
  returning * into result;

  return result;
end;
$$;

/* ------------------------------------------------------------------ *
 * Contacts.
 * ------------------------------------------------------------------ */

create or replace function public.closer_record_contact(
  p_company_id uuid,
  p_source public.closer_evidence_source,
  p_source_url text,
  p_full_name text default null,
  p_role_title text default null,
  p_email text default null
)
returns public.closer_contacts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  company public.closer_companies;
  result public.closer_contacts;
begin
  select * into company from public.closer_companies where id = p_company_id;
  if company.id is null then
    raise exception 'company not found' using errcode = '42704';
  end if;
  if not public.is_org_member(company.organization_id) then
    raise exception 'not a member of this workspace' using errcode = '42501';
  end if;

  /*
   * A suppressed address is not stored at all.
   *
   * Storing it and refusing to use it would keep personal data whose only
   * purpose was a contact that must not happen — which is the opposite of data
   * minimisation. The suppression list already holds the address; that is the
   * one copy the opt-out requires.
   */
  if p_email is not null
     and public.closer_is_suppressed(company.organization_id, null, p_email) then
    raise exception 'this address is suppressed' using errcode = '42501';
  end if;

  insert into public.closer_contacts
    (organization_id, company_id, full_name, role_title, email, source, source_url)
  values
    (company.organization_id, company.id, p_full_name, p_role_title,
     lower(p_email), p_source, p_source_url)
  on conflict (organization_id, email) do update
    set full_name = coalesce(excluded.full_name, public.closer_contacts.full_name),
        role_title = coalesce(excluded.role_title, public.closer_contacts.role_title)
  returning * into result;

  return result;
end;
$$;

/* ------------------------------------------------------------------ *
 * Evidence.
 * ------------------------------------------------------------------ */

create or replace function public.closer_record_evidence(
  p_company_id uuid,
  p_kind public.closer_evidence_kind,
  p_label text,
  p_summary text,
  p_source public.closer_evidence_source,
  p_source_url text,
  p_observed_at timestamptz,
  p_confidence numeric default null
)
returns public.closer_evidence
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  company public.closer_companies;
  result public.closer_evidence;
begin
  select * into company from public.closer_companies where id = p_company_id;
  if company.id is null then
    raise exception 'company not found' using errcode = '42704';
  end if;
  if not public.is_org_member(company.organization_id) then
    raise exception 'not a member of this workspace' using errcode = '42501';
  end if;

  /*
   * A source in the future is a clock problem or a fabrication, and both are
   * worth refusing. Evidence dated tomorrow would also outrank every real
   * observation in any recency weighting built on `observed_at`.
   */
  if p_observed_at > now() + interval '1 day' then
    raise exception 'evidence cannot be observed in the future' using errcode = '22023';
  end if;

  insert into public.closer_evidence
    (organization_id, company_id, kind, label, summary, source, source_url,
     observed_at, confidence)
  values
    (company.organization_id, company.id, p_kind, p_label, p_summary, p_source,
     p_source_url, p_observed_at, p_confidence)
  returning * into result;

  return result;
end;
$$;

/* ------------------------------------------------------------------ *
 * Scores.
 * ------------------------------------------------------------------ */

/*
 * A score is written with its arithmetic or not at all.
 *
 * The table already refuses an empty breakdown. This refuses one whose points
 * do not add up to the value claimed — the failure that a non-empty check
 * cannot see, and the one that turns an explainable score back into a number
 * somebody has to trust.
 */
create or replace function public.closer_record_score(
  p_company_id uuid,
  p_kind public.closer_score_kind,
  p_value int,
  p_confidence numeric,
  p_breakdown jsonb,
  p_weights jsonb
)
returns public.closer_scores
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  company public.closer_companies;
  result public.closer_scores;
  total int;
begin
  select * into company from public.closer_companies where id = p_company_id;
  if company.id is null then
    raise exception 'company not found' using errcode = '42704';
  end if;
  if not public.is_org_member(company.organization_id) then
    raise exception 'not a member of this workspace' using errcode = '42501';
  end if;

  select coalesce(sum((component->>'points')::int), -1)
    into total
    from jsonb_array_elements(p_breakdown) component;

  if total <> p_value then
    raise exception 'breakdown sums to % but the score claims %', total, p_value
      using errcode = '22023';
  end if;

  insert into public.closer_scores
    (organization_id, company_id, kind, value, confidence, breakdown, weights)
  values
    (company.organization_id, company.id, p_kind, p_value, p_confidence,
     p_breakdown, p_weights)
  returning * into result;

  return result;
end;
$$;

/* ------------------------------------------------------------------ *
 * AI executions — the audit row.
 * ------------------------------------------------------------------ */

create or replace function public.closer_record_ai_execution(
  p_organization_id uuid,
  p_agent text,
  p_model_id text,
  p_input jsonb,
  p_output jsonb default null,
  p_company_id uuid default null,
  p_confidence numeric default null,
  p_input_tokens int default null,
  p_output_tokens int default null,
  p_latency_ms int default null,
  p_error text default null
)
returns public.closer_ai_executions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  result public.closer_ai_executions;
begin
  if not public.is_org_member(p_organization_id) then
    raise exception 'not a member of this workspace' using errcode = '42501';
  end if;

  insert into public.closer_ai_executions
    (organization_id, company_id, agent, model_id, input, output, confidence,
     input_tokens, output_tokens, latency_ms, error)
  values
    (p_organization_id, p_company_id, p_agent, p_model_id, p_input, p_output,
     p_confidence, p_input_tokens, p_output_tokens, p_latency_ms, p_error)
  returning * into result;

  return result;
end;
$$;

/* ------------------------------------------------------------------ *
 * Jobs.
 * ------------------------------------------------------------------ */

create or replace function public.closer_enqueue_job(
  p_organization_id uuid,
  p_kind text,
  p_payload jsonb default '{}'::jsonb,
  p_run_after timestamptz default now(),
  p_max_attempts int default 3
)
returns public.closer_jobs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  result public.closer_jobs;
begin
  if not public.is_org_member(p_organization_id) then
    raise exception 'not a member of this workspace' using errcode = '42501';
  end if;

  insert into public.closer_jobs
    (organization_id, kind, payload, run_after, max_attempts)
  values
    (p_organization_id, p_kind, coalesce(p_payload, '{}'::jsonb), p_run_after,
     p_max_attempts)
  returning * into result;

  return result;
end;
$$;

/*
 * Claiming work.
 *
 * `for update skip locked` is what makes two workers safe to run at once: the
 * second skips the row the first is holding rather than blocking on it. The
 * repository has one cron and therefore one worker today, and this costs
 * nothing to have right before that changes.
 *
 * A claim is an attempt. Incrementing here rather than on failure means a job
 * whose worker dies mid-flight — leaving no failure to record — still runs out
 * of attempts instead of being retried forever.
 */
create or replace function public.closer_claim_job(p_organization_id uuid)
returns public.closer_jobs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  claimed public.closer_jobs;
begin
  if not public.is_org_member(p_organization_id) then
    raise exception 'not a member of this workspace' using errcode = '42501';
  end if;

  update public.closer_jobs j
     set state = 'running',
         claimed_at = now(),
         attempts = j.attempts + 1
   where j.id = (
     select id from public.closer_jobs
      where organization_id = p_organization_id
        and state = 'queued'
        and run_after <= now()
      order by run_after
      for update skip locked
      limit 1
   )
  returning * into claimed;

  return claimed;
end;
$$;

create or replace function public.closer_finish_job(
  p_job_id uuid,
  p_state public.closer_job_state,
  p_error text default null
)
returns public.closer_jobs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  job public.closer_jobs;
  result public.closer_jobs;
begin
  select * into job from public.closer_jobs where id = p_job_id;
  if job.id is null then
    raise exception 'job not found' using errcode = '42704';
  end if;
  if not public.is_org_member(job.organization_id) then
    raise exception 'not a member of this workspace' using errcode = '42501';
  end if;
  if p_state not in ('completed', 'failed', 'cancelled') then
    raise exception 'a job finishes completed, failed or cancelled' using errcode = '22023';
  end if;

  /*
   * A failure with attempts left goes back to the queue rather than stopping.
   * Retrying is the point of counting attempts, and a `failed` row that still
   * had budget would need somebody to notice and requeue it by hand.
   */
  if p_state = 'failed' and job.attempts < job.max_attempts then
    update public.closer_jobs
       set state = 'queued',
           claimed_at = null,
           error = p_error,
           -- Backs off by attempt, so a failing dependency is not hammered.
           run_after = now() + (job.attempts * interval '1 minute')
     where id = job.id
    returning * into result;
    return result;
  end if;

  update public.closer_jobs
     set state = p_state, finished_at = now(), error = p_error
   where id = job.id
  returning * into result;

  return result;
end;
$$;

/* ------------------------------------------------------------------ *
 * Grants. Callable by members; each function checks membership itself.
 * ------------------------------------------------------------------ */

revoke execute on function public.closer_upsert_company(uuid, text, text, public.closer_evidence_source, text, text, text[], text[], int) from public, anon;
grant execute on function public.closer_upsert_company(uuid, text, text, public.closer_evidence_source, text, text, text[], text[], int) to authenticated;

revoke execute on function public.closer_record_contact(uuid, public.closer_evidence_source, text, text, text, text) from public, anon;
grant execute on function public.closer_record_contact(uuid, public.closer_evidence_source, text, text, text, text) to authenticated;

revoke execute on function public.closer_record_evidence(uuid, public.closer_evidence_kind, text, text, public.closer_evidence_source, text, timestamptz, numeric) from public, anon;
grant execute on function public.closer_record_evidence(uuid, public.closer_evidence_kind, text, text, public.closer_evidence_source, text, timestamptz, numeric) to authenticated;

revoke execute on function public.closer_record_score(uuid, public.closer_score_kind, int, numeric, jsonb, jsonb) from public, anon;
grant execute on function public.closer_record_score(uuid, public.closer_score_kind, int, numeric, jsonb, jsonb) to authenticated;

revoke execute on function public.closer_record_ai_execution(uuid, text, text, jsonb, jsonb, uuid, numeric, int, int, int, text) from public, anon;
grant execute on function public.closer_record_ai_execution(uuid, text, text, jsonb, jsonb, uuid, numeric, int, int, int, text) to authenticated;

revoke execute on function public.closer_enqueue_job(uuid, text, jsonb, timestamptz, int) from public, anon;
grant execute on function public.closer_enqueue_job(uuid, text, jsonb, timestamptz, int) to authenticated;

revoke execute on function public.closer_claim_job(uuid) from public, anon;
grant execute on function public.closer_claim_job(uuid) to authenticated;

revoke execute on function public.closer_finish_job(uuid, public.closer_job_state, text) from public, anon;
grant execute on function public.closer_finish_job(uuid, public.closer_job_state, text) to authenticated;
