-- Which repository a project points at.
--
-- Columns on projects rather than a repositories table: a project is exactly
-- one repository in this product, so a second table would model a relationship
-- that does not exist and invite the question of what a repository means
-- without a project.
--
-- Still no translations here (invariant 1). This records a pointer — owner,
-- name, branch — and the strings stay in the customer's repository.
alter table public.projects
  add column repository_owner text
    check (repository_owner is null or repository_owner ~ '^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$'),
  add column repository_name text
    check (repository_name is null or repository_name ~ '^[A-Za-z0-9._-]{1,100}$'),
  add column repository_branch text
    check (repository_branch is null or length(repository_branch) between 1 and 255),
  -- Recorded when the pointer was set, so a stale connection is visible as a
  -- date rather than inferred from silence.
  add column repository_connected_at timestamptz;

-- Owner and name travel together or not at all. A half-set pointer is a state
-- every reader downstream would have to handle, so it is made unrepresentable.
alter table public.projects
  add constraint projects_repository_is_whole
  check (
    (repository_owner is null and repository_name is null and repository_connected_at is null)
    or (repository_owner is not null and repository_name is not null and repository_connected_at is not null)
  );

comment on column public.projects.repository_owner is
  'GitHub owner. Set only through the operator-gated connection flow while the product uses a single shared App installation.';
