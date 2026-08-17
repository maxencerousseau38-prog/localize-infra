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

There is **no Git integration**. Deployment is a CLI archive upload run from
the *repository root*, not from `apps/web`:

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

**If this project is ever connected to Git, that changes.** Vercel would then
clone and build with `apps/web` as the root, and the
"Include source files outside of the Root Directory in the Build Step" setting
becomes load-bearing — off, the build still goes green and roughly 30% of the
stylesheet silently disappears (measured on `apps/site`: 44,377 B → 30,911 B).
The Vercel CLI does not expose that setting, so it has to be toggled in the
dashboard. `docs/deploying.md` has the full account.

## Environment

Deliberately **not** the full set the local `.env.local` carries.

| Variable | Set on Vercel | Why |
|---|---|---|
| `SUPABASE_URL` | yes | Auth, workspaces, projects |
| `SUPABASE_PUBLISHABLE_KEY` | yes | Protected by RLS, not a secret |
| `GITHUB_APP_ID` | **no** | see below |
| `GITHUB_APP_PRIVATE_KEY` | **no** | see below |
| `GITHUB_APP_INSTALLATION_ID` | **no** | see below |
| `GITHUB_OPERATOR_EMAILS` | **no** | see below |
| `LOCALIZE_API_URL` / `LOCALIZE_API_TOKEN` | **no** | see below |

GitHub and the translation API are absent on purpose, and the deployment says
so rather than failing oddly: the repository section renders "This deployment
has no GitHub App configured", which is true.

Three reasons, and none of them is "not got round to it":

1. **The pipeline would be broken anyway.** `LOCALIZE_API_URL` defaults to
   `http://127.0.0.1:8787`, and `apps/api` is not deployed. A run would reach
   for a service that does not exist on that host.
2. **It would put the App private key on Vercel.** That key can write to every
   repository the installation was granted. It should not travel until there is
   a reason for it to.
3. **Invariant 5.** With the pipeline live, source-derived context leaves for
   non-EU LLM providers from a public deployment rather than from one
   developer's machine. The gap is documented in CLAUDE.md; widening it is a
   decision, not a deployment step.

Adding them is a deliberate act. When it happens, this file and CLAUDE.md are
updated in the same commit — the last time a deployment and the documentation
disagreed here, `apps/api` sat on a public URL for days while CLAUDE.md called
it local.

## Open problem: production shares the development database

`SUPABASE_URL` points at the same Supabase project used for local development
and acceptance tests. That project contains the account seeded by
`supabase/seeds/dev-user.sql`, whose password is written in that file, in this
repository. The seed says "NOT for production". It is now reachable from a
public URL: `acceptance@localize-infra.dev` authenticates against the live
deployment today, verified.

What that account can reach is bounded by RLS, and the bound holds — it sees
one workspace, one project and its runs, and nothing belonging to anyone else.
There are no secrets in those rows, and with the GitHub App unset the pipeline
cannot be triggered from production. So this is a foothold, not a breach.

It should still not exist. It is not fixed here because every fix is somebody
else's call:

- **Deleting the account** cascades to the Acceptance workspace, its project and
  its run history — including the record of the first real end-to-end run that
  opened PR #2. That is evidence worth keeping, not a disposable fixture.
- **Rotating the password** breaks local acceptance tests until the seed is
  re-run, and the next re-seed puts the known password straight back.
- **A separate Supabase project for production** is the actual answer, and it
  is a decision about cost and data migration.

Until one is chosen, treat this deployment as a demonstration, not as somewhere
to put real customer data.

## Signup is open

Anyone reaching the URL can create an account and a workspace. That is the
product working, and it is worth knowing: the free plan grants public
repositories only, running the pipeline is operator-gated, and with GitHub
unset there is nothing for a stranger to reach.

Vercel's `ssoProtection` is set to `all_except_custom_domains`, which is the
default and does **not** cover the production alias — `localize-infra-web.vercel.app`
is served to anonymous requests. Password protection requires a paid plan.
