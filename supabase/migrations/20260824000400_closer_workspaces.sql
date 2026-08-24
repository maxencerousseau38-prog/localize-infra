-- Which workspaces have Closer.
--
-- A table of its own rather than a column on `organization_entitlements`, and
-- the distinction is not filing. That table is shaped by the pricing promises
-- the marketing site makes in public — plan, private repositories — and a
-- `closer` boolean sitting beside them would say that Closer is something a
-- customer could be sold. It is not: it is the operator's own sales tooling,
-- running in the same application because building a second one would mean a
-- second authentication, a second design system and a second deployment.
--
-- Not an environment variable either. This repository already shipped
-- `GITHUB_OPERATOR_EMAILS` — an allow-list described in three places as what
-- separated tenants, which had no callers and enforced nothing. A row that RLS
-- can join against is a control; a comma-separated string somebody has to
-- remember to read is a note.
create table public.closer_workspaces (
  organization_id uuid primary key
    references public.organizations (id) on delete cascade,
  -- Why this workspace has it. Recorded for the same reason
  -- `organization_entitlements.granted_reason` is: the first question anyone
  -- asks about an access surprise is where the access came from.
  note text,
  enabled_at timestamptz not null default now()
);

alter table public.closer_workspaces enable row level security;

/*
 * Members may see whether their own workspace has Closer, and nothing else.
 *
 * No write policy. Enabling Closer for a workspace is a decision made with
 * database access, not a request the client that benefits from it can make —
 * the same shape `organization_entitlements` uses, and for the same reason.
 */
create policy closer_workspaces_select_member on public.closer_workspaces
  for select to authenticated
  using (public.is_org_member(organization_id));
