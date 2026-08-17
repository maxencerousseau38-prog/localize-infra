-- A GitHub App installation per organization.
--
-- This is what turns the product from an operator demo into something a
-- customer can use. Until now one installation id lived in the environment and
-- its token reached every repository it had ever been granted, regardless of
-- who was asking — so connecting a repository had to be restricted to
-- operators. With the installation recorded per organization, a customer's
-- token reaches their repositories and nobody else's.
create table public.organization_github_installations (
  organization_id uuid primary key
    references public.organizations (id) on delete cascade,

  -- GitHub's identifier for this installation. Unique globally: one
  -- installation belongs to exactly one account, and letting two workspaces
  -- claim the same one would let either act as the other.
  installation_id bigint not null unique,

  -- The GitHub account the App was installed on, for display. Stored rather
  -- than fetched every render, and refreshed when the installation is.
  account_login text not null,
  account_type text not null check (account_type in ('User', 'Organization')),

  connected_by uuid references auth.users (id) on delete set null,
  connected_at timestamptz not null default now()
);

alter table public.organization_github_installations enable row level security;

-- Members may see whether their workspace is connected and to whom.
create policy org_github_installations_select_member
  on public.organization_github_installations
  for select to authenticated
  using (public.is_org_member(organization_id));

-- No insert, update or delete policy. The installation id arrives from
-- GitHub's redirect and is written by the callback through a definer function
-- that verifies the caller actually controls the installation. A client-writable
-- row here would let a member point their workspace at somebody else's
-- installation and read repositories through it.

create or replace function public.link_github_installation(
  p_organization_id uuid,
  p_installation_id bigint,
  p_account_login text,
  p_account_type text
)
returns public.organization_github_installations
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  linked public.organization_github_installations;
begin
  -- Owners and admins only. A member being able to rebind the workspace's
  -- GitHub connection is a way to redirect where its pull requests land.
  if public.org_role(p_organization_id) not in ('owner', 'admin') then
    raise exception 'only an owner or admin can connect GitHub'
      using errcode = '42501';
  end if;

  insert into public.organization_github_installations as existing (
    organization_id, installation_id, account_login, account_type, connected_by
  )
  values (
    p_organization_id, p_installation_id, p_account_login, p_account_type,
    auth.uid()
  )
  on conflict (organization_id) do update set
    installation_id = excluded.installation_id,
    account_login = excluded.account_login,
    account_type = excluded.account_type,
    connected_by = excluded.connected_by,
    connected_at = now()
  returning * into linked;

  return linked;
end;
$$;

create or replace function public.unlink_github_installation(p_organization_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.org_role(p_organization_id) not in ('owner', 'admin') then
    raise exception 'only an owner or admin can disconnect GitHub'
      using errcode = '42501';
  end if;

  delete from public.organization_github_installations
   where organization_id = p_organization_id;
end;
$$;

revoke execute on function public.link_github_installation(uuid, bigint, text, text) from public, anon;
revoke execute on function public.unlink_github_installation(uuid) from public, anon;
grant execute on function public.link_github_installation(uuid, bigint, text, text) to authenticated;
grant execute on function public.unlink_github_installation(uuid) to authenticated;
