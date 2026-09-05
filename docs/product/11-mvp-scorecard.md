# The honest MVP scorecard

Date: 2026-08-22

What actually works, what does not, and what is unknown — with the evidence for
each line, because a scorecard nobody can check is a mood board.

The rule for this file: **a row is green only if something was run.** Reading
the code is not evidence that it works, and neither is a passing unit test of a
part.

---

## Can a stranger buy this today?

**No.** Two of the blockers are outside the code and are the owner's to clear;
the rest are listed below in dependency order.

**This section previously claimed a real third party had signed up and stopped,
and called it the most useful evidence in the repository. That was wrong.**

The production database holds one account, which created the `layersky`
workspace on 2026-08-18. It belongs to the owner. It was read as an independent
signup because the address is on a different domain from the owner's usual one —
an inference from an email domain, presented as a fact about a stranger. Nothing
was verified before it was written down, and it was load-bearing: a scorecard
whose stated rule is that a row is green only if something was run had a claim
about market interest resting on a guess.

What survives, because it does not depend on who the account belongs to: the
funnel dead-ends. A workspace with no GitHub installation reaches
`/layersky/projects` and reads that connecting GitHub is unavailable on this
deployment, with one way out — *"The CLI still works against a local clone"* —
pointing at a CLI that is not published. That is verifiable from the code and
the deployment, and it is why blockers 2 and 3 below are blockers.

**There is still no evidence that anybody outside this project wants it.**
`08-critique.md` §C1 — zero primary research, personas that are inventions —
stands entirely undisturbed.

---

## What works, and how that is known

| Capability | Evidence |
|---|---|
| Postgres, auth, organisations, membership, roles, projects, runs | 33 migrations applied to both Supabase projects and replayed from empty on every pull request; RLS isolation asserted by `supabase/tests/tenant-isolation.sql`, **which nothing executed until 2026-09-05** — this row credited it for weeks while it ran nowhere |
| `/runs`, `/runs/[id]`, `/locales`, `/ambiguity`, `/review`, `/[org]/projects`, `/[org]/projects/[project]` read Postgres under RLS | 98 e2e tests, including 18 against a seeded workspace with real runs |
| Three deployments live | `/health` 200 on the API, 200 on site and web, probed 2026-08-21 |
| API is fail-closed | Refuses to start without `API_AUTH_TOKEN`; `/v1/translate` returns 401 without a bearer and with a wrong one, verified in production |
| Cross-tenant isolation on GitHub — reads **and** writes | `resolveInstallation` cannot express the shared installation — it is a type error, not a runtime check (#24). Writes now use the same installation: `/v1/open-pr` takes an `installationId` and both callers send the workspace's own (blocker 2b, fixed). The service still trusts its authenticated caller to name the right one — that half is a caller-side guarantee, and is stated as one |
| Open-redirect protection on sign-in | `safeNext` covered by an e2e test, verified by deleting the guard and watching it fail |
| The translation pipeline answers a real workload | 250 corpus strings through the real handler against the live API: 250 translated, 0 missing, twice (#26) |
| Model and settings choice | Benchmarked over 414 corpus entries in 3 configurations — `docs/product/10-model-benchmark.md` |
| Unit economics | Measured against the real prompt and corpus — `docs/product/09-unit-economics.md` |

---

## What does not exist

| Missing | Consequence |
|---|---|
| **Billing** | No Stripe integration anywhere in the repository. `/[org]/billing` says "Paid plans are not priced yet" |
| **Published prices** | Blocked by `08-critique.md` §C3 until the unit-cost model existed. It now does, and prices are *proposed* in `09-unit-economics.md` — not published |
| **Self-serve GitHub connection in production** | `GITHUB_OAUTH_CLIENT_ID` is set as of 2026-08-23; `GITHUB_OAUTH_CLIENT_SECRET` is still absent, verified by `vercel env ls production`. The flow needs both, so it remains unavailable — see blocker 2 |
| **A published CLI** | `npm view @localize-infra/cli` returns 404, verified 2026-08-22 |

| **A worker** | Runs execute inside the request. A large repository will outlive the serverless timeout, and nothing resumes it |

---

## What is unknown, and stated as unknown

| Question | Status |
|---|---|
| **Does a real customer journey work end to end?** | **The pipeline: yes, verified 2026-08-22 — see blocker 5.** Sign in → connect → run → escalate → answer → approve → pull request, in a browser against a real repository. **Self-serve: still no** — the OAuth connection was bypassed because the secret is missing, and no non-operator account has done it on production |
| **Do humans think the translations are good?** | **Never measured.** `08-critique.md` §C2; no evaluators were ever recruited. chrF and exact match are reference-agreement proxies, not quality |
| **Does the agent escalate when it should?** | **Measured and tuned to target.** Recall 67.5–70.0% at 96.4–100% precision on forty pairs written after the tuning and never seen during it. Two corpus defects of mine were found and retracted en route, including the one behind an earlier 14–24% figure — `12-ambiguity-benchmark.md` |
| **Would anyone pay $19/$99/$399?** | **No evidence.** `08-critique.md` §C1 stands: the personas are inventions and no customer has been interviewed |
| **Which Vercel plan is this on?** | **Not verified.** Modelled at Pro because Hobby prohibits commercial use, so the first paying customer needs Pro regardless of traffic |
| **How do the models handle ICU plurals?** | **No data.** The corpus contains zero ICU messages |

---

## The exact remaining blockers, in dependency order

Each says who owns it and what "done" looks like.

### 1. Merge the P0 fix — *mine, done, awaiting review*
PR #26. Until it lands, the deployed pipeline returns nothing above roughly
thirty strings. Everything below assumes it is merged.
**Done when:** merged to `master` and `apps/web` redeployed.

### 2. `GITHUB_OAUTH_CLIENT_SECRET`, and two App settings — *blocked on Vercel*
Without the secret no customer can connect a repository, and the interface
correctly says so rather than storing an unverified installation id.

**Escalated to Vercel support on 2026-08-23**, because the variable cannot be
stored. The dashboard shows `GITHUB_OAUTH_CLIENT_SECRET` on
`localize-infra-web` Production, and the row survives a full page reload — so
it is not an unsaved form row, which is what the first several attempts turned
out to be. The API does not have it.

Recorded so nobody re-runs this. Four independent reads, all as the account
owner on `prj_L5FZPh16GE88nLtgPbOnb2LR5e3f`:

| Read | Result |
|---|---|
| `vercel env ls` | 12 rows, absent |
| `vercel env ls production` | 8 rows, absent |
| `vercel env pull --environment production` | absent |
| `GET /v9/projects/{id}/env` (raw REST, different code path) | 12 entries, absent |

Two explanations were raised and both are ruled out by the raw response:
`"hiddenProductionEnvCount": 0`, so nothing is being withheld; and sensitive
variables *are* returned, key visible and value `""` — `GITHUB_OAUTH_CLIENT_ID`
appears that way in every call.

That variable is the control. It was added by CLI the same day, same project,
same environment, and is visible in both the dashboard and the API. Project,
account and permissions work; the discrepancy is specific to this one key.

**Nothing in the repository is waiting on this.** The OAuth code has been
complete since it was written, and `readOAuthConfig()` returns null unless it
holds both values, so a lone client id cannot half-enable the flow — pinned by
a test in `install.test.ts`.

**`GITHUB_OAUTH_CLIENT_ID` is set** on the web production environment as of
2026-08-23. It did not need the owner: `GET /app`, authenticated as the App with
the private key already in `.env`, returns `client_id`. It does **not** return
`client_secret` — GitHub shows that once, at generation, in the App settings —
which is the whole of why this blocker is still open and why the remaining half
cannot be automated.

Setting the id alone cannot half-enable anything: `readOAuthConfig()` returns
null unless both are present, and `canInstall` in `github-connection.tsx` is
gated on that. So the flow stays unavailable and keeps saying so.

Two settings on the App itself remain, and neither is writable through the API —
GitHub App settings are UI-only:

- "Request user authorization (OAuth) during installation" enabled. Without it
  GitHub omits `code` from the callback, and the route refuses with
  `missing-code` rather than trusting the installation id;
- the callback URL set to `https://localize-infra-web.vercel.app/github/callback`.

**Neither was verifiable from here.** `GET /app` exposes no field for either,
and probing `login/oauth/authorize` is inconclusive: GitHub redirects to its
login page before validating `redirect_uri`, so a registered and an unregistered
URL answer identically. Confirming them needs the App's settings page.

**Done when:** a workspace other than the operator's completes an installation
and `organization_github_installations` holds its row.

### ~~2b. Pass the tenant's installation to `/v1/open-pr`~~ — *fixed 2026-08-23*
`/v1/open-pr` now takes an optional `installationId` and acts as it; both
`apps/web` callers resolve the workspace's own installation and send it, so the
write uses the same one as the read. `GITHUB_APP_INSTALLATION_ID` is demoted
from *the* installation to a default for single-tenant deployments, which is
what keeps `packages/cli` working against a self-hosted `apps/api`.

The API's `GitHubAppConfig` was split into credentials and installation — the
same split `apps/web` made on the read path in #24, and for the same reason:
fusing "what the App is" with "which installation to act as" is what left a
request no way to choose.

**Verified, against the real server rather than only the unit tests.** This
first said "against the deployed API", which was false when it was written:
`localize-infra-api` is not connected to Git, so merging did not deploy it.

What was actually run — `apps/api` built and started locally with the real App
credentials and the real installation as its *default*, then two requests for a
repository that does not exist:

| Request | Where it failed | What that proves |
|---|---|---|
| names installation `999999999` | `POST /app/installations/999999999/access_tokens` → Not Found | it acted as the id the **request** named, and never reached the repository |
| names none | `/repos/acme/definitely-not-a-real-repo-xyz/git/ref/heads/main` → Not Found | it got a token from the configured default and failed one step later, at the repo |

Two different failures from one code path is the evidence; a status code alone
is not, since both answer 502. Separately, the route was checked by
reintroducing the defect and watching exactly two of thirteen tests fail.

**And now on the deployed API**, redeployed 2026-08-23 because `apps/api` ships
by CLI rather than by merge:

| Probe against production | Result |
|---|---|
| `installationId: -1`, otherwise valid | **400** — the field is validated. The old schema had no such key and Zod strips unknown keys silently, so the previous build answered 502 here |
| `installationId: 1.5` | **400** |
| `installationId: 999999999` | 502, and the runtime log names `POST /app/installations/999999999/access_tokens` → Not Found — it acted as the id the request gave |
| no `installationId` | 502 one step later, at the repository — the configured default was used |

The `-1` probe is what distinguishes deployed-new from deployed-old without
opening anything: a field the old build ignored is a field the new build
rejects. Every probe named a repository that does not exist, so nothing was
written.

`/health` 200, and `/v1/translate` and `/v1/open-pr` both 401 without a bearer
and with a wrong one — the fail-closed behaviour is unchanged by the split.

**Not verified, and it needs blocker 2:** a real second installation. Nobody but
the operator has one, so "a repository the operator's installation cannot reach"
has no subject yet. What is closed is the mechanism; the end-to-end proof waits
on a second tenant existing.

**Still held by the caller, not the service:** `apps/api` authenticates a bearer
token, not a workspace, so it cannot check that the installation a request names
belongs to the caller. `apps/web` derives it from the organisation and is the
only holder of the token. GitHub's own boundary is the backstop — an
installation token reaches only what that installation was granted.

### 3. Publish the CLI to npm — *owner*
The interface offers it as the fallback when GitHub is unavailable, and it does
not exist. `docs/releasing.md` covers the process.
**Done when:** `npx @localize-infra/cli init` runs from a clean machine.

### 4. Confirm the Vercel plan — *owner*
Hobby prohibits commercial use. This is a licence question, not a capacity one.
**Done when:** the team is confirmed on Pro, or moved to it.

### 5. Run one real end-to-end journey — *partly done, 2026-08-22*
**The pipeline works end to end. The self-serve half does not, and that is the
whole of what remains.**

Executed in a browser against a local build of this branch, the development
database, the real GitHub App, and a real repository — every step through the
product's own screens:

| Step | Result |
|---|---|
| Sign in | ✅ |
| Connect a repository | ✅ — dropdown populated from the real installation |
| Run the pipeline | ✅ — 8 strings, 2 locales, 24 s |
| Agent escalates rather than guessing | ✅ — 6 questions on *Left*, *New*, *Free* |
| Answer each question | ✅ |
| Approve | ✅ **after a fix** — see below |
| Pull request opened | ✅ — real files, real translations |

The pull request body read: *"A person reviewed this before it was opened: 6
questions answered, 6 of them by choosing wording other than the suggestion."*
The chosen readings are what landed — French `Restant` for *Left* in its
"remaining" sense, German `Links` for the direction.

**What it caught.** Approving a reviewed run had **never worked**. The approval
path posted to `/v1/open-pr` without `title` or `body`, both required, so it
answered 400 and recorded the run failed. The review gate — the product's
differentiator — could not open a pull request at all. Nothing found it because
the two callers build their request bodies separately and only the unattended
one was ever exercised. Fixed, with the description now built by a tested pure
function in `packages/core`.

**What was bypassed, and it is the only thing.** The OAuth callback proves the
caller owns the installation it names, and `GITHUB_OAUTH_CLIENT_SECRET` is absent
from every environment. The installation was linked directly instead. Everything
after that point is what a customer would do.

**Still not done:** the journey has not been run by a non-operator account, on
production, through self-serve connection. That needs blockers 2 and 3.

Verification PRs #3–#6 on `localize-infra-fixture-vite` were closed afterwards
and the fixture restored to its original three strings.

### ~~6. Add a retry to the translate chunk~~ — *done*
The benchmark's one architectural finding: a malformed response cost a whole
locale. `handleTranslateBatch` now retries a chunk up to three times with
exponential backoff and full jitter, re-sending only the keys still missing.

**Evidence:** rerunning the same 414-entry benchmark, Haiku went from 323/414
to **414/414** — 91 strings recovered by one extra request, for $0.002 and eight
seconds. The recommended configuration needed no retries either time and its
cost is unchanged. Every failure mode the benchmark observed has a regression
test named after the error string the model actually produced.

It did **not** help the broken configuration: default reasoning went from 90
answered to zero at three times the cost. Retrying does not repair a model that
cannot answer, and that row is in `10-model-benchmark.md` rather than omitted.

### ~~7. Decide the escalation question~~ — *target met 2026-08-24, in two rounds*
The owner set the target: **60% recall, precision not below 80%.**

**Met.** On forty polysemy pairs written *after* the tuning and never consulted
during it: **recall 67.5–70.0%, precision 96.4–100%**, three runs, both
thresholds cleared every time.

| | Baseline | Round one | Round two |
|---|---|---|---|
| Recall | 39–48% | 53–61% | **67.5–70.0%** |
| Precision | 86–95% | 91–97% | **96.4–100%** |

Round one tuned against half the original corpus and reported on the other
half. Round two needed a genuinely unseen set, because "fresh holdout" cannot
mean re-splitting cases already seen — so forty new pairs were written for it.

**Two corpus defects were found and retracted along the way, both mine, both
inflating the agent's apparent failure.** First `componentName` carried the
disambiguating information the "open" half was supposed to lack — that alone
accounted for most of the original 14–24% figure this file once reported.
Then the new cohort's first draft gave "Fork" the neighbours *Copy*, *Split*,
*Duplicate*. Structural tests caught neither: they check a corpus is
well-formed, and a well-formed corpus can still be wrong.

**What it cost, and this is a live decision rather than a footnote.** The
escalation rate on 414 real strings went from 0.72% to 1.69% — a customer with
a thousand strings sees roughly seventeen questions where they saw seven. chrF
slipped 75.20 → 74.89, exact match 40.8% → 39.6%, and one glossary violation
appeared where there were none. Placeholder integrity holds at 100%.

Whether that trade is worth keeping is the owner's call; the measurement only
says what it is. Reverting round two returns 42.5–60% recall at 100% precision
on the same unseen cohort.

Full method, per-category figures and limitations: `12-ambiguity-benchmark.md`.

### 8. Model unit economics into a published price — *mine, owner decides the numbers*
The model exists; the prices in `09-unit-economics.md` are proposals with no
willingness-to-pay evidence behind them.
**Done when:** the owner picks the numbers and `/pricing` publishes them.

### 9. Stripe — *last, deliberately*
Nothing about payment code is hard. It is ninth because charging before 2–8 are
done means charging for something a customer cannot use.
**Done when:** a fixed-price subscription can be bought and cancelled.

---

## What would change my mind about the order

If the owner's goal is a **design partner** rather than a self-serve customer,
2 and 3 stop being blockers: the operator can connect a repository on their
behalf, and the CLI can be run from a clone. The critical path becomes 1, 5, 6
— make it work end to end for one named person — and 8 and 9 wait until that
person says they would pay.

That is a materially cheaper path to the first real signal, and the evidence
above says the self-serve funnel is not close.
