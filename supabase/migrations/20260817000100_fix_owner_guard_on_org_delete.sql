-- The last-owner guard made organizations undeletable.
--
-- Deleting an organization cascades to organization_members, and the deferred
-- constraint trigger then counted zero owners and refused the whole
-- transaction. So `organizations_delete_owner` — a policy written specifically
-- to let an owner delete their workspace — could never once have succeeded.
--
-- Found by trying it, not by reading it: the delete failed with "an
-- organization must keep at least one owner", which is a true statement about
-- an organization that no longer exists.
--
-- The guard is about *membership* changes within a surviving organization. If
-- the organization itself is gone by the time the deferred trigger runs, there
-- is nothing left to own and nothing to protect.
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
  -- The trigger is DEFERRABLE INITIALLY DEFERRED, so by the time it runs the
  -- organization row is already gone in a cascading delete. That absence is
  -- the signal, and it is why this check has to come first.
  if not exists (select 1 from public.organizations o where o.id = org) then
    return null;
  end if;

  select count(*) into remaining
  from public.organization_members m
  where m.organization_id = org and m.role = 'owner';

  if remaining = 0 then
    raise exception 'an organization must keep at least one owner';
  end if;
  return null;
end;
$$;

revoke execute on function public.forbid_last_owner_removal() from public, anon, authenticated;
