-- pr_url reaches an href, so the database decides what may be in it.
--
-- Found by security review of the previous commit, and it was exploitable.
-- `finish_run` is granted to `authenticated` — it has to be, because the server
-- calls it with the user's own session — so any member of an organization could
-- write an arbitrary string into runs.pr_url, and runs-section.tsx renders that
-- string as `href={run.prUrl}`. A value of `javascript:…` is stored XSS against
-- every colleague who clicks it.
--
-- The previous migration's comment claimed "a row a client can write is a claim
-- rather than a record" and then granted EXECUTE on functions that write rows.
-- Both halves of that are now true only because the shape of what can be
-- written is constrained here, at the layer no caller can go around.
--
-- Anchored, and with no newlines: `^https://github\.com/` alone would accept
-- `https://github.com.evil.example/x`, and a permitted newline lets a value
-- pass the check while a naive renderer sees a different first line.
alter table public.runs
  add constraint runs_pr_url_is_a_github_url
  check (
    pr_url is null
    or pr_url ~ '^https://github\.com/[A-Za-z0-9._-]+/[A-Za-z0-9._-]+/pull/[0-9]+$'
  );

-- The same rule inside the function, so a caller gets a reason rather than a
-- constraint violation, and so the intent survives if the constraint is ever
-- rewritten.
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
  if existing.status in ('succeeded','partial','failed') then
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

revoke execute on function public.finish_run(uuid, public.run_status, public.run_stage, text, int, int, int, int, text, text, int, text) from public, anon;
grant execute on function public.finish_run(uuid, public.run_status, public.run_stage, text, int, int, int, int, text, text, int, text) to authenticated;
