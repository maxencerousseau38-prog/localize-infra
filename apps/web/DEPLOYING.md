# Deploying apps/web

Vercel project `localize-infra-web`, Root Directory `apps/web`, functions in
**cdg1 (Paris)** via `vercel.json`. Live at
https://localize-infra-web.vercel.app.

The region is a requirement, not a default. Invariant 5 puts customer data in
the EU, and that has to include where the code runs, not only where the rows
rest — a function in Washington reading a database in Paris moves the data to
Washington. Supabase is `eu-west-3`; this matches it. Verified on the response:
`X-Vercel-Id: cdg1::cdg1`.

## How it deploys, and why that detail matters

**There is Git integration.** This section said there was none, and the
paragraph below predicted exactly what connecting it would change. Both halves
have now happened: merging to `master` deploys production, opening a pull
request deploys a preview with its own GitHub check. Observed 2026-08-23 on
PR #31.

The practical consequence, and the reason this is not a cosmetic correction: an
environment-variable change no longer waits for someone to run the CLI. It
applies on the next merge, which may be a merge that has nothing to do with it.

The CLI archive upload still works and remains the fallback. It runs from the
*repository root*, not from `apps/web`:

```sh
VERCEL_ORG_ID=team_jkFQHiZ8OitJujErZvg9oJFb \
VERCEL_PROJECT_ID=prj_L5FZPh16GE88nLtgPbOnb2LR5e3f \
npx vercel deploy --prod --archive=tgz
```

The env-var override is what makes this safe to run from the root: the root
`.vercel` link belongs to `localize-infra-site`, and without the override this
command would deploy the marketing site.

Uploading from the root is also what makes the build correct.
`src/app/globals.css` contains

```css
@source '../../../../packages/ui/src';
```

That path climbs out of `apps/web`. Because the whole repository is uploaded,
Tailwind finds it and the shared component utilities compile. Measured on the
live deployment: **184,840 bytes** of CSS across two chunks, containing
`bg-confident-bg`, `bg-degraded-bg`, `text-ambiguous-text`,
`text-confident-text`, `outline-failed`, `bg-active` and `bg-overlay` — classes
that appear in `packages/ui/src` and **nowhere** in `apps/web/src`. If those are
present, the directive resolved. That is the check to repeat, not the byte count
alone.

**That prediction came true, and the check passes.** Vercel now clones and
builds with `apps/web` as the root, which makes the "Include source files
outside of the Root Directory in the Build Step" setting load-bearing — off,
the build still goes green and roughly 30% of the stylesheet silently
disappears (measured on `apps/site`: 44,377 B → 30,911 B). The Vercel CLI does
not expose that setting, so it has to be toggled in the dashboard.
`docs/deploying.md` has the full account.

Re-measured on the git-built production deployment, 2026-08-23: **184,611
bytes** across two chunks, with `bg-confident-bg` and `text-ambiguous-text`
both present. Those classes cannot reach the output unless the directive
resolved, so the setting is on — established from what is served rather than
from reading the toggle.

## Environment

| Variable | Set on Vercel | Why |
|---|---|---|
| `SUPABASE_URL` | yes | Auth, workspaces, projects |
| `SUPABASE_PUBLISHABLE_KEY` | yes | Protected by RLS, not a secret |
| `LOCALIZE_API_URL` | yes | `https://localize-infra-api.vercel.app` |
| `LOCALIZE_API_TOKEN` | yes | Bearer for `/v1/*` |
| `GITHUB_APP_ID` | yes | Reading the repository tree |
| `GITHUB_APP_PRIVATE_KEY` | yes | The PEM inline; the `_PATH` form is local-only |
| `GITHUB_APP_SLUG` | yes | Builds the App installation URL |
| `GITHUB_OAUTH_CLIENT_ID` / `_SECRET` | **no** | Not yet created — see below |

**Two rows left this table on 2026-08-23**, removed from the project rather
than merely undocumented: `GITHUB_APP_INSTALLATION_ID` and
`GITHUB_OPERATOR_EMAILS`. Neither is read by any non-test file in `apps/web`.
The seven that remain were each checked individually, which is what makes this
list current rather than merely shorter.

`GITHUB_APP_INSTALLATION_ID` must **stay** on the `localize-infra-api` project.
It is dead here, not there: `apps/api/src/index.ts` reads it at every boot and
`/v1/open-pr` opens every pull request through it. Removing it there returns
501 on the route.

This table used to say the opposite, and the reasoning it gave was sound at the
time: the pipeline would have pointed at `127.0.0.1:8787`, the App private key
would have travelled for nothing, and enabling it would move the invariant-5 gap
onto a public URL. The first two stopped being true when `apps/api` was
deployed. The third is still true and was accepted deliberately on 2026-08-19 —
see `apps/api/DEPLOYING.md` and CLAUDE.md.

**`GITHUB_OPERATOR_EMAILS` was never an authorization boundary.** This said it
was "the live authorization boundary", that connecting a repository was
restricted to its addresses, and that `isOperator` failed closed on an empty
value. `isOperator` had no callers at all — the whitelist enforced nothing, and
three places described it as what separated tenants (#24). It and the variable
are both gone.

What separates tenants is structural on both paths now.
`organization_github_installations` holds an installation per organisation,
`resolveInstallation` cannot express a shared one, and `/v1/open-pr` takes an
`installationId` so the pull request is opened by the same installation that
read the repository. The write path did not do this and was blocker 2b.

What is **not** yet multi-tenant is the step before all of it: no customer can
trigger their own installation while `GITHUB_OAUTH_CLIENT_ID` /
`GITHUB_OAUTH_CLIENT_SECRET` are missing, so in practice there is still one
installation on this deployment — the operator's.

**`GITHUB_OAUTH_CLIENT_ID` / `GITHUB_OAUTH_CLIENT_SECRET` are absent because the
secret does not exist yet.** Without them the callback cannot prove that whoever
completes an install actually owns it, so `GitHubConnection` renders the flow as
unavailable and explains why rather than storing an unverified installation id.
Creating them requires ticking "Request user authorization (OAuth) during
installation" on the App and setting the callback URL to
`https://localize-infra-web.vercel.app/github/callback`.

## Production has its own database

Production points at `localize-infra-prod` (`ijgheekdihgssktyweyy`, eu-west-3).
Development and the acceptance suite keep `localize-infra`
(`aguwalokxfgtqbzmdjbs`). Only the **production** Vercel environment was
repointed; preview and development still resolve to the development project, so
a preview deployment cannot write to customer data.

This split closed a real exposure rather than a tidiness complaint. The two
shared one database, and `supabase/seeds/dev-user.sql` writes an account whose
password is committed to this repository — so it authenticated against the
public deployment. Verified before, and verified again after: the same request
now returns `Invalid login credentials`.

Verified end to end, not inferred from the environment variable: a confirmed
user created **only** in the new production database signed in on
`localize-infra-web.vercel.app` and landed on `/onboarding` — "Create a
workspace" — which is the correct screen for a database with zero
organizations. That probe user was deleted afterwards.

**This then said "production is empty", and it is not.** Counted 2026-08-23:
1 user, 1 organization, 0 projects, 0 runs, 0 installations. The account is the
owner's own (`layersky`, created 2026-08-18) — it was for a time written up as
an independent third-party signup, which it never was. The seeded development
account remains refused; that is the claim this paragraph was actually built to
support, and it still holds.

"NOT for production" was a sentence in a comment, and a sentence in a comment
stops nothing. The rule is now enforced: the production database carries a
stamp applied out of band —
`comment on database postgres is 'localize-infra-production'` — and the seed
reads it and refuses. Out of band because a migration replays into development
too and so could not distinguish the two. `supabase/README.md` has the detail.

The remaining caveat is the plan, not the data: `localize-infra-prod` is on the
free tier, which pauses on inactivity and is not where a real customer database
should live long-term.

## Signup is open

Anyone reaching the URL can create an account and a workspace. That is the
product working, and it is worth knowing what does and does not bound it.

Running the pipeline is **not** operator-gated — this said it was, and the gate
was removed with `isOperator` in #24. What bounds a new workspace instead is
that it has no GitHub installation of its own and cannot create one while the
OAuth secret is missing, so there is no repository for it to act on. The free
plan grants public repositories only. Those are structural limits, not a
whitelist.

Vercel's `ssoProtection` is set to `all_except_custom_domains`, which is the
default and does **not** cover the production alias — `localize-infra-web.vercel.app`
is served to anonymous requests. Password protection requires a paid plan.
