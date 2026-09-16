-- Binding a GitHub installation to a workspace is now something only the
-- server can do.
--
-- Two defects, one fix.
--
-- 1. **Any signed-in user could write another workspace's GitHub link.** The
--    guard was
--
--        if public.org_role(p_organization_id) not in ('owner', 'admin') then
--
--    and org_role returns NULL for a non-member. `NULL not in (…)` is NULL, and
--    a PL/pgSQL IF does not take a NULL branch — so the only callers the guard
--    let through unchecked were the ones it existed to stop. Reproduced on the
--    development database on 2026-09-16: a user outside workspace A called
--    `link_github_installation` for A and a row was written
--    (`rows-written-into-A=1`); `unlink_github_installation` deleted A's link
--    the same way. A member was refused, because 'member' is a real value, which
--    is why role-permissions.sql never saw it. Production held one link, made by
--    its workspace's owner through OAuth, so there is no sign it was used.
--
-- 2. **Even a correct role check proved the wrong thing.** It established that
--    the caller administers *their* workspace, not that they control the
--    installation id they pass. That proof — asking GitHub, with the user's own
--    token, which installations they can reach — happens only in apps/web's
--    OAuth callback, and a direct `rpc/link_github_installation` skipped it.
--
-- So the function is no longer callable by `authenticated` at all. The callback
-- verifies ownership, then writes with the service-role key, passing the user
-- it verified. The function checks that user's role itself, explicitly and
-- NULL-safely, because under the service role `auth.uid()` is NULL and a check
-- built on it would pass everyone.
--
-- Rollout consequence: until SUPABASE_SERVICE_ROLE_KEY is set on the web
-- deployment, connecting a *new* GitHub account fails closed. Existing links
-- are read under RLS and are unaffected.

drop function if exists public.link_github_installation(uuid, bigint, text, text);
drop function if exists public.unlink_github_installation(uuid);

create function public.link_github_installation(
  p_organization_id uuid,
  p_installation_id bigint,
  p_account_login text,
  p_account_type text,
  p_user_id uuid
)
returns public.organization_github_installations
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  acting_role public.organization_role;
  linked public.organization_github_installations;
begin
  select m.role into acting_role
    from public.organization_members m
   where m.organization_id = p_organization_id
     and m.user_id = p_user_id;

  -- NULL — no user given, or not a member — must refuse. It is tested first
  -- because `NULL not in (…)` is NULL, and that is the defect this replaces.
  if acting_role is null or acting_role not in ('owner', 'admin') then
    raise exception 'only an owner or admin can connect GitHub'
      using errcode = '42501';
  end if;

  insert into public.organization_github_installations as existing (
    organization_id, installation_id, account_login, account_type, connected_by
  )
  values (
    p_organization_id, p_installation_id, p_account_login, p_account_type,
    p_user_id
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

-- Nothing in the product calls this today. It gets the same shape rather than
-- being left callable with the guard that let a non-member delete a link.
create function public.unlink_github_installation(
  p_organization_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  acting_role public.organization_role;
begin
  select m.role into acting_role
    from public.organization_members m
   where m.organization_id = p_organization_id
     and m.user_id = p_user_id;

  if acting_role is null or acting_role not in ('owner', 'admin') then
    raise exception 'only an owner or admin can disconnect GitHub'
      using errcode = '42501';
  end if;

  delete from public.organization_github_installations
   where organization_id = p_organization_id;
end;
$$;

revoke execute on function
  public.link_github_installation(uuid, bigint, text, text, uuid)
  from public, anon, authenticated;
revoke execute on function
  public.unlink_github_installation(uuid, uuid)
  from public, anon, authenticated;

grant execute on function
  public.link_github_installation(uuid, bigint, text, text, uuid)
  to service_role;
grant execute on function
  public.unlink_github_installation(uuid, uuid)
  to service_role;
