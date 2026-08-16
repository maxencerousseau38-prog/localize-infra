-- Organization creation is a transaction with an invariant, so it gets a
-- function rather than a bare INSERT.
--
-- The bug this fixes is not theoretical and not a test artifact. `INSERT ...
-- RETURNING` applies the SELECT policy to the row it hands back, and the
-- creator does not become a member until the AFTER INSERT trigger has run —
-- so the insert succeeds and the read-back is denied. supabase-js asks for the
-- inserted row by default, which means every client doing the obvious thing
-- would have seen "new row violates row-level security policy" on the very
-- first call a customer ever makes.
--
-- The alternative fix was widening the SELECT policy to `created_by =
-- auth.uid()`, which works and quietly grants the creator permanent read on an
-- organization they may later be removed from. A function keeps the policy
-- strict: it runs as definer, so it can read the row back regardless, and it
-- makes "an organization always has an owner" a property of creation rather
-- than a hope about triggers.
create or replace function public.create_organization(p_name text, p_slug text)
returns public.organizations
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
  created public.organizations;
begin
  if caller is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  insert into public.organizations (name, slug, created_by)
  values (p_name, p_slug, caller)
  returning * into created;

  -- Membership is added by on_organization_created, which fires before this
  -- function returns. Asserting it rather than assuming it: if the trigger is
  -- ever dropped, this fails loudly instead of leaving an ownerless org.
  if not exists (
    select 1 from public.organization_members
    where organization_id = created.id and user_id = caller and role = 'owner'
  ) then
    raise exception 'organization created without an owner';
  end if;

  return created;
end;
$$;

revoke execute on function public.create_organization(text, text) from public, anon;
grant execute on function public.create_organization(text, text) to authenticated;

comment on function public.create_organization(text, text) is
  'Creates an organization owned by the caller and returns it. Use instead of a direct INSERT: a bare INSERT ... RETURNING is denied by the SELECT policy because membership does not exist yet.';
