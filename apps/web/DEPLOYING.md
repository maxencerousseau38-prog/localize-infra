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
now returns `Invalid login credentials`, and the production database holds no
accounts at all.

Verified end to end, not inferred from the environment variable: a confirmed
user created **only** in the new production database signed in on
`localize-infra-web.vercel.app` and landed on `/onboarding` — "Create a
workspace" — which is the correct screen for a database with zero
organizations. That probe user was deleted afterwards; production is empty.

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
product working, and it is worth knowing: the free plan grants public
repositories only, running the pipeline is operator-gated, and with GitHub
unset there is nothing for a stranger to reach.

Vercel's `ssoProtection` is set to `all_except_custom_domains`, which is the
default and does **not** cover the production alias — `localize-infra-web.vercel.app`
is served to anonymous requests. Password protection requires a paid plan.
