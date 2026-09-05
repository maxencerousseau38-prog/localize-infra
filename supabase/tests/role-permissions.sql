-- Role permission proof: what a member may do that an admin may do, and what
-- only the admin may do.
--
-- `deleteProject` (apps/web/src/app/[org]/projects/actions.ts) rests entirely on
-- one asymmetry: `projects_select_member` admits every member of the workspace,
-- `projects_delete_admin` admits only owners and admins. A member therefore
-- reads the project, passes the typed-name confirmation, deletes nothing, and
-- gets no error back — which is why the action counts the rows the delete
-- returned rather than trusting the absence of one.
--
-- That count is only correct if the asymmetry is real, and no test asserted it.
-- The end-to-end suite can prove the surface is hidden from a member; it cannot
-- reach the policy, because the form it would have to submit is precisely what
-- is not rendered. This is the layer that enforces it, so this is where it is
-- proven.
--
-- **The same user is used on both sides of the delete.** Only the role changes
-- between the two attempts. A blocked delete measured on one account and an
-- allowed delete measured on another would agree with any number of unrelated
-- explanations — a different workspace, a different project, no project at all.
--
-- Like the other proofs here this ends in a deliberate RAISE: the transaction
-- rolls back, the database is left as it was found, and the verdict is read
-- out of the error message by supabase/tests/run.sh.
do $$
declare
  owner_id  uuid := '33333333-3333-3333-3333-333333333333';
  member_id uuid := '44444444-4444-4444-4444-444444444444';
  o public.organizations;
  proj uuid;
  n int; r text := '';
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
  values
    (owner_id ,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','owner@test.invalid','',now(),now()),
    (member_id,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','member@test.invalid','',now(),now())
  on conflict (id) do nothing;

  -- Claims before the role switch: afterwards the GUC is no longer settable and
  -- auth.uid() stays null.
  perform set_config('request.jwt.claims', json_build_object('sub',owner_id,'role','authenticated')::text, true);
  perform set_config('role','authenticated',true);

  o := public.create_organization('Roles','roles-org');
  insert into public.projects (organization_id,name,slug)
  values (o.id,'Rolesub','rolesub') returning id into proj;

  -- Membership has no product path — no invite flow exists — so it is inserted
  -- as the owning role rather than through a function.
  perform set_config('role','postgres',true);
  insert into public.organization_members (organization_id,user_id,role)
  values (o.id, member_id, 'member');

  perform set_config('request.jwt.claims', json_build_object('sub',member_id,'role','authenticated')::text, true);
  perform set_config('role','authenticated',true);

  -- Visible. Asserted first because every claim below is about someone who can
  -- see this project: a member who saw nothing would make "cannot delete it"
  -- true for the wrong reason.
  select count(*) into n from public.projects where id=proj;
  r := r || format('member-sees-project=%s(want 1); ', n);

  -- And not merely a spectator. `projects_update_member` admits them, so the
  -- refusal below is about deletion specifically rather than about a member
  -- being locked out of the row altogether.
  update public.projects set name='Renamed by member' where id=proj;
  get diagnostics n = row_count;
  r := r || format('member-may-rename=%s(want 1); ', n);

  -- The refusal itself. No exception is raised: RLS narrows the statement, so
  -- the member deletes zero rows and Postgres reports success.
  delete from public.projects where id=proj;
  get diagnostics n = row_count;
  r := r || format('member-delete-affects=%s(want 0); ', n);

  select count(*) into n from public.projects where id=proj;
  r := r || format('project-survives-member=%s(want 1); ', n);

  -- Same user, same project, one role promotion apart.
  perform set_config('role','postgres',true);
  update public.organization_members set role='admin'
   where organization_id=o.id and user_id=member_id;

  perform set_config('request.jwt.claims', json_build_object('sub',member_id,'role','authenticated')::text, true);
  perform set_config('role','authenticated',true);

  delete from public.projects where id=proj;
  get diagnostics n = row_count;
  r := r || format('admin-delete-affects=%s(want 1); ', n);

  select count(*) into n from public.projects where id=proj;
  r := r || format('project-gone-after-admin=%s(want 0); ', n);

  raise exception 'ROLE-PERMISSIONS >> %', r;
end $$;
