-- The other finality guard, which the first attempt at this change forgot.
--
-- `finish_run` learned in 20260830000200 that `no_changes` is terminal.
-- `advance_run` carries the same guard for its own reason, stated in its own
-- comment: a late write from a request that was already superseded could drag a
-- completed run backwards into 'translate' and make it look live.
--
-- Adding a terminal status to one guard and not the other does not leave the
-- second merely out of date — it opens exactly the hole the second was written
-- to close. A run that finished as `no_changes` would accept a stale
-- `advance_run` from a superseded request, move back to a stage, and start
-- reporting progress it is not making. The status is new, so no run has hit
-- this yet; it would have been a matter of time and of a double click.
--
-- Found by the reviewer of 20260830000200, which was scoped to `finish_run`
-- alone. Scoping the task that way is what hid it: the change was "make
-- `no_changes` terminal", and only one of the two places that decide what
-- terminal means was named.
--
-- Body read back from the live database with `pg_get_functiondef`, for the
-- reason 20260830000200 records at length: the current definition of a
-- replaceable object is what the database holds, never the migration that first
-- created it. The only edit is `'no_changes'` in the guard.
create or replace function public.advance_run(
  p_run_id uuid,
  p_stage public.run_stage,
  p_framework text default null,
  p_keys_extracted int default null,
  p_keys_translated int default null,
  p_locales_succeeded int default null,
  p_locales_failed int default null
)
returns public.runs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  parent public.runs;
  updated public.runs;
begin
  select * into parent from public.runs where id = p_run_id;
  if parent.id is null then
    raise exception 'run not found' using errcode = '42704';
  end if;
  if not public.is_org_member(parent.organization_id) then
    raise exception 'not a member of this workspace' using errcode = '42501';
  end if;

  -- A finished run does not move again. Without this, a late write from a
  -- request that was already superseded could drag a completed run backwards
  -- into 'translate' and make it look live.
  if parent.status in ('succeeded', 'partial', 'failed', 'no_changes') then
    return parent;
  end if;

  update public.runs set
    status = case when status = 'queued' then 'running' else status end,
    stage = p_stage,
    started_at = coalesce(started_at, now()),
    progress_at = now(),
    framework = coalesce(p_framework, framework),
    keys_extracted = coalesce(p_keys_extracted, keys_extracted),
    keys_translated = coalesce(p_keys_translated, keys_translated),
    locales_succeeded = coalesce(p_locales_succeeded, locales_succeeded),
    locales_failed = coalesce(p_locales_failed, locales_failed)
  where id = p_run_id
  returning * into updated;

  return updated;
end;
$$;
