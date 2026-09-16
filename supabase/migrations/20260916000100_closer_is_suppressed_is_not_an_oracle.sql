-- closer_is_suppressed answered for any organization, to anyone signed in.
--
-- It is SECURITY DEFINER, so it reads closer_suppressions past RLS, and it had
-- no guard: `rpc/closer_is_suppressed` with another workspace's id and an
-- address returned whether that address had opted out of *their* outreach. A
-- boolean, and it needs the victim's organization id, but it is a read of one
-- tenant's personal data by another, which is what RLS exists to rule out.
-- Found by the Supabase security advisor's definer-function lint and a
-- function-by-function audit on 2026-09-16; every other definer function in the
-- schema checks membership against the row it touches.
--
-- Why it raises rather than returns false. Every caller uses the answer to
-- decide whether contacting someone is allowed. A guard that answered `false`
-- to an unauthorised caller would answer "not suppressed", which is the unsafe
-- value; a caller that ever reached it without the right identity would be told
-- it may write to somebody who asked not to be written to. An exception stops
-- that caller instead.
--
-- Why the guard keys on `auth.role()`. The function's callers are the other
-- closer_* definer functions, which have already checked membership on the same
-- organization and run with the caller's JWT still in place — so a member keeps
-- passing. Owner-level contexts (migrations, the SQL test harness before it
-- assumes a role, service_role) carry no `authenticated` claim and are trusted
-- as they are everywhere else. `anon` is removed outright below: it has no
-- `auth.uid()` and nothing it could legitimately ask this.

create or replace function public.closer_is_suppressed(
  p_organization_id uuid,
  p_domain text,
  p_email text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.role() = 'authenticated'
     and not public.is_org_member(p_organization_id) then
    raise exception 'not a member of this workspace' using errcode = '42501';
  end if;

  return exists (
    select 1 from public.closer_suppressions s
    where s.organization_id = p_organization_id
      and (
        (
          p_domain is not null
          and public.closer_canonical_domain(s.domain)
              = public.closer_canonical_domain(p_domain)
        )
        or (
          p_email is not null
          and public.closer_canonical_address(s.email)
              = public.closer_canonical_address(p_email)
        )
        or (
          p_email is not null
          and public.closer_canonical_domain(s.domain)
              = public.closer_address_domain(p_email)
        )
      )
  );
end;
$$;

revoke execute on function public.closer_is_suppressed(uuid, text, text)
  from public, anon;
grant execute on function public.closer_is_suppressed(uuid, text, text)
  to authenticated, service_role;

-- The three canonicalisation helpers had a role-mutable search_path (advisor
-- lint 0011). They are pure and fully qualify the one function they call, so
-- pinning the path changes nothing they resolve today and removes the ability
-- for a caller's search_path to change it tomorrow.
alter function public.closer_canonical_domain(text)
  set search_path = public, pg_temp;
alter function public.closer_canonical_address(text)
  set search_path = public, pg_temp;
alter function public.closer_address_domain(text)
  set search_path = public, pg_temp;
