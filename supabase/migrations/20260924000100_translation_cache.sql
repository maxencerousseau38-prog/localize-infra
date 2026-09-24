-- Make a run resumable, by keeping what it already paid for.
--
-- ## The failure
--
-- A run is one serverless request, start to finish. `handleTranslateBatch`
-- chunks at 100 strings and awaits each chunk in a `for` loop; `startRun`
-- awaits each locale the same way. So wall-clock is the sum of every chunk of
-- every locale, strictly serial, inside a request the platform will cut at its
-- timeout.
--
-- Nothing survives that cut. `record_run_translations` runs once, after the
-- whole locale loop, and a run that dies opens no pull request — so the model
-- output for every locale that *did* finish is discarded. The customer is
-- billed for it and receives none of it, and the next click starts from zero
-- and bills for it again.
--
-- The daily ceiling has the same shape and was fixed in front of it: a
-- preflight now refuses a run that cannot fit rather than letting it die
-- halfway. The clock cannot be preflighted, because nothing knows how long a
-- chunk takes. So the answer here is not to predict the cut but to survive it.
--
-- ## What this table is
--
-- One row per (project, locale, key): the model's output for a source text
-- that has been **paid for and not yet delivered**. The next run reads it and
-- does not send those keys again.
--
-- It is a cache in the sense invariant 1 means — Git is the source of truth,
-- Postgres is an index. Losing every row here costs money, never correctness:
-- the next run simply re-translates. Nothing reads it as authority.
--
-- ## Why not `run_translations`
--
-- That table answers a different question and has a different lifetime. It is
-- keyed by `run_id`, it is what the review screen shows, and its single write
-- is deliberately placed after the `no_changes` branch so a repeated click
-- does not pile up `preserved` rows nobody asked for. Writing to it per locale
-- would collide with that write on `unique (run_id, locale, translation_key)`
-- and would entangle "what this run proposes" with "what has already been
-- bought". Two lifetimes in one table is how the wrong one gets deleted.
--
-- ## Why `source_text` is in the key test and not just the key
--
-- A key whose English changed is a different string. Reusing a translation of
-- the old text because the key matched would ship a stale translation and call
-- it a saving. The read compares the text; a mismatch is a miss.

create table public.translation_cache (
  -- Keyed by project, not by run. The whole point is to outlive the run.
  project_id uuid not null
    references public.projects (id) on delete cascade,
  locale text not null,
  translation_key text not null,

  -- Denormalised so RLS is one column read, exactly as `run_translations`
  -- does it. A cascade from projects keeps it honest.
  organization_id uuid not null
    references public.organizations (id) on delete cascade,

  -- What the model was asked about. A row whose source_text no longer matches
  -- the freshly extracted string is a miss, not a hit.
  source_text text not null,
  translated_text text not null,

  -- Kept for the operator question this table will eventually raise: "how old
  -- is the oldest thing we are still holding?" No expiry is enforced. A row
  -- stops being read the moment its key has a value in the repository, because
  -- `pendingKeys` never asks about it again.
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (project_id, locale, translation_key)
);

alter table public.translation_cache enable row level security;

-- Readable by members, like every other project-scoped row. There is no write
-- policy: writes go through the function below, which re-reads the project and
-- checks membership against *that* row's organization rather than trusting a
-- caller-supplied id.
create policy translation_cache_select_member on public.translation_cache
  for select to authenticated
  using (public.is_org_member(organization_id));

/**
 * Save one locale's model output, as soon as that locale finishes.
 *
 * Called inside the locale loop rather than at the end, which is the entire
 * point: a run cut off after three of ten locales must leave three locales
 * bought and paid for.
 *
 * One statement per locale rather than per key, for the reason
 * `record_run_translations` gives: a 400-string locale is 400 round trips
 * otherwise, inside a request already holding a repository checkout open —
 * and inside a request that is racing a timeout, which makes it worse here
 * than there.
 *
 * `on conflict do update` rather than `do nothing`: a re-translation of a key
 * whose source text changed must replace the stale row, not be dropped by it.
 */
create or replace function public.save_translation_cache(
  p_project_id uuid,
  p_locale text,
  p_rows jsonb
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  parent public.projects;
  written integer;
begin
  select * into parent from public.projects where id = p_project_id;
  if parent.id is null then
    raise exception 'project not found' using errcode = '42704';
  end if;
  -- Membership is checked against the organization on the row that was just
  -- read, never against one the caller sent. This is the guard the audit of
  -- 2026-09-16 found missing on two functions; it is not omitted here.
  if not public.is_org_member(parent.organization_id) then
    raise exception 'not a member of this workspace' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'p_rows must be a JSON array' using errcode = '22023';
  end if;

  insert into public.translation_cache (
    project_id, organization_id, locale,
    translation_key, source_text, translated_text
  )
  select
    p_project_id,
    parent.organization_id,
    p_locale,
    row_data ->> 'translation_key',
    row_data ->> 'source_text',
    row_data ->> 'translated_text'
  from jsonb_array_elements(p_rows) as row_data
  where row_data ->> 'translation_key' is not null
    and row_data ->> 'source_text' is not null
    and row_data ->> 'translated_text' is not null
  on conflict (project_id, locale, translation_key) do update
    set source_text = excluded.source_text,
        translated_text = excluded.translated_text,
        updated_at = now();

  get diagnostics written = row_count;
  return written;
end;
$$;

-- `anon` is named explicitly, and that is not belt-and-braces.
-- `revoke ... from public` does NOT remove Supabase's default grant to the
-- `anon` role, because that is a direct grant rather than one held through
-- PUBLIC. Written without it, both functions in this migration came back from
-- `get_advisors` as callable unauthenticated while every older function in the
-- schema did not — the repo's existing migrations all say `from public, anon`.
-- Not exploitable, since the membership guard refuses `anon` anyway, but a
-- guard is not a reason to leave the door open.
revoke execute on function public.save_translation_cache(uuid, text, jsonb)
  from public, anon;
grant execute on function public.save_translation_cache(uuid, text, jsonb)
  to authenticated;

/**
 * Drop what a merged pull request has delivered.
 *
 * Not automatic, and deliberately so: the product does not learn that a pull
 * request merged. Called when a run completes successfully, for the keys that
 * run committed — at that point the repository carries them and `pendingKeys`
 * will never ask again, so the rows are dead weight.
 *
 * Failing to call it costs storage and nothing else. That is the property this
 * table is designed around: every way it can go wrong is a wasted row, never a
 * wrong translation.
 */
create or replace function public.clear_translation_cache(
  p_project_id uuid,
  p_locales text[]
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  parent public.projects;
  removed integer;
begin
  select * into parent from public.projects where id = p_project_id;
  if parent.id is null then
    raise exception 'project not found' using errcode = '42704';
  end if;
  if not public.is_org_member(parent.organization_id) then
    raise exception 'not a member of this workspace' using errcode = '42501';
  end if;

  delete from public.translation_cache
   where project_id = p_project_id
     and locale = any (p_locales);

  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke execute on function public.clear_translation_cache(uuid, text[])
  from public, anon;
grant execute on function public.clear_translation_cache(uuid, text[])
  to authenticated;

comment on table public.translation_cache is
  'Model output bought but not yet delivered, so a run cut off by the platform timeout can resume instead of paying twice. A cache: losing it costs money, never correctness.';
