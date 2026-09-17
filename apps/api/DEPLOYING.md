# Deploying apps/api

Vercel project `localize-infra-api`, Root Directory `apps/api`, functions in
**cdg1 (Paris)**. Live at https://localize-infra-api.vercel.app.

This service exists as a deployed HTTP endpoint rather than an in-process module
because `packages/cli` calls it over the network — `translate-client.ts` and
`open-pr-client.ts` both POST to `${apiUrl}/v1/…`. The `npx → PR` story a
developer is sold depends on this URL being reachable.

## Two things that made it fail, both fixed

**1. `export default` silently times out.** Vercel's Node runtime reads a
default export as the legacy `(req, res) => void` signature and *ignores the
returned value*. `hono/vercel`'s `handle()` returns a `Response`, so every
request was accepted, its response discarded, nothing written, and the
invocation ran to the 300-second ceiling. No error — just timeouts. The fix is
`export function fetch(request)`, the Web-standard form, in `api/index.ts`.

**2. Providers were built eagerly, both of them.** `/v1/translate` called
`getProvider('openai')` on every request, which throws when `OPENAI_API_KEY` is
unset. A deployment configured with a perfectly good Anthropic key answered 500
in 0.27s without reaching any model. Providers are now built only for the keys
that exist (`getConfiguredProviders()`), and `pickProvider(seed, available)`
spreads across the configured set — one provider means every locale lands on it,
two means the original A/B split. With none configured the route answers **503**,
not 502: nothing upstream failed, this deployment has nothing to ask.

## Environment

The first four are required. The service refuses to start without the first
one. `GITHUB_APP_INSTALLATION_ID` is optional and **not set in production**;
the last two enable personal CLI tokens.

| Variable | Purpose |
|---|---|
| `API_AUTH_TOKEN` | The **operator** bearer: server-to-server, held by `apps/web`. Never handed to users. `src/index.ts` throws at import without it |
| `ANTHROPIC_API_KEY` | Translation. At least one provider key must be present |
| `GITHUB_APP_ID` | Pull-request creation |
| `GITHUB_APP_INSTALLATION_ID` | Optional **default** installation, used only by an operator request that names none. Removed from Production on 2026-09-17; without it such a request gets 501 |
| `GITHUB_APP_PRIVATE_KEY` | The PEM **inline** — `GITHUB_APP_PRIVATE_KEY_PATH` is a local-only convenience with no file to point at on Vercel |
| `SUPABASE_URL` | The production database, to resolve personal CLI tokens. Optional |
| `SUPABASE_SERVICE_ROLE_KEY` | Its secret key. `resolve_cli_token` is executable by the service role only. Optional; with either missing, personal tokens are refused with that reason |

## Who is calling

Every `/v1/*` request carries one of two bearers (`src/callers.ts`):

- **The operator token** (`API_AUTH_TOKEN`). A request may name the GitHub
  installation to act through, and falls back to
  `GITHUB_APP_INSTALLATION_ID` when it does not — which, in production, is
  never set, so it must name one. `apps/web` always names its workspace's
  installation.
- **A personal CLI token** (`lit_` + 43 base64url characters), issued in the
  web app. The API hashes it, resolves the hash to one workspace, and acts
  **only** through that workspace's installation: a request naming another
  is refused (403), a workspace with no GitHub connection is refused with the
  link to connect it (412), and there is no fallback to the default
  installation. Private repositories need the workspace's entitlement (403).

Routes added with this:

| Route | Purpose |
|---|---|
| `GET /v1/whoami` | Which kind of caller, and which workspace. The CLI asks before writing anything |
| `POST /v1/open-pr/preflight` | Can a pull request be opened on `owner/repo` at `baseBranch` — reads only: the installation's repository list, then the branch. Asked before any translation is paid for |

Refusals from GitHub are reported by status with a sentence a user can act on
(404 unreachable repository or branch, 403 permissions, 422 rejected); the
GitHub response body is logged, never returned.

**Membership comes from the installation's list, not from `repos.get`.** An
installation token can read any public repository, so `repos.get` answered
200 for `octocat/Hello-World` and the refusal came only at the first write,
after every locale had been translated. Found by running the packed CLI
against it.

**A provider failure on `/v1/translate` returns a fixed sentence (502).** It
used to return the provider's own error, which for a rejected OpenAI key is a
JSON body quoting the key's first and last characters. The error is logged.

**Running this API locally with `tsx` loads `services/github-app` from its
`dist/`**, not its source. Rebuild it (`npm run build -w
@localize-infra/github-app`) after changing it, or the local API runs the old
code — which is how the membership fix above first looked like it had not
worked.

`OPENAI_API_KEY` is deliberately unset. Adding it re-enables the two-provider
split with no other change.

## Deploying

From the **repository root**, not from `apps/api`, so workspace dependencies
resolve:

```sh
VERCEL_ORG_ID=team_jkFQHiZ8OitJujErZvg9oJFb \
VERCEL_PROJECT_ID=prj_fFCT4LNM1gK5S6uelPaceSvLahJS \
npx vercel deploy --prod --archive=tgz
```

`outputDirectory: public` exists because Vercel refuses to finish a build with a
`buildCommand` and no static output. The page it serves is real — it states what
the service is and that source-derived context leaves the EU — but the catch-all
rewrite means `/` reaches the function, so the page is a build requirement more
than a destination.

## Verified in production

```
GET  /health                        200 {"ok":true}       (0.35s)
POST /v1/translate  no token        401
POST /v1/translate  wrong token     401
POST /v1/translate  valid token     200 (3.31s)
     cart.checkout -> Procéder au paiement
     cart.empty    -> Votre panier est vide
X-Vercel-Id: cdg1::cdg1
```

Re-run on 2026-08-28 against a fresh deployment: identical, 3.20s.

### The no-changes path, exercised against real GitHub

The block above only covers translation. `/v1/open-pr` refusing a request that
changes nothing is a separate claim, and until 2026-09-04 it rested on four unit
tests against a fake Octokit — a shape the real API could have contradicted.

Run against the deployed service on 2026-09-04, sending one file byte-identical
to what `maxencerousseau38-prog/localize-infra-fixture-vite` already holds on
`main`:

```
POST /v1/open-pr  valid token, unchanged file
  409 {"error":"Nothing to open: the files in this request are identical
       to the base branch."}
```

What did **not** happen matters as much as the status. Before and after, on the
fixture repository:

```
highest pull request     14  ->  14      (no #15)
localize-infra/* branches 0  ->   0      (no orphan ref)
main tree sha       5f8f3af  ->  5f8f3af
```

The branch count is the part no unit test could establish. `createRef` was moved
after `createTree` precisely so a no-op run leaves nothing behind — the earlier
order would have traded empty pull requests for orphan branches — and this is
the first evidence of that ordering holding against GitHub rather than against a
test double.

The probe is safe to repeat: if the check ever regresses, it opens a pull
request instead of answering 409, which is visible and closable.

### The escalation path, which the block above cannot see

Every string in that check comes back `confident`, so it passes identically
whether the ambiguity prompt works or never fires at all. That is the one part
of this service carrying invariant 4 — the agent raises ambiguities rather than
guessing them — and a green check that cannot distinguish "working" from
"silently absent" is the kind of alibi this repository has been caught by
before.

Two deliberately ambiguous strings, same token, same URL:

```
POST /v1/translate  valid token     200

nav.book             ambiguous   Réserver
  question: Is 'Book' here a navigation link to reserve something (verb)
            or to a books/library section (noun)?
  alternatives: Réserver / Livre

form.submit_confirm  ambiguous   Êtes-vous sûr de vouloir continuer ?
  question: Should the dialog address the user formally (vous) or
            informally (tu)?
  alternatives: Êtes-vous sûr… / Es-tu sûr…
```

Both raise a question with two defensible readings instead of picking one. Note
that `text` is still filled in — the proposal exists so the locale file is
complete; it is the **pull request** that waits for a person, not the
translation.

Worth knowing when this is re-run: the model decides what is ambiguous, so
these exact two strings are not a contract. What is being checked is that
`confidence: "ambiguous"` with a non-null `question` can come back at all. A
run where every string returns `confident` proves nothing either way — pick
strings a translator would genuinely have to ask about.

## Data residency

Source-derived context — file paths, component names, surrounding code — is sent
to Anthropic, which is not hosted in the EU. Functions run in `cdg1` and the
database is `eu-west-3`, which settles the journey to the model but not the model
itself. This is the known gap against invariant 5, recorded in CLAUDE.md, and it
is now on a public URL rather than one developer's machine. That was a deliberate
decision taken on 2026-08-19, not a drift.

## Which commit is live

```sh
curl -s https://localize-infra-api.vercel.app/api/version
```

Public, like `/health`, and outside the `/v1/*` auth middleware — which matches
on `/v1/*` and is therefore untouched by this route. `index.test.ts` asserts
both halves together: that `/api/version` answers 200 unauthenticated **and**
that `/v1/translate` and `/v1/open-pr` still answer 401. Asserting only the
first would pass just as happily if the middleware had been deleted.

**This service needs the endpoint more than the other two, and may be the one
least able to answer it.** Both things follow from the same fact: it is not
connected to Git.

It needs it because merging to `master` deploys the site and the web app and
**not this** — so the commit on `master` is not evidence about what is running
here. That gap is not hypothetical; on 2026-08-23 PR #33 was merged while the
last API production build still dated from the previous day.

It may not be able to answer because `VERCEL_GIT_COMMIT_SHA` is a *Git* system
variable, and this project deploys by `vercel deploy --prod --archive=tgz`
rather than from a connected repository. Whether the CLI attaches Git metadata
to an archive deployment decides whether the value arrives at all. So:

```
{"commit":"<sha>","environment":"production"}   metadata arrived
{"commit":null,"environment":"production"}      it did not
```

A `null` here is **not a bug to fix in this code** — it is the endpoint
correctly reporting that the deployment carries no commit identity. Reading git
at runtime, or printing a build-time constant, would replace "I do not know"
with a claim, which is the one thing this route must never do. If the answer is
`null` and the commit still needs to be known, the fix is upstream: connect the
project to Git, or set the variable explicitly at deploy time.

**Observed on the first deploy that carried the route (2026-09-16): the
metadata arrives.** `vercel deploy --prod --archive=tgz`, run from the
repository root at `b606c1a`, produced a deployment whose `/api/version`
answered

```
{"commit":"b606c1ab433d424989ffcfb136e9bbe8ea02f70c","environment":"production"}
```

with `X-Vercel-Id: cdg1::cdg1`, the function in `cdg1` on `nodejs24.x`, and both
`/v1/*` routes still 401 with no token and with a wrong one. So the `null` case
above remains possible for a deploy that carries no Git metadata, but it is not
what this procedure produces.

**That creates the trap to know about.** The CLI reads the SHA from the
**local** checkout. It is the commit the working tree is *on*, not a
fingerprint of what was uploaded: deploy from a tree with uncommitted changes,
or from a branch nobody pushed, and the endpoint names a commit that does not
describe the running code — and says so with full confidence. The SHA is only
worth something if the deploy is made from a clean tree equal to
`origin/master`. Check before deploying:

```sh
git fetch && git status -sb     # "## master...origin/master", nothing else
```

The 2026-09-16 deploy was made that way.

Note also that **this endpoint only updates when you deploy.** Unlike the web
app, where a merge is the deploy, here the endpoint keeps reporting the previous
commit until `vercel deploy --prod` is run again — which is precisely the
condition it exists to make visible.
