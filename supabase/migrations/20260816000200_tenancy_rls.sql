-- Row-level security for the tenancy core.
--
-- The membership lookup is SECURITY DEFINER on purpose. A policy on
-- organization_members that queried organization_members would recurse; running
-- the lookup as the definer bypasses RLS on that inner read and terminates.
-- `search_path` is pinned because a SECURITY DEFINER function that resolves
-- unqualified names against a caller-controlled path is a privilege-escalation
-- vector, not a style preference.

create or replace function public.is_org_member(org uuid)
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = org
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.org_role(org uuid)
returns public.organization_role
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select m.role
  from public.organization_members m
  where m.organization_id = org
    and m.user_id = auth.uid();
$$;

revoke execute on function public.is_org_member(uuid) from public, anon;
revoke execute on function public.org_role(uuid) from public, anon;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.org_role(uuid) to authenticated;

-- Creating an organization makes you its owner, in the same transaction.
--
-- Without this the bootstrap needs an INSERT policy on organization_members
-- permissive enough to let a user add themselves to an organization — which is
-- precisely the hole this table exists to close. A trigger closes it instead:
-- membership is granted by the database, never asked for by the client.
create or replace function public.handle_new_organization()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.organization_members (organization_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$$;

create trigger on_organization_created
  after insert on public.organizations
  for each row execute function public.handle_new_organization();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger organizations_touch_updated_at
  before update on public.organizations
  for each row execute function public.touch_updated_at();

create trigger projects_touch_updated_at
  before update on public.projects
  for each row execute function public.touch_updated_at();

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.projects enable row level security;

-- Organizations -------------------------------------------------------------
create policy organizations_select_member on public.organizations
  for select to authenticated
  using (public.is_org_member(id));

-- created_by must be the caller: otherwise a user could create an organization
-- owned by someone else and, via the trigger, grant them a role they never
-- asked for.
create policy organizations_insert_self on public.organizations
  for insert to authenticated
  with check (created_by = (select auth.uid()));

create policy organizations_update_admin on public.organizations
  for update to authenticated
  using (public.org_role(id) in ('owner', 'admin'))
  with check (public.org_role(id) in ('owner', 'admin'));

create policy organizations_delete_owner on public.organizations
  for delete to authenticated
  using (public.org_role(id) = 'owner');

-- Membership ----------------------------------------------------------------
create policy organization_members_select_member on public.organization_members
  for select to authenticated
  using (public.is_org_member(organization_id));

create policy organization_members_insert_admin on public.organization_members
  for insert to authenticated
  with check (public.org_role(organization_id) in ('owner', 'admin'));

create policy organization_members_update_admin on public.organization_members
  for update to authenticated
  using (public.org_role(organization_id) in ('owner', 'admin'))
  with check (public.org_role(organization_id) in ('owner', 'admin'));

-- A member may remove themselves; an admin may remove anyone. The last owner
-- is protected by a trigger below rather than by policy, because a policy
-- cannot see the rest of the table cheaply.
create policy organization_members_delete on public.organization_members
  for delete to authenticated
  using (
    user_id = (select auth.uid())
    or public.org_role(organization_id) in ('owner', 'admin')
  );

-- Projects ------------------------------------------------------------------
create policy projects_select_member on public.projects
  for select to authenticated
  using (public.is_org_member(organization_id));

create policy projects_insert_member on public.projects
  for insert to authenticated
  with check (public.is_org_member(organization_id));

create policy projects_update_member on public.projects
  for update to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy projects_delete_admin on public.projects
  for delete to authenticated
  using (public.org_role(organization_id) in ('owner', 'admin'));

-- An organization must keep at least one owner. Enforced as a constraint
-- trigger so it also catches a role downgrade, not only a delete.
create or replace function public.forbid_last_owner_removal()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  remaining int;
  org uuid := coalesce(old.organization_id, new.organization_id);
begin
  select count(*) into remaining
  from public.organization_members m
  where m.organization_id = org and m.role = 'owner';

  if remaining = 0 then
    raise exception 'an organization must keep at least one owner';
  end if;
  return null;
end;
$$;

create constraint trigger organization_members_keep_an_owner
  after delete or update on public.organization_members
  deferrable initially deferred
  for each row execute function public.forbid_last_owner_removal();
