-- Runs: what the pipeline did, and what it cost.
--
-- A run is the unit a customer asks about when something goes wrong, so it is
-- recorded before the work starts and updated as it progresses. The states are
-- explicit rather than inferred from which columns happen to be null.
--
-- Still invariant 1: no translated strings are stored here. A run records
-- counts, status and where the pull request went. The strings live in the
-- customer's repository, which is the whole product.
create type public.run_status as enum (
  'queued',
  'running',
  'succeeded',
  'partial',
  'failed'
);

create type public.run_stage as enum (
  'detect',
  'extract',
  'translate',
  'escalate',
  'pull_request'
);

create table public.runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,

  status public.run_status not null default 'queued',
  -- The furthest stage reached. On a failure this is where it stopped, which
  -- is the first question anyone asks.
  stage public.run_stage not null default 'detect',

  -- Who asked for it. Kept when the user is deleted so the history stays
  -- readable rather than developing holes.
  triggered_by uuid references auth.users (id) on delete set null,

  framework text,
  source_locale text,
  target_locales text[] not null default '{}',

  keys_extracted int not null default 0,
  keys_translated int not null default 0,
  locales_succeeded int not null default 0,
  locales_failed int not null default 0,

  -- Verbatim provider or GitHub output. Never paraphrased: a customer
  -- comparing this against their own logs must see the same string.
  error text,

  pr_url text,
  pr_number int,
  branch text,

  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create index runs_project_id_created_at_idx
  on public.runs (project_id, created_at desc);
create index runs_organization_id_created_at_idx
  on public.runs (organization_id, created_at desc);

alter table public.runs enable row level security;

-- Reads follow membership, exactly like projects.
create policy runs_select_member on public.runs
  for select to authenticated
  using (public.is_org_member(organization_id));

-- Writes are the server's, through the service path. No client-side insert
-- policy: a run is a record of work the server did, and a row a client could
-- write is a claim rather than a record.
--
-- The organization_id is denormalised from the project so this policy does not
-- have to join, and a trigger keeps the two honest rather than trusting the
-- caller to pass a matching pair.
create or replace function public.runs_enforce_organization()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  owner_org uuid;
begin
  select organization_id into owner_org
  from public.projects where id = new.project_id;

  if owner_org is null then
    raise exception 'project % does not exist', new.project_id;
  end if;
  if new.organization_id is distinct from owner_org then
    raise exception 'run organization does not match its project';
  end if;
  return new;
end;
$$;

create trigger runs_enforce_organization_trigger
  before insert or update on public.runs
  for each row execute function public.runs_enforce_organization();

revoke execute on function public.runs_enforce_organization() from public, anon, authenticated;
