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
-- Only the guard changes. The signature is identical, so the existing grants
-- still apply and are not repeated here.
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

  update public.runs set
    status = p_status,
    stage = p_stage,
    framework = coalesce(p_framework, framework),
    keys_extracted = p_keys_extracted,
    keys_translated = p_keys_translated,
    locales_succeeded = p_locales_succeeded,
    locales_failed = p_locales_failed,
    error = p_error,
    pr_url = p_pr_url,
    pr_number = p_pr_number,
    branch = p_branch,
    finished_at = now()
  where id = p_run_id
  returning * into updated;

  return updated;
end;
$$;
