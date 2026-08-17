-- Starting and finishing a run.
--
-- The runs table has no INSERT or UPDATE policy on purpose: a row a client can
-- write is a claim, not a record. These functions are the only way in, and they
-- run as definer so the table stays closed.
--
-- They are still authorization-checked: is_org_member() is evaluated for the
-- caller inside the function, so an authenticated user can only record runs
-- against a project in an organization they belong to. Definer bypasses RLS on
-- the write, not the membership question.
create or replace function public.start_run(p_project_id uuid)
returns public.runs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  proj public.projects;
  created public.runs;
begin
  select * into proj from public.projects where id = p_project_id;
  if proj.id is null then
    raise exception 'project not found' using errcode = '42704';
  end if;
  if not public.is_org_member(proj.organization_id) then
    raise exception 'not a member of this workspace' using errcode = '42501';
  end if;

  insert into public.runs (
    project_id, organization_id, triggered_by, status, stage,
    source_locale, target_locales, started_at
  )
  values (
    proj.id, proj.organization_id, auth.uid(), 'running', 'detect',
    proj.source_locale, proj.target_locales, now()
  )
  returning * into created;

  return created;
end;
$$;

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

  -- A finished run is final. Without this a retry or a double submit could
  -- rewrite a failure as a success, which is exactly the history a customer
  -- would be relying on.
  if existing.status in ('succeeded','partial','failed') then
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

revoke execute on function public.start_run(uuid) from public, anon;
revoke execute on function public.finish_run(uuid, public.run_status, public.run_stage, text, int, int, int, int, text, text, int, text) from public, anon;
grant execute on function public.start_run(uuid) to authenticated;
grant execute on function public.finish_run(uuid, public.run_status, public.run_stage, text, int, int, int, int, text, text, int, text) to authenticated;
