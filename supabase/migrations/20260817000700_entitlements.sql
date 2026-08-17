-- What a workspace is entitled to.
--
-- Shaped by two promises the marketing site already makes in public, which the
-- product may not contradict:
--
--   "Public repositories: Free. Unlimited, permanently. No language cap, no
--    string cap, no seat cap, no trial clock."
--   "Flat pricing, never metered by words, characters, keys or seats."
--
-- So there is no run counter, no key counter and no seat counter here, and
-- there is no quota of any kind on public repositories. Adding one would make
-- /pricing a lie, and invariant 3 forbids metered billing outright.
--
-- The one line the site does draw is public versus private: everything free and
-- unlimited is said about public repositories. Private repositories are
-- therefore the entitlement, and it is a boolean rather than a number —
-- a flat subscription grants a capability, it does not meter one.
create type public.plan as enum ('free', 'pro');

create table public.organization_entitlements (
  organization_id uuid primary key
    references public.organizations (id) on delete cascade,
  plan public.plan not null default 'free',

  -- Denormalised from the plan so the check is one column read and so a
  -- workspace can be granted access without inventing a plan for it — an
  -- operator's own workspace, a design partner, a support case.
  private_repositories boolean not null default false,

  -- Where the entitlement came from. Null until Stripe exists; a human note
  -- otherwise. Recorded because "why does this workspace have pro" is the
  -- first question anyone asks about a billing bug.
  granted_reason text,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,

  updated_at timestamptz not null default now()
);

alter table public.organization_entitlements enable row level security;

-- Members may read what their workspace is entitled to. There is no write
-- policy: entitlements are granted by Stripe webhooks or by a human with
-- database access, never by the client that benefits from them.
create policy org_entitlements_select_member
  on public.organization_entitlements
  for select to authenticated
  using (public.is_org_member(organization_id));

-- Every organization has an entitlement row from the moment it exists, so the
-- resolution below never has to distinguish "free" from "missing".
create or replace function public.handle_new_organization_entitlement()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.organization_entitlements (organization_id)
  values (new.id)
  on conflict (organization_id) do nothing;
  return new;
end;
$$;

create trigger on_organization_created_entitlement
  after insert on public.organizations
  for each row execute function public.handle_new_organization_entitlement();

revoke execute on function public.handle_new_organization_entitlement() from public, anon, authenticated;

-- Backfill the organizations that already exist.
insert into public.organization_entitlements (organization_id)
select id from public.organizations
on conflict (organization_id) do nothing;

/**
 * The single place entitlement is decided.
 *
 * Callers ask this rather than reading the table, so the rule lives in one
 * place and a surface cannot accidentally implement a more generous version of
 * it. Returns false for a workspace the caller cannot see, which is the same
 * answer as "not entitled" and leaks nothing.
 */
create or replace function public.may_use_private_repositories(org uuid)
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select coalesce(
    (select e.private_repositories
       from public.organization_entitlements e
      where e.organization_id = org
        and public.is_org_member(org)),
    false
  );
$$;

revoke execute on function public.may_use_private_repositories(uuid) from public, anon;
grant execute on function public.may_use_private_repositories(uuid) to authenticated;
