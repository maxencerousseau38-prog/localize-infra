-- Personal CLI tokens: who can issue, see, revoke and resolve them.
--
-- The API trusts `resolve_cli_token` to say which workspace a request acts
-- for, and then acts through that workspace's GitHub installation. So the
-- claims proven here are the ones a leak would break: a token resolves to its
-- own workspace and nothing else, stops resolving the moment it is revoked,
-- expires, or its creator leaves, and the hash is never readable by a
-- signed-in user.
--
-- Like the other proofs, it ends in a deliberate RAISE that rolls everything
-- back; supabase/tests/run.sh reads the verdict.
do $$
declare
  owner_a  uuid := '55555555-5555-5555-5555-555555555555';
  member_a uuid := '66666666-6666-6666-6666-666666666666';
  owner_b  uuid := '77777777-7777-7777-7777-777777777777';
  oa public.organizations; ob public.organizations;
  hash_member text := repeat('a', 64);
  hash_owner  text := repeat('b', 64);
  hash_old    text := repeat('c', 64);
  tok_member uuid; tok_owner uuid; tok_old uuid;
  n int; ok boolean; r text := ''; resolved record; slug text;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
  values
    (owner_a ,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','ta-owner@test.invalid','',now(),now()),
    (member_a,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','ta-member@test.invalid','',now(),now()),
    (owner_b ,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','tb-owner@test.invalid','',now(),now())
  on conflict (id) do nothing;

  -- Workspace A with an owner and a member, workspace B with its own owner.
  perform set_config('request.jwt.claims', json_build_object('sub',owner_a,'role','authenticated')::text, true);
  perform set_config('role','authenticated',true);
  oa := public.create_organization('Tokens A','tokens-a');
  perform set_config('role','postgres',true);
  insert into public.organization_members (organization_id,user_id,role) values (oa.id, member_a, 'member');
  insert into public.organization_github_installations (organization_id, installation_id, account_login, account_type, connected_by)
  values (oa.id, 424242, 'tokens-a', 'Organization', owner_a);

  perform set_config('request.jwt.claims', json_build_object('sub',owner_b,'role','authenticated')::text, true);
  perform set_config('role','authenticated',true);
  ob := public.create_organization('Tokens B','tokens-b');

  -- ---- issuing -----------------------------------------------------------
  perform set_config('role','postgres',true);
  perform set_config('request.jwt.claims', json_build_object('sub',member_a,'role','authenticated')::text, true);
  perform set_config('role','authenticated',true);

  tok_member := public.create_cli_token(oa.id, 'laptop', hash_member, 'lit_aaaaaa');
  r := r || format('member-can-issue=%s(want t); ', tok_member is not null);

  select count(*) into n from public.cli_tokens where id = tok_member and expires_at > now() + interval '89 days';
  r := r || format('default-expiry-90-days=%s(want 1); ', n);

  ok := false;
  begin perform public.create_cli_token(oa.id, 'forever', repeat('d', 64), 'lit_dddddd', now() + interval '5 years');
  exception when others then ok := true; end;
  r := r || format('expiry-over-a-year-refused=%s(want t); ', ok);

  ok := false;
  begin perform public.create_cli_token(ob.id, 'intruder', repeat('e', 64), 'lit_eeeeee');
  exception when others then ok := true; end;
  r := r || format('non-member-cannot-issue=%s(want t); ', ok);

  -- The hash is not a readable column, even for the token's own creator.
  ok := false;
  begin perform token_hash from public.cli_tokens where id = tok_member;
  exception when others then ok := true; end;
  r := r || format('hash-not-readable=%s(want t); ', ok);

  select count(*) into n from public.cli_tokens where id = tok_member;
  r := r || format('member-sees-own-token=%s(want 1); ', n);

  ok := false;
  begin perform public.resolve_cli_token(hash_member);
  exception when others then ok := true; end;
  r := r || format('member-cannot-resolve=%s(want t); ', ok);

  -- ---- isolation ---------------------------------------------------------
  perform set_config('role','postgres',true);
  perform set_config('request.jwt.claims', json_build_object('sub',owner_b,'role','authenticated')::text, true);
  perform set_config('role','authenticated',true);

  select count(*) into n from public.cli_tokens where organization_id = oa.id;
  r := r || format('B-sees-A-tokens=%s(want 0); ', n);

  ok := false;
  begin perform public.revoke_cli_token(tok_member);
  exception when others then ok := true; end;
  r := r || format('B-cannot-revoke-A-token=%s(want t); ', ok);

  -- ---- resolution (as the server) ----------------------------------------
  perform set_config('role','postgres',true);
  select * into resolved from public.resolve_cli_token(hash_member);
  r := r || format('resolves-to-own-org=%s(want t); ', resolved.organization_id = oa.id);
  r := r || format('resolves-own-installation=%s(want 424242); ', resolved.installation_id);
  r := r || format('resolves-creator=%s(want t); ', resolved.user_id = member_a);
  select count(*) into n from public.cli_tokens where id = tok_member and last_used_at is not null;
  r := r || format('last-used-recorded=%s(want 1); ', n);

  select count(*) into n from public.resolve_cli_token(repeat('f', 64));
  r := r || format('unknown-hash-resolves-nothing=%s(want 0); ', n);

  -- ---- revocation --------------------------------------------------------
  -- The owner issues one; the member may not revoke it, the owner may revoke
  -- the member's.
  perform set_config('request.jwt.claims', json_build_object('sub',owner_a,'role','authenticated')::text, true);
  perform set_config('role','authenticated',true);
  tok_owner := public.create_cli_token(oa.id, 'ci', hash_owner, 'lit_bbbbbb');

  perform set_config('role','postgres',true);
  perform set_config('request.jwt.claims', json_build_object('sub',member_a,'role','authenticated')::text, true);
  perform set_config('role','authenticated',true);
  ok := false;
  begin perform public.revoke_cli_token(tok_owner);
  exception when others then ok := true; end;
  r := r || format('member-cannot-revoke-owner-token=%s(want t); ', ok);

  perform set_config('role','postgres',true);
  perform set_config('request.jwt.claims', json_build_object('sub',owner_a,'role','authenticated')::text, true);
  perform set_config('role','authenticated',true);
  perform public.revoke_cli_token(tok_member);

  perform set_config('role','postgres',true);
  select count(*) into n from public.resolve_cli_token(hash_member);
  r := r || format('revoked-resolves-nothing=%s(want 0); ', n);
  select count(*) into n from public.resolve_cli_token(hash_owner);
  r := r || format('other-token-still-resolves=%s(want 1); ', n);

  -- ---- expiry --------------------------------------------------------------
  insert into public.cli_tokens (organization_id, created_by, name, token_prefix, token_hash, created_at, expires_at)
  values (oa.id, owner_a, 'old', 'lit_cccccc', hash_old, now() - interval '2 days', now() - interval '1 day')
  returning id into tok_old;
  select count(*) into n from public.resolve_cli_token(hash_old);
  r := r || format('expired-resolves-nothing=%s(want 0); ', n);

  -- ---- leaving the workspace -----------------------------------------------
  -- The member issues a fresh token, it resolves, then the member is removed.
  perform set_config('request.jwt.claims', json_build_object('sub',member_a,'role','authenticated')::text, true);
  perform set_config('role','authenticated',true);
  perform public.create_cli_token(oa.id, 'second laptop', repeat('9', 64), 'lit_999999');
  perform set_config('role','postgres',true);
  select count(*) into n from public.resolve_cli_token(repeat('9', 64));
  r := r || format('fresh-token-resolves=%s(want 1); ', n);
  delete from public.organization_members where organization_id = oa.id and user_id = member_a;
  select count(*) into n from public.resolve_cli_token(repeat('9', 64));
  r := r || format('token-dies-with-membership=%s(want 0); ', n);

  raise exception 'CLI-TOKENS >> %', r;
end $$;
