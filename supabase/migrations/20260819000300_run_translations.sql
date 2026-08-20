-- A run's proposed translations, held between review and approval.
--
-- This is the difference between a review screen and a mock-up of one. The
-- brief asks that a developer see exactly what is about to change in their
-- repository; if approving re-ran the model, what got committed would be a
-- fresh sample from a probability distribution and not the thing anybody
-- looked at. So the proposal is written down once and committed verbatim.
--
-- Invariant 1 is intact: Postgres is the index/cache, git stays the source of
-- truth. These rows are a proposal awaiting a decision, and they die with the
-- run that made them. Nothing reads them to serve a translation at runtime.
create type public.translation_origin as enum (
  'model',      -- newly translated in this run
  'preserved',  -- already in the repository; kept, never overwritten
  'resolved'    -- an ambiguity a human answered
);

create table public.run_translations (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,

  locale text not null,
  translation_key text not null,
  source_text text not null,
  proposed_text text not null,
  origin public.translation_origin not null default 'model',

  created_at timestamptz not null default now(),
  unique (run_id, locale, translation_key)
);

create index run_translations_run_locale_idx
  on public.run_translations (run_id, locale);

alter table public.run_translations enable row level security;

create policy run_translations_select_member on public.run_translations
  for select to authenticated
  using (public.is_org_member(organization_id));

/**
 * Records a run's proposals in one call.
 *
 * A single statement rather than a row per key: a batch of 400 strings across
 * four locales is 1,600 round trips otherwise, inside a request that is
 * already holding a repository checkout open.
 */
create or replace function public.record_run_translations(
  p_run_id uuid,
  p_rows jsonb
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  parent public.runs;
  written integer;
begin
  select * into parent from public.runs where id = p_run_id;
  if parent.id is null then
    raise exception 'run not found' using errcode = '42704';
  end if;
  if not public.is_org_member(parent.organization_id) then
    raise exception 'not a member of this workspace' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'p_rows must be a JSON array' using errcode = '22023';
  end if;

  insert into public.run_translations (
    run_id, project_id, organization_id,
    locale, translation_key, source_text, proposed_text, origin
  )
  select
    parent.id, parent.project_id, parent.organization_id,
    row_data->>'locale',
    row_data->>'translation_key',
    row_data->>'source_text',
    row_data->>'proposed_text',
    coalesce((row_data->>'origin')::public.translation_origin, 'model')
  from jsonb_array_elements(p_rows) as row_data
  on conflict (run_id, locale, translation_key) do update set
    proposed_text = excluded.proposed_text,
    origin = excluded.origin;

  get diagnostics written = row_count;
  return written;
end;
$$;

revoke execute on function public.record_run_translations(uuid, jsonb) from public, anon;
grant execute on function public.record_run_translations(uuid, jsonb) to authenticated;
