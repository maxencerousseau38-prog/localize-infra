# Database

Postgres on Supabase, region **eu-west-3 (Paris)**. The region is a requirement,
not a default: invariant 5 puts customer data in the EU, and the Vercel functions
that read these tables are pinned to `cdg1` for the same reason.

## Two projects, and why

| Purpose | Project | Ref |
|---|---|---|
| Development, acceptance tests | `localize-infra` | `aguwalokxfgtqbzmdjbs` |
| Production (`localize-infra-web.vercel.app`) | `localize-infra-prod` | `ijgheekdihgssktyweyy` |

They were one project until the split, and that was a real problem rather than
an untidiness. `seeds/dev-user.sql` writes an account whose password is
committed to this repository, and while the two shared a database that account
authenticated against the public deployment — verified, not theorised. RLS held
and bounded it to one fixture workspace, so it was a foothold rather than a
breach, but "NOT for production" written in a comment does not stop anything.

The organisation's free tier allows two active projects. The third slot was
freed by **pausing** the ReFrame project (`ngbxfpsfmjagauavbuhd`, empty — 0 rows
across all six tables). Pausing is reversible via `restore_project`; if ReFrame
needs it back, that is the button, and this repository then needs a plan for the
slot.

A first project on this organisation also belongs to ReFrame and already has a
`public.projects` table. Sharing it would have collided on that table and, more
seriously, shared one `auth.users` pool between two products, so a signup in one
would have created a user visible to the other.

## The production stamp

The production database is marked out of band:

```sql
comment on database postgres is 'localize-infra-production';
```

Out of band and **not** as a migration, deliberately: migrations replay into
development too, so a marker created by one could not tell the two apart.
`seeds/dev-user.sql` reads this stamp and refuses to run when it matches. A
database with no stamp is treated as development, which is the safe default —
the failure it permits requires someone to have forgotten the stamp *and* to be
seeding, whereas the opposite default would silently seed an unstamped
production database.

If you ever create another production database, stamp it in the same breath.

## What is in here

`migrations/` is the source of truth (invariant 1: Git, not Postgres). Applied in
filename order, and both projects carry all eleven. Nothing here stores a
translation — these tables record who owns what; the translated strings stay in
the customer's repository.

| Migration | What it does |
|---|---|
| `…000100_tenancy_core` | `organizations`, `organization_members`, `projects` |
| `…000200_tenancy_rls` | RLS, policies, membership triggers, last-owner guard |
| `…000300_lock_trigger_functions` | Revokes RPC access to trigger functions |
| `…000400_create_organization_rpc` | `create_organization()` — see below |
| `…000100_fix_owner_guard_on_org_delete` | The guard made organizations undeletable |
| `…000200_project_repository` | Which repository a project points at |
| `…000300_runs` | `runs`, plus the org/project consistency trigger |
| `…000400_run_rpcs` | `start_run()`, `finish_run()` |
| `…000500_constrain_run_pr_url` | `pr_url` reaches an `href`; the DB decides its shape |
| `…000600_org_github_installations` | A GitHub App installation per organization |
| `…000700_entitlements` | `plan`, `private_repositories`, `may_use_private_repositories()` |

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

Run it against **development**. It is not in `npm run gates`: that needs a
database connection in CI, which needs secrets this repository does not have yet.
Run it by hand and paste the output into any pull request that touches a policy.

## Advisors

`get_advisors` is mandatory after DDL (CLAUDE.md). Both projects currently report
the **same eight** WARNs, all one class:
`authenticated_security_definer_function_executable` — `create_organization`,
`start_run`, `finish_run`, `link_github_installation`,
`unlink_github_installation`, `may_use_private_repositories`, `is_org_member`
and `org_role` are callable by `authenticated`.

All eight are deliberate, and the reason is the same in each case: these
functions are the write path, they run as definer so the tables can stay closed
to direct writes, and every one of them performs its own membership or role
check before doing anything. `is_org_member` and `org_role` additionally *must*
keep EXECUTE — they are called from RLS policy expressions, which are evaluated
with the querying role's privileges, so revoking it would make every policy fail
rather than deny — and both answer only about `auth.uid()`, so a caller learns
nothing they did not already know.

Development additionally reports `auth_leaked_password_protection`. Production
does not currently report it; confirm it is actually enabled there rather than
merely unreported before treating that as settled.
