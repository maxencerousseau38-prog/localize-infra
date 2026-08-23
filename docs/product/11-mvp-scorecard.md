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
| Postgres, auth, organisations, membership, roles, projects, runs | 16 migrations applied to both Supabase projects; RLS isolation asserted by `supabase/tests/tenant-isolation.sql` |
| `/runs`, `/runs/[id]`, `/locales`, `/ambiguity`, `/review`, `/[org]/projects`, `/[org]/projects/[project]` read Postgres under RLS | 98 e2e tests, including 18 against a seeded workspace with real runs |
| Three deployments live | `/health` 200 on the API, 200 on site and web, probed 2026-08-21 |
| API is fail-closed | Refuses to start without `API_AUTH_TOKEN`; `/v1/translate` returns 401 without a bearer and with a wrong one, verified in production |
| Cross-tenant isolation on GitHub — **reads only** | `resolveInstallation` cannot express the shared installation — it is a type error, not a runtime check (#24). **Writes are not isolated:** `/v1/open-pr` takes no installation id and opens every tenant's pull request through the API's own `GITHUB_APP_INSTALLATION_ID` — see blocker 2b |
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
| **Self-serve GitHub connection in production** | `GITHUB_OAUTH_CLIENT_ID` and `GITHUB_OAUTH_CLIENT_SECRET` are absent from the production environment, verified by `vercel env ls production` on 2026-08-22 |
| **A published CLI** | `npm view @localize-infra/cli` returns 404, verified 2026-08-22 |

| **A worker** | Runs execute inside the request. A large repository will outlive the serverless timeout, and nothing resumes it |

---

## What is unknown, and stated as unknown

| Question | Status |
|---|---|
| **Does a real customer journey work end to end?** | **The pipeline: yes, verified 2026-08-22 — see blocker 5.** Sign in → connect → run → escalate → answer → approve → pull request, in a browser against a real repository. **Self-serve: still no** — the OAuth connection was bypassed because the secret is missing, and no non-operator account has done it on production |
| **Do humans think the translations are good?** | **Never measured.** `08-critique.md` §C2; no evaluators were ever recruited. chrF and exact match are reference-agreement proxies, not quality |
| **Does the agent escalate when it should?** | **Partly answered.** It does escalate on genuinely context-free strings — verified end to end on *Left*, *New* and *Free*, and it correctly stayed silent on *Home* and *Close*, which their own markup disambiguates. Whether it escalates at the right *rate* is still unmeasured: 2 in 414 on a corpus containing nothing ambiguous by construction |
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

### 2. `GITHUB_OAUTH_CLIENT_ID` and `GITHUB_OAUTH_CLIENT_SECRET` — *owner*
Without them no customer can connect a repository, and the interface correctly
says so rather than storing an unverified installation id. The GitHub App also
needs "Request user authorization during installation" enabled and its callback
URL set to `https://localize-infra-web.vercel.app/github/callback`.
**Done when:** a workspace other than the operator's completes an installation
and `organization_github_installations` holds its row.

### 2b. Pass the tenant's installation to `/v1/open-pr` — *mine, found 2026-08-23*
Clearing blocker 2 is necessary but not sufficient. A customer who connects
their own installation will translate successfully and then fail at the last
step: `apps/api` opens every pull request through the single
`GITHUB_APP_INSTALLATION_ID` in its own environment, which does not reach their
repository. The read path resolves per organisation; the write path does not.

This has never been observed failing because the only journey ever run used the
operator's installation for both halves, where the two happen to coincide.

**Evidence:** `apps/api/src/index.ts:58` reads the id from the environment;
`open-pr/route.ts` contains no `installationId` and its request schema has no
field for one.

**Done when:** `/v1/open-pr` takes an installation id, the API acts as it, and a
run on a repository the operator's installation cannot reach opens a pull
request anyway.

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

### 7. Decide the escalation question — *mine, needs a decision from the owner on scope*
Invariant 4 is the product's differentiator and has no real test. Needs a small
corpus of deliberately ambiguous strings with the expected behaviour recorded.
**Done when:** escalation precision and recall are measured on strings written
to be ambiguous.

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
