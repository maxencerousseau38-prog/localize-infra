-- Tenant isolation proof.
--
-- Run against any environment that has the tenancy migrations applied. It
-- creates two users, gives each an organization, and asserts that neither can
-- read or write the other's rows. The final RAISE is deliberate: it aborts the
-- transaction so the fixtures roll back and the database is left exactly as it
-- was found. Read the results out of the error message.
--
-- Not yet wired into `npm run gates` — that needs a database connection in CI,
-- which needs secrets this repository does not have. Until then it is run by
-- hand and its output is recorded in the pull request that changes any policy.
do $$
declare
  ua uuid := '11111111-1111-1111-1111-111111111111';
  ub uuid := '22222222-2222-2222-2222-222222222222';
  oa public.organizations; ob public.organizations;
  org_a uuid; proj_a uuid;
  n int; role_a text; r text := ''; ok boolean;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
  values
    (ua,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','a@test.invalid','',now(),now()),
    (ub,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','b@test.invalid','',now(),now())
  on conflict (id) do nothing;

  -- Claims must be set while still the owner role; after `set role
  -- authenticated` the GUC is no longer settable and auth.uid() stays null.
  perform set_config('request.jwt.claims', json_build_object('sub',ua,'role','authenticated')::text, true);
  perform set_config('role','authenticated',true);

  oa := public.create_organization('Org A','org-a');
  org_a := oa.id;
  r := r || format('A create_organization returned row=%s(want t); ', org_a is not null);

  insert into public.projects (organization_id,name,slug) values (org_a,'Proj A','proj-a') returning id into proj_a;
  r := r || format('A insert+returning project=%s(want t); ', proj_a is not null);

  select role::text into role_a from public.organization_members where organization_id=org_a and user_id=ua;
  r := r || format('creator-role=%s(want owner); ', coalesce(role_a,'NULL'));
  select count(*) into n from public.organizations; r := r || format('A-orgs=%s(want 1); ', n);

  perform set_config('role','postgres',true);
  perform set_config('request.jwt.claims', json_build_object('sub',ub,'role','authenticated')::text, true);
  perform set_config('role','authenticated',true);

  ob := public.create_organization('Org B','org-b');

  select count(*) into n from public.organizations;                r := r || format('B-orgs=%s(want 1); ', n);
  select count(*) into n from public.organizations where id=org_a; r := r || format('B-sees-A-org=%s(want 0); ', n);
  select count(*) into n from public.projects where id=proj_a;     r := r || format('B-sees-A-proj=%s(want 0); ', n);
  select count(*) into n from public.organization_members where organization_id=org_a;
                                                                   r := r || format('B-sees-A-members=%s(want 0); ', n);

  ok := false;
  begin insert into public.projects (organization_id,name,slug) values (org_a,'Hostile','hostile');
  exception when others then ok := true; end;
  r := r || format('B-write-into-A-blocked=%s(want t); ', ok);

  ok := false;
  begin insert into public.organization_members (organization_id,user_id,role) values (org_a,ub,'owner');
  exception when others then ok := true; end;
  r := r || format('B-selfjoin-A-blocked=%s(want t); ', ok);

  begin update public.organizations set name='Stolen' where id=org_a; get diagnostics n = row_count; ok := (n=0);
  exception when others then ok := true; end;
  r := r || format('B-rename-A-blocked=%s(want t); ', ok);

  begin delete from public.projects where id=proj_a; get diagnostics n = row_count; ok := (n=0);
  exception when others then ok := true; end;
  r := r || format('B-delete-A-proj-blocked=%s(want t); ', ok);

  begin delete from public.organizations where id=org_a; get diagnostics n = row_count; ok := (n=0);
  exception when others then ok := true; end;
  r := r || format('B-delete-A-org-blocked=%s(want t); ', ok);

  raise exception 'ISOLATION >> %', r;
end $$;
