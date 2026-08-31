-- `no_changes` is terminal, and the guard has to know it.
--
-- finish_run refuses to rewrite a run that already reached 'succeeded',
-- 'partial' or 'failed', so a retry or a double submit cannot turn a recorded
-- failure into a success. 'awaiting_review' is deliberately absent from that
-- list: the ambiguity approval path finishes such a run later, on purpose.
--
-- 'no_changes' is not that kind of state. Nothing resumes it, so leaving it out
-- of the guard would let a second call overwrite it — the same history rewrite
-- the guard exists to stop.
--
-- **This body is copied from the live definition, not from 20260817000400_run_rpcs.sql.**
-- The plan that produced this migration copied the original `run_rpcs` body and
-- claimed "only the guard changes". That was false: 20260817000500 had already
-- replaced this function, and the original body is missing three things that
-- are in the running one — the pr_url format check, the `greatest(…, 0)` bounds
-- on the counters, and the `left(…, 4000)` truncation on the error column.
-- `create or replace function` replaces the whole body, so shipping the plan's
-- version would have silently deleted all three, one of them added after a
-- security review found a stored `javascript:` URL was one click from running
-- in a colleague's session.
--
-- The lesson worth keeping, since this repository has been caught by it before:
-- the current definition of a replaceable object is what the database holds,
-- never the migration that first created it. This body was read back with
-- `pg_get_functiondef` and the only edit is `'no_changes'` in the guard.
create or replace function public.finish_run(
  p_run_id uuid,
  p_status public.run_status,
  p_stage public.run_stage,
  p_framework text default null,
  p_keys_extracted int default 0,
  p_keys_translated int default 0,
  p_locales_succeeded int default 0,
  p_locales_failed int default 0,
  p_error text default null,
  p_pr_url text default null,
  p_pr_number int default null,
  p_branch text default null
)
returns public.runs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  existing public.runs;
  updated public.runs;
begin
  select * into existing from public.runs where id = p_run_id;
  if existing.id is null then
    raise exception 'run not found' using errcode = '42704';
  end if;
  if not public.is_org_member(existing.organization_id) then
    raise exception 'not a member of this workspace' using errcode = '42501';
  end if;
  if existing.status in ('succeeded','partial','failed','no_changes') then
    raise exception 'run % is already finished', p_run_id using errcode = '55000';
  end if;

  if p_pr_url is not null
     and p_pr_url !~ '^https://github\.com/[A-Za-z0-9._-]+/[A-Za-z0-9._-]+/pull/[0-9]+$' then
    raise exception 'pr_url must be a github.com pull request URL'
      using errcode = '22023';
  end if;

  update public.runs set
    status = p_status,
    stage = p_stage,
    framework = coalesce(p_framework, framework),
    keys_extracted = greatest(p_keys_extracted, 0),
    keys_translated = greatest(p_keys_translated, 0),
    locales_succeeded = greatest(p_locales_succeeded, 0),
    locales_failed = greatest(p_locales_failed, 0),
    -- Bounded: this is provider output rendered on a page, and an unbounded
    -- error field is a way to store a great deal of someone else's text.
    error = left(p_error, 4000),
    pr_url = p_pr_url,
    pr_number = p_pr_number,
    branch = p_branch,
    finished_at = now()
  where id = p_run_id
  returning * into updated;

  return updated;
end;
$$;
