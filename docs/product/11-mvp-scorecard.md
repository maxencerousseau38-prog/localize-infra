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

The most useful evidence this repository has on that question is not an
opinion. A real third party signed up on production on 2026-08-18 from a
`casselin.com` address, created the `layersky` workspace, came back on the 19th,
and stopped. Zero projects, zero runs, zero installations. They reached
`/layersky/projects` and read that connecting GitHub is unavailable on this
deployment, with one way out — *"The CLI still works against a local clone"* —
pointing at a CLI that is not published.

---

## What works, and how that is known

| Capability | Evidence |
|---|---|
| Postgres, auth, organisations, membership, roles, projects, runs | 16 migrations applied to both Supabase projects; RLS isolation asserted by `supabase/tests/tenant-isolation.sql` |
| `/runs`, `/runs/[id]`, `/locales`, `/ambiguity`, `/review`, `/[org]/projects`, `/[org]/projects/[project]` read Postgres under RLS | 98 e2e tests, including 18 against a seeded workspace with real runs |
| Three deployments live | `/health` 200 on the API, 200 on site and web, probed 2026-08-21 |
| API is fail-closed | Refuses to start without `API_AUTH_TOKEN`; `/v1/translate` returns 401 without a bearer and with a wrong one, verified in production |
| Cross-tenant isolation on GitHub | `resolveInstallation` cannot express the shared installation — it is a type error, not a runtime check (#24) |
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
| **Retry on a failed translation chunk** | One malformed response loses every string in that chunk. The benchmark saw this happen |
| **A worker** | Runs execute inside the request. A large repository will outlive the serverless timeout, and nothing resumes it |

---

## What is unknown, and stated as unknown

| Question | Status |
|---|---|
| **Does a real customer journey work end to end?** | **Never executed.** Signup → workspace → connect a repository → run → merged pull request has not been performed once by anyone. Every part has been exercised separately |
| **Do humans think the translations are good?** | **Never measured.** `08-critique.md` §C2; no evaluators were ever recruited. chrF and exact match are reference-agreement proxies, not quality |
| **Does the agent escalate when it should?** | **Underpowered.** 2 escalations in 414 strings. The corpus contains no strings that are ambiguous by construction, so invariant 4 — the product's central promise — has no real test |
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

### 3. Publish the CLI to npm — *owner*
The interface offers it as the fallback when GitHub is unavailable, and it does
not exist. `docs/releasing.md` covers the process.
**Done when:** `npx @localize-infra/cli init` runs from a clean machine.

### 4. Confirm the Vercel plan — *owner*
Hobby prohibits commercial use. This is a licence question, not a capacity one.
**Done when:** the team is confirmed on Pro, or moved to it.

### 5. Run one real end-to-end journey — *mine, once 2 and 3 are done*
On a throwaway account, not the operator's: sign up, create a workspace,
connect a repository, run, review, merge.
**Done when:** a merged pull request exists that a non-operator account
produced through the product, and the transcript is recorded.

### 6. Add a retry to the translate chunk — *mine*
The benchmark's one architectural finding. A malformed response currently costs
a whole locale.
**Done when:** a chunk that fails to parse is retried once, with a test.

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
