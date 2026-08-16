# Database

Postgres on Supabase, project `localize-infra` (`aguwalokxfgtqbzmdjbs`), region
**eu-west-3 (Paris)**. The region is a requirement, not a default: invariant 5
puts customer data in the EU.

This is a **second** Supabase project on the same organisation. The first one
belongs to ReFrame — its migrations are `reframe_core_schema` and it already has
a `public.projects` table. Sharing it would have collided on that table and, more
seriously, shared one `auth.users` pool between two products, so a signup in one
would have created a user visible to the other.

## What is in here

`migrations/` is the source of truth (invariant 1: Git, not Postgres). Applied in
filename order. Nothing here stores a translation — these tables record who owns
what; the translated strings stay in the customer's repository.

| Migration | What it does |
|---|---|
| `…000100_tenancy_core` | `organizations`, `organization_members`, `projects` |
| `…000200_tenancy_rls`  | RLS, policies, membership triggers, last-owner guard |
| `…000300_lock_trigger_functions` | Revokes RPC access to trigger functions |
| `…000400_create_organization_rpc` | `create_organization()` — see below |

## Creating an organization

Call `create_organization(name, slug)`. **Do not `INSERT` directly.**

`INSERT ... RETURNING` applies the SELECT policy to the row it returns, and the
creator does not become a member until the AFTER INSERT trigger has run — so the
insert succeeds and the read-back is denied. supabase-js requests the inserted
row by default, so a direct insert fails on the first call a customer makes.

## Verifying isolation

`tests/tenant-isolation.sql` creates two users and asserts neither can read or
write the other's rows. It ends with a deliberate `RAISE` so the fixtures roll
back; the results come out in the error message. Last run — all 13 assertions
passed:

```
creator-role=owner · A-orgs=1 · B-orgs=1
B-sees-A-org=0 · B-sees-A-proj=0 · B-sees-A-members=0
B-write-into-A-blocked=t · B-selfjoin-A-blocked=t · B-rename-A-blocked=t
B-delete-A-proj-blocked=t · B-delete-A-org-blocked=t
```

It is **not** in `npm run gates`: that needs a database connection in CI, which
needs secrets this repository does not have yet. Run it by hand and paste the
output into any pull request that touches a policy.

## Advisors

`get_advisors` is mandatory after DDL (CLAUDE.md). Current state: two WARN, both
deliberate — `is_org_member` and `org_role` are callable by `authenticated`
because RLS policies are evaluated with the caller's privileges, and both answer
only about `auth.uid()`, so a caller learns nothing they did not already know.
Every other advisor finding has been fixed.
