# Releasing the open-source packages

Three packages are publishable: `@localize-infra/schemas`, `@localize-infra/core`
and `@localize-infra/cli`. **All three were published at 0.1.0 on 2026-08-28**;
this document said they "have not been published" and is corrected here.

**`cli` 0.3.0 is `latest`** since 2026-09-17 — see its section below.

**`cli` 0.2.0 was published** 2026-09-12 at 07:43 UTC, with `latest`
resolving to it until 0.3.0, and its dependencies still `^0.1.0` on `core` and
`schemas`.
This line said "still 0.1.0 on npm" until that publish landed, and nothing in
the repository moved when it did — the publish happens outside Git, so the only
thing that can carry the fact back is a commit like this one.

The bump carries the empty-pull-request fix: the API now answers 409 when the
files in a request already match the base branch, and the CLI reports that as an
outcome instead of throwing. Verified in the published tarball rather than
assumed from the version number — `dist/index.js` carries "No PR opened: every
translation is already on the base branch." `schemas` and `core` are untouched,
and the new CLI code uses no new API from either — so this release was **one
package, not three**, and the ordering section below did not apply to it.

A 0.2.0 rather than a patch: what a user sees changes. `npx localize-infra init
--open-pr` against an up-to-date repository used to fail with a raw API error
and now prints that there was nothing to open.

One thing the first run taught, worth having before the second: the three
package documents replicated **minutes** apart. `npm view` and
`npm install @localize-infra/cli` both answered E404 for a window *after* the
publishes had succeeded, which reads exactly like a failed publish. The
endpoint that told the truth first was `/-/org/localize-infra/package`, which
listed all three names while two of them still 404'd. Check that before
concluding a publish failed, and before re-running one.

## `cli` 0.3.0 — published 2026-09-17

**On npm, and `latest`.** `core` and `schemas` stayed at 0.1.0. The sequence
below was followed in order, and each step was checked rather than assumed:

- the migration is in production, with function definitions and grants equal
  to development (md5);
- the API carries `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` — the first
  attempt stored **empty** values, because `vercel env add` run through a
  non-interactive shell reads an empty stdin. The variables were listed, the
  deployment was Ready, and every personal token was still refused as "not
  enabled". Only the API's own answer told the two apart: set them in the
  dashboard, and read what the API says to an unknown `lit_` token
  ("invalid, expired or revoked" means resolution works; "not enabled" means a
  variable is empty; 503 means a wrong URL or key);
- the API was deployed from a clean `master` (`5e0a64d`);
- the packed tarball, installed outside the repository, ran against
  production with a token issued in the production app: `whoami` →
  `layersky`, a real translation, a real pull request (fixture #18, closed),
  a repository outside the installation refused before any translation
  (exit 1), and the same token refused once revoked (exit 1), with
  `last_used_at` untouched by the refusals.

What that run could not show: production still had
`GITHUB_APP_INSTALLATION_ID` at the time, very likely the same installation
as `layersky`'s, so it could not tell "the workspace's installation" from
"the default". The local run did, with the default deliberately invalid. The
variable was removed right after (below), so production has no default left
to fall back to.

**What changes for a user.** The default API is the hosted one
(`https://localize-infra-api.vercel.app`, `DEFAULT_API_URL`), and it is used
with a **personal CLI token** created in the hosted app — not the operator's
shared `API_AUTH_TOKEN`, which is now for server-to-server use only.

- A token (`lit_…`) acts for one workspace. The API resolves it with
  `resolve_cli_token` (service role only) and opens pull requests **only**
  through that workspace's GitHub installation — never the deployment's
  default one — and refuses private repositories the workspace is not
  entitled to.
- Only a SHA-256 hash is stored. Tokens expire (30, 90 or 365 days), are
  revocable one by one, stop working when their creator leaves the workspace,
  and record their last use. At most ten active per person per workspace.
- `init` asks `/v1/whoami` and, with `--open-pr`, `/v1/open-pr/preflight`
  **before** writing or translating anything: a revoked token, a workspace
  without GitHub, an unreachable repository, a missing base branch or a
  private repository without entitlement costs nothing and prints one
  sentence.
- A pull request that fails after translation keeps the per-locale summary,
  says the files are on disk, and exits 1.
- Exit code 1 when `init` refuses, when no locale was translated, or when the
  pull request failed. A partial run still exits 0.
- Against a self-hosted API older than 0.3.0 (no `whoami`, no preflight),
  the CLI behaves as 0.2.0 did.

**One package, not three.** The CLI validates the `whoami` and preflight
responses itself and imports nothing new from `@localize-infra/schemas`, so
it still resolves `core` and `schemas` at `^0.1.0` from npm. Verify that on
the packed tarball before publishing — a new import would install and then
fail at runtime.

### Publish sequence, in this order

1. **Apply migration `20260916000300_cli_tokens` to production**, from the
   file, and check the function definitions against development by md5.
   First, because the next step deploys a page that reads `cli_tokens`.
2. **Merge** the PR carrying 0.3.0. This deploys the web app, where tokens
   can be created, and the site, which still describes 0.2.0
   (`CLI_PERSONAL_TOKENS_LIVE = false`).
3. **Configure the API** (`localize-infra-api`, Production):
   `SUPABASE_URL` (the production project URL) and
   `SUPABASE_SERVICE_ROLE_KEY` (its secret key). Without both, the API
   refuses every personal token with "not enabled on this API deployment".
4. **Deploy the API** from a clean tree equal to `origin/master`
   (`apps/api/DEPLOYING.md`), and check `/api/version`.
5. **Prove it end to end** from the packed tarball in a project outside the
   repository, with a token created in the production app: `whoami`,
   translation, `--open-pr` on a repository the workspace's installation
   reaches, a revoked token (exit 1), an unreachable repository (exit 1, no
   translation spent).
6. **Publish** `npm publish -w @localize-infra/cli --access public`.
7. **In the same commit as the publish:** set
   `CLI_PERSONAL_TOKENS_LIVE = true` in `apps/site/src/lib/constants.ts` —
   the landing page, `/docs` and `/security` switch to the hosted-API copy,
   and `apps/site/e2e/interaction.spec.ts` holds them to it — and update the
   `CLAUDE.md` paragraph that describes the published CLI.

### Worth doing right after

- **Done 2026-09-17: `GITHUB_APP_INSTALLATION_ID` removed from the
  production API**, which was then redeployed from `master` (`e37c67c`).
  Only the operator path fell back to it; `apps/web` always names its
  installation. Checked in production without creating anything: the
  operator naming no installation gets 501, the operator naming `layersky`'s
  installation with content identical to `main` gets 409 (GitHub reached,
  nothing opened), an unknown `lit_` token gets 401. Removed from the
  Preview and Development environments too, later the same day — it is set
  nowhere on the API project now.
- **Done 2026-09-17: `API_AUTH_TOKEN` (API) and `LOCALIZE_API_TOKEN` (web)
  rotated together**, both Production only, then the API and the web app
  redeployed from `master` (`49c15ca`). The old value had been used as the
  CLI's token during testing. Checked: the new value answers `whoami` as the
  operator, the old one gets 401 on every `/v1/*` route, and the old
  deployments' own URLs sit behind Vercel SSO (302), so a value baked into
  them cannot be used from outside. The rotation was done **twice**: the first
  run deleted its only local copy, and a `sensitive` variable cannot be read
  back — not by the CLI, the API or the dashboard. The second wrote the value
  to the local `.env` first, then to Vercel. **The web → API call with the new
  value is not exercised by these checks**; only a run started from the app
  does. `API_AUTH_TOKEN` was then removed from the API's Preview and
  Development environments: it exists in Production only.

## Before anything

1. **Authenticate.** `npm login`. Publishing fails with `ENEEDAUTH` otherwise.
2. **Own the scope.** This said the scope was "unclaimed on the public registry
   (`npm view @localize-infra/core` → 404)". The conclusion did not follow from
   the evidence, and it is wrong: a 404 on a *package* says the package does
   not exist, which is true of every unpublished name inside a scope somebody
   else already owns. It never tested the scope at all.

   The endpoint that does test it is `/-/org/<name>/package`, and on
   2026-08-28 it answered:

   ```
   /-/org/definitely-not-an-org-8f3a2b1c   404  {"error":"Scope not found"}
   /-/org/localize-infra-nope-9k2          404  {"error":"Scope not found"}
   /-/org/localize-infra                   200  {}
   /-/org/vercel                           200  {"vercel-client":"write",…}
   ```

   **The scope `localize-infra` is claimed and empty.** The two negative
   controls matter as much as the result — one of them is a deliberate
   near-miss, so a 200 cannot be a prefix artefact — and so does running all
   four in one batch, because npmjs.com answers 403 to everything
   unauthenticated and the registry rate-limits to 429 under `error code:
   1015`. Both look like answers and are not; an earlier round of this same
   check produced four identical 403s and meant nothing.

   What it still does **not** establish is who owns it. The same endpoint
   returns 200 for `sindresorhus` and `isaacs`, which are user accounts rather
   than organisations, so 200 means "this name is taken", not "your
   organisation exists". Two situations produce it: the organisation is yours
   and empty, or the name belongs to somebody else.

   Only an authenticated call separates them:

   ```bash
   npm org ls localize-infra
   ```

   Members listed → publish. Failure → the name is not yours, and changing
   scope is not a one-line edit: it touches three `package.json` files, the
   CLI's two internal dependency ranges, and the site copy that names the
   package.
3. **Understand that it is permanent.** A published name cannot be reused.
   `npm unpublish` is restricted to a 72-hour window and is a last resort.

## Order matters

`cli` depends on `core` and `schemas` at `^0.1.0`, resolved from the registry —
not from this workspace. Publishing `cli` first produces a package that fails to
install for everyone with `E404` on its dependencies.

```bash
npm publish -w @localize-infra/schemas --access public
npm publish -w @localize-infra/core    --access public
npm publish -w @localize-infra/cli     --access public
```

Then, in the **same commit as the publish**, flip one constant:

```ts
// apps/site/src/lib/constants.ts
export const CLI_PUBLISHED_TO_NPM = true;
```

The landing hero and `/docs` both read it, and e2e tests assert that whatever it
says is what those pages say — in either direction. So the site cannot promise
an `npx` that 404s, and it cannot keep apologising for a package that exists.

This is a step, not a follow-up. The site's standing constraint is that every
claim must be true *today*; leaving the flag behind after publishing breaks that
constraint just as surely as flipping it early does. Both failures are caught by
`apps/site/e2e/interaction.spec.ts`, which was run against both values of the
flag when it was written.

`--access public` is required: scoped packages default to restricted, and a
restricted publish on a free account fails.

Each package runs `prepublishOnly`, which rebuilds `dist/`. That directory is
gitignored, so a publish from a clean clone would otherwise ship an empty
package — this is not a theoretical failure, it is the default one.

## Verifying before you publish

Publishing is irreversible, so verify against the packed tarballs rather than
against the workspace, where everything resolves regardless of whether the
`files` list is correct:

```bash
npm run build -w @localize-infra/schemas -w @localize-infra/core -w @localize-infra/cli
mkdir -p /tmp/pack
for p in schemas core cli; do (cd packages/$p && npm pack --pack-destination /tmp/pack); done

mkdir -p /tmp/consumer && cd /tmp/consumer && npm init -y
# Version per package, not one number: cli is at 0.3.0 and the other two
# did not. A glob here would silently install whichever tarballs happen to be
# in the directory, including stale ones from an earlier run.
npm install /tmp/pack/localize-infra-schemas-0.1.0.tgz \
            /tmp/pack/localize-infra-core-0.1.0.tgz \
            /tmp/pack/localize-infra-cli-0.3.0.tgz
npx localize-infra            # prints usage
```

This has been run, most recently on 2026-08-28 — dated because `packages/core`
changes, and an undated "this has been run" quietly comes to mean "against some
earlier artefact". The tarballs contain `dist/`, `README.md` and `LICENSE` and
nothing else — no `src/`, no compiled tests, no `.tsbuildinfo`. The binary links,
the shebang survives, and framework detection and string extraction work from
the installed package.

## What publishing does not achieve

`npx @localize-infra/cli init` will install and run, but it will not translate
anything. With `LOCALIZE_API_TOKEN` set and no API reachable, the observed
behaviour on a Vite + React project is:

```
Detected framework: Vite + React
Wrote 2 key(s) to locales/en.json
  de: FAILED - fetch failed
  ...
```

Detection, extraction and `locales/en.json` work locally. Every translation
fails, and this paragraph used to give the reason as "**there is no hosted
API**". That stopped being true on 2026-08-19: `apps/api` is deployed at
https://localize-infra-api.vercel.app and answered a real translation in 3.20s
on 2026-08-28.

The conclusion survives, which is exactly why the wrong reason went unnoticed —
nothing downstream changed, so nothing failed. Two facts now carry it instead:

- `--api-url` defaulted to `http://localhost:8787` in 0.1.0 and 0.2.0, so
  an unmodified `npx` reached nothing;
- every `/v1/*` route required `API_AUTH_TOKEN`, and no npm user had it.
  Verified in production the same day: 401 with no token, 401 with a wrong
  one.

So each user had to run `apps/api` themselves with their own provider key,
and publishing made the package *installable*, not the command *useful*.

**That blocker is gone with 0.3.0.** The default is the hosted API, and it
accepts a personal token each person creates in the hosted app — per-user
credentials, not the operator's bearer. `npx @localize-infra/cli init` with
such a token translates and opens pull requests. What the pages disclose
changed with it: `/security` now says the CLI sends code context to our API in
Paris, which forwards it to the model in the United States.

## Licensing

Resolved. The root `LICENSE` now states its scope explicitly: MIT applies only
to `packages/cli`, `packages/core`, `packages/eval` and `packages/schemas`, and
everything else is proprietary with all rights reserved. Each of the four MIT
packages carries its own copy of the MIT text so the licence travels with a
published tarball, and each proprietary directory carries an explicit notice so
nobody browsing it assumes the root licence applies.

The copyright holder is **Rousseau Software SAS**, on all eleven notices — the
MIT grant and the proprietary reservations alike. A test asserts every notice
names one identical holder, so a partial rename fails the build rather than
leaving two entities asserting rights over one codebase.

One consequence worth knowing: a single-holder MIT line stays accurate only
while Rousseau Software SAS is the sole author of the open packages. If you
accept outside pull requests, contributors retain copyright in their own
patches — at that point you want either a CLA or a "and contributors" line.
