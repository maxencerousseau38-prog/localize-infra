-- Tenancy core: organizations, membership, projects.
--
-- This is the root of the dependency graph. Every customer-owned row in this
-- product hangs off an organization, and the isolation guarantee is enforced
-- here in the database rather than in application code — a route that forgets
-- to scope a query is a bug, but a route that forgets to scope a query against
-- RLS returns nothing rather than someone else's data.
--
-- Invariant 1 (CLAUDE.md): Git is the source of truth, Postgres is index and
-- cache. Nothing here stores a translation. These tables record who owns what
-- and which repository a project points at; the translated strings continue to
-- live in the customer's repository.

create type public.organization_role as enum ('owner', 'admin', 'member');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 80),
  -- Slug is global rather than per-user: it appears in URLs and must resolve
  -- to exactly one organization.
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 2 and 48),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Composite primary key: a user holds exactly one role per organization, and
-- the pair is the natural identity. A surrogate id would permit duplicates.
create table public.organization_members (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.organization_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index organization_members_user_id_idx
  on public.organization_members (user_id);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  slug text not null
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 2 and 48),
  -- BCP-47 is checked for shape only. Validating the full registry belongs in
  -- the application, which already owns a locale list.
  source_locale text not null default 'en'
    check (source_locale ~ '^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$'),
  target_locales text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create index projects_organization_id_idx
  on public.projects (organization_id);
