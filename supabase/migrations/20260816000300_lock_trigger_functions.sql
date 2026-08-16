-- Trigger functions are not API.
--
-- Supabase exposes every function in `public` over PostgREST, so
-- `handle_new_organization` and `forbid_last_owner_removal` were reachable at
-- /rest/v1/rpc/... by anon and authenticated alike. Both are SECURITY DEFINER,
-- which is what makes that worth closing rather than shrugging at: they run as
-- the definer, and a trigger function invoked outside a trigger has null OLD
-- and NEW, so the failure mode is undefined rather than merely useless.
--
-- Revoking EXECUTE does not affect the triggers. A trigger runs its function
-- through the trigger mechanism, not through the calling role's privileges.
revoke execute on function public.handle_new_organization() from public, anon, authenticated;
revoke execute on function public.forbid_last_owner_removal() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;

-- `is_org_member` and `org_role` deliberately keep EXECUTE for authenticated.
--
-- The linter flags them too, and the flag is a false positive here for two
-- reasons. They are required: both are called from RLS policy expressions,
-- which are evaluated with the querying role's privileges, so revoking EXECUTE
-- would make every policy fail rather than deny. And they are safe: both are
-- parameterised on an organization but answer only about `auth.uid()` — the
-- caller learns whether *they* are a member and what *their* role is, which
-- they necessarily already know. Neither can be used to enumerate anyone else.
comment on function public.is_org_member(uuid) is
  'Membership test for RLS policies. Reports only on auth.uid(); safe to expose to authenticated.';
comment on function public.org_role(uuid) is
  'Role lookup for RLS policies. Reports only on auth.uid(); safe to expose to authenticated.';
