-- Where this run's locale files live, remembered for the approval that follows.
--
-- The path is discovered by framework detection, against a checkout, during
-- the run. Approval happens later, in a different request, with no checkout in
-- reach — so it had nothing to go on and fell back to a hardcoded
-- 'src/locales'. On any project detected elsewhere (the fixture repository this
-- product's own landing page links to uses 'locales/') approving would have
-- committed a second, parallel tree of locale files rather than updating the
-- real one. The pull request would have been wrong in a way that looks right.
--
-- Nullable because every run created before this column existed has no answer,
-- and inventing one would repeat the same mistake with a different default.
alter table public.runs add column if not exists locales_dir text;

-- Recreated rather than overloaded: two signatures differing by a trailing
-- optional argument make `record_run_translations(...)` ambiguous to PostgREST,
-- and the older one has no callers left.
drop function if exists public.record_run_translations(uuid, jsonb);

create or replace function public.record_run_translations(
  p_run_id uuid,
  p_rows jsonb,
  p_locales_dir text default null
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

  -- Stamped here because this is the one call that happens while the path is
  -- still known: the run is holding the checkout open as it writes these rows.
  if p_locales_dir is not null and length(trim(p_locales_dir)) > 0 then
    update public.runs set locales_dir = p_locales_dir where id = parent.id;
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

revoke execute on function public.record_run_translations(uuid, jsonb, text) from public, anon;
grant execute on function public.record_run_translations(uuid, jsonb, text) to authenticated;
