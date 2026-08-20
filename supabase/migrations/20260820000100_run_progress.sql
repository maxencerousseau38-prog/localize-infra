-- Progress that survives the request that made it.
--
-- `stage` has existed since runs did, and was written exactly once: at the end,
-- by finish_run. During the run itself it was a local variable in a server
-- action. So for the whole of a run — a checkout, an AST walk, and one model
-- call per locale over potentially hundreds of strings — the database said
-- `detect`, and every reader of that row was told the same thing whether the
-- run was translating, waiting on a person, or dead.
--
-- Two additions make it observable:
--
--   * advance_run() writes the stage and the counters as they become known,
--     rather than accumulating them in memory and hoping the request survives.
--   * progress_at is a heartbeat. A stage alone cannot distinguish a run that
--     is slow from one whose request was killed mid-flight — a serverless
--     function that times out leaves no error behind, and the row would sit at
--     'translate' forever looking busy. With a timestamp, a reader can tell.
alter table public.runs
  add column if not exists progress_at timestamptz;

comment on column public.runs.progress_at is
  'Last time the run reported progress. Distinguishes a slow run from an abandoned one.';

/**
 * Records where a run has got to, without ending it.
 *
 * Counters are optional and only overwrite when given: a caller advancing to
 * 'translate' knows how many keys were extracted but not yet how many were
 * translated, and passing null for the rest must not reset what is already
 * recorded. finish_run has the opposite contract — it writes every count it is
 * given and defaults the others to zero — which is correct for an ending and
 * wrong for a step.
 */
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
  if parent.status in ('succeeded', 'partial', 'failed') then
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

revoke execute on function public.advance_run(uuid, public.run_stage, text, int, int, int, int)
  from public, anon;
grant execute on function public.advance_run(uuid, public.run_stage, text, int, int, int, int)
  to authenticated;
