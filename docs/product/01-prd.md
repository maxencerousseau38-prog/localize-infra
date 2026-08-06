# PRD — Localization infrastructure for product teams

Date: 2026-08-06
Status: draft for review
Author: product/design/engineering working session
Supersedes: nothing. Complements `docs/superpowers/specs/2026-07-30-eval-harness-design.md` and `docs/superpowers/specs/2026-08-02-m1-npx-to-pr-design.md`.

---

## 0. The uncomfortable finding that reframes this document

The original build prompt positioned `npx → PR in under three minutes` as the wedge. **As of August 2026 that mechanic is commoditized.** Evidence gathered 2026-08-06:

- **Locadex** — "monitors your repository and when you push code, it scans for changes, internationalizes new content, generates translations, and opens a PR."
- **General Translation** — "AI sees your full codebase context including component hierarchy, variable names, surrounding UI, and product glossary." That is our condition-B payload, feature for feature.
- **Crowdin** — connects the repo; a PR triggers pre-translation against MT + translation memory + glossary.
- **Tolgee** — Apache-2.0, dev-first, native SDKs for React/Vue/Angular/Svelte/Next, in-context editing, Figma plugin, MCP server.
- Industry write-ups describe in-context editing as "a standard feature" and dev-first + GitHub-first + CDN delivery as "a new standard," i.e. a category, not a differentiator.

**Conclusion: we cannot sell the pipeline.** Anyone can build extraction → LLM → PR in a quarter. Three things are still genuinely hard to copy, and all three are already encoded in this project's invariants:

1. **Ownership.** Git is the master; our database is a disposable index. A customer can delete their account and lose nothing. Tolgee gets partway here via self-hosting, but cloud Tolgee still holds the keys in Tolgee's database. Nobody else offers "cancel and keep everything" as a product guarantee.
2. **Honesty.** The agent refuses to guess on ambiguity and escalates instead (invariant #4), and we publish per-language quality benchmarks *including the languages where we lose* (invariant #7). Every competitor's AI translates confidently and markets accuracy. Sprint 0 already built the harness that makes this credible. No competitor has an incentive to copy this; it requires admitting weakness.
3. **Price that does not punish growth.** See §6. The market moved the other way in the last nine months.

Everything designed below serves those three. A screen that does not serve one of them is a screen a competitor already has, built better, with a four-year head start.

---

## 1. Vision

> Product copy should be a build artifact, not a project.

Teams should reason about their user-facing strings the way they reason about their dependency lockfile: versioned, diffable, reviewed in the same pull request as the code that introduced them, reproducible on any machine, and owned entirely by the team. Localization should stop being a parallel workflow with its own vendor, its own logins, its own inbox, and its own quarterly invoice surprise.

## 2. Mission

Make the correct path the lazy path. A developer adds a string; the translation, the review, the ambiguity escalation, and the pull request happen without anyone opening a new tab. When the system is not confident, it says so out loud rather than shipping a plausible mistranslation.

## 3. Target users

**We are not selling to localization managers.** That buyer already owns Phrase or Smartling, has a workflow built around it, and evaluates on TMS feature parity — a comparison we lose on features and win only on price, which is a bad fight. Chasing them forces us to build the CAT editor, vendor marketplace, and multi-vendor workflow that the build prompt explicitly declared out of scope (§1), and those are precisely the features that made the incumbents slow.

**We sell to the engineering team that owns i18n as a side-duty.** Concretely: product teams of 5–50 engineers shipping a web or mobile app in 2–10 languages, where localization is somebody's 5% responsibility and nobody's title.

Three qualifying signals, in priority order:
1. Their strings already live in the repo (JSON/ARB/`.strings`/YAML) and they are hand-editing them.
2. They have been quoted, renewed, or repriced by an incumbent in the last 12 months and were unhappy about it.
3. They have at least one non-developer (PM, marketer, founder, regional lead) who spots bad copy and currently has no way to fix it except Slack.

Signal 2 is time-sensitive and unusually actionable right now. See §6.

## 4. Personas

### P1 — Maya, Senior Frontend Engineer. **Primary. Design for her by default.**
25-person Series A, Next.js app, ships to DE/FR/ES/JA. i18n is ~5% of her job and 100% of her irritation. Currently: `locales/*.json` in the repo, strings added by hand, translations from a mix of Google Translate and a freelancer on a Slack thread.

- **Wants:** for this to stop being her problem. Not a dashboard. Not a workflow. Absence.
- **Measures us by:** did it work on the first try, without reading docs, and did the diff look sane in the PR.
- **Kills us if:** setup takes more than one command, the PR is noisy, or it overwrites a translation she hand-fixed.
- **Evidence:** research consistently identifies the manual "extract → email thread → paste back → push" loop and setup complexity as the top developer pain points.

### P2 — Tomás, Engineering Lead. **The buyer.**
Approves the card, owns the vendor relationship he does not want. Asks three questions: what happens if you shut down, what does this cost at 3x our current size, and where does our source code go.

- **Wants:** predictable cost, no lock-in, no procurement cycle.
- **Kills us if:** pricing has a usage meter he cannot forecast, or the security answer is unsatisfying. Question three is currently a real problem for us — see §15 R4.

### P3 — Inès, PM/Marketer. **The wedge into the org.**
Spots that the German CTA reads like a legal notice. Cannot fix it. Files a Slack message that dies. She is why the dashboard exists at all; she is also how we grow inside an account without a sales motion.

- **Wants:** to fix one word, safely, without learning what a JSON key is.
- **Kills us if:** we show her a key, a file path, or a merge conflict.

### P4 — Wolfgang, native-speaker reviewer (contractor or regional employee).
Reviews batches, needs context to judge, does not code. Distinct from Inès: he works in volume and wants keyboard throughput, not a friendly wizard.

### P5 — Priya, Security/Procurement reviewer. **Appears at deal size ≥ Team tier.**
Does not use the product. Blocks it. Asks: what leaves our network, which sub-processors, where is data resident, SSO, SOC 2, retention.

---

## 5. Problems, in order of how much money they represent

| # | Problem | Who | Evidence | Currently solved by |
|---|---|---|---|---|
| PR1 | Adding a language means a manual extract/paste/push loop, repeated forever | Maya | widely documented as the top dev pain point | nothing; suffering |
| PR2 | i18n platform pricing scales with product success and reprices unpredictably | Tomás | Phrase entry $135→$525; Lokalise → per-processed-word, free tier withdrawn | switching, grudgingly |
| PR3 | A non-developer cannot fix a wrong word without a developer | Inès | dev/localization skill gap is a documented structural issue | Slack, then nothing |
| PR4 | Machine translation is confidently wrong on ambiguity ("Close" the verb vs. the adjective) and nobody notices until a user complains | Maya, Wolfgang | pluralization/concatenation/context pitfalls are documented | manual review, or luck |
| PR5 | Translations live in a vendor's database; leaving means an export project | Tomás | lock-in is the standard TMS complaint | dread |
| PR6 | Setup cost of a TMS exceeds the pain for small teams, so they never adopt one | Maya | "sheer amount of time required to set up" cited as a top barrier | raw JSON files forever |

PR4 and PR5 are where we are structurally advantaged. PR1 is table stakes we have already built. PR6 is our acquisition mechanic. PR2 is our timing.

## 6. Value proposition & positioning

**Positioning statement.** For product teams who keep their strings in Git, [product] is localization infrastructure that treats copy as a build artifact — it opens pull requests instead of dashboards, escalates ambiguity instead of guessing, and charges a flat price that never meters your words, keys, characters, or reviewers.

**The three claims, and the proof for each:**

| Claim | Proof we can actually show |
|---|---|
| "Cancel and keep everything." | Git is the master. Demo: delete the account, `git pull`, translations still there. Invariant #1 is enforceable and testable. |
| "It tells you when it doesn't know." | The ambiguity queue. Public per-language benchmarks including losses, generated by the Sprint 0 eval harness. Invariants #4 and #7. |
| "Your bill doesn't grow when you do." | Flat per project + active locale. No word/key/character/seat meter, ever. Invariant #3. |

**Why now.** Between Nov 2025 and mid-2026 the two largest self-serve incumbents raised entry pricing and moved metering toward volume: Phrase's cheapest self-serve tier went $135 → $525/mo with Starter deleted and Business behind a sales gate; Lokalise switched from seats-and-keys to **processed words**, raised entry ~20%, dropped the self-serve ceiling, put two of four tiers behind "Book a demo," and withdrew its free-forever plan. A cohort of small teams was priced out of the market in the same nine months we spent building. That cohort is exactly P1/P2. This window closes when someone else notices.

**Anti-positioning (what we deliberately are not).** Not a TMS. Not a CAT tool. Not a translator marketplace. Not a project-management surface. Those are the features that made the incumbents heavy, and the build prompt ruled them out for good reason.

## 7. Competitive analysis

| | Metering | Free tier | Git as master | Refuses to guess | Publishes losses | Non-dev editing |
|---|---|---|---|---|---|---|
| **Phrase** | seats; entry $525/mo self-serve | no | no | no | no | yes |
| **Lokalise** | **processed words**; $144–999+ | withdrawn | no | no | no | yes |
| **Crowdin** | seats/words; free for OSS | OSS only | no | no | no | yes |
| **Tolgee** | keys + seats; €0/500 keys → €499/20k | 500 keys, 3 seats | self-host only | no | no | **yes, in-context** |
| **Locadex / General Translation** | unclear, AI-native | — | no | no | no | — |
| **Us** | **flat: project + active locale** | **unlimited for public repos** | **yes, enforced** | **yes** | **yes** | yes (M6) |

**Honest read of the threat.** Tolgee is the most dangerous: open source, dev-first, well-executed, already has in-context editing and native SDKs, and their free tier (500 keys, 3 seats) covers a real fraction of our target's needs at zero cost. We do not beat Tolgee on features and should not try. We beat Tolgee on (a) their key+seat meter versus our flat price, (b) cloud Tolgee still owning the data where we never do, and (c) ambiguity honesty, which they do not do.

**The AI-native newcomers** (Locadex, General Translation, IntlPull) are the more dangerous long-term threat because they have the same insight we do and no legacy. Our defense is not features; it is the pricing commitment and the published-benchmark trust posture, both of which are expensive to copy because they cost the copier margin and pride.

## 8. Core features (v1)

Ranked by contribution to the three defensible claims. **Backend status is marked honestly** — most of the dashboard has no backend today.

| # | Feature | Serves | Backend today |
|---|---|---|---|
| F1 | `npx` init → detect → extract → translate → PR | PR1, PR6 | **Built & live-validated** (M1) |
| F2 | Typed SDK; missing key breaks the build | PR1, PR4 | Not built (M2) |
| F3 | **Ambiguity queue** — agent escalates rather than guessing; one decision per keystroke | PR4 | Not built (M4). *The most differentiated screen in the product.* |
| F4 | **Non-dev review surface** — edit a string, get a PR, never see a key | PR3 | Not built (M6) |
| F5 | Public quality benchmarks, per language, including losses | PR4, trust | **Harness built** (Sprint 0); publication surface not built |
| F6 | Flat billing, no volume meter | PR2 | Not built (M6) |
| F7 | Repo/project connection & GitHub App install | PR1 | Global env-var install only; per-user flow not built |
| F8 | Visual context capture (Playwright per component) | PR4 quality | Not built (M3) |
| F9 | Signed CDN bundles + OTA locale updates | mobile | Not built (M5) |

## 9. Nice-to-have (explicitly deferred)

Figma plugin · MCP server (the build prompt targets M4; Tolgee already ships one, so this is parity not edge) · translation memory · branch/environment previews · Slack notifications · glossary UI (CLI/file-based first) · analytics on translation quality trends · IDE extension.

## 10. Non-goals

Hard nos, restated from the build prompt because they will be re-proposed by someone every quarter:

- Translator marketplace or vendor management.
- Full CAT editor (segment grid, fuzzy matching, TM leverage percentages).
- Project management (assignments, due dates, capacity).
- Multi-vendor workflow orchestration.
- **Any per-word, per-character, per-key, or per-reviewer counter — including one shown "for transparency."** A visible counter becomes a billable counter under the first revenue pressure. If a feature requires one, the feature is wrong.
- Being a general-purpose TMS.

## 11. Success metrics

**North star: weekly merged translation PRs per active project.** It is the only metric that is simultaneously usage, value delivered, and retention. A dashboard login is not success; a merged PR is.

| Layer | Metric | Target (12 mo) | Why this one |
|---|---|---|---|
| Acquisition | `npx` runs → first merged PR | ≥ 40% | measures the promise literally |
| Activation | time from `npx` to merged PR | p50 < 3 min, p90 < 10 min | the roadmap's own exit criterion |
| Activation | projects reaching 2+ locales in week 1 | ≥ 60% | one locale is a trial, two is adoption |
| Engagement | weekly merged translation PRs / project | ≥ 3 | north star |
| Quality | ambiguity items resolved / raised | ≥ 70% within 7d | proves F3 is used, not ignored |
| Quality | placeholder+ICU integrity in shipped PRs | ≥ 99.5% | already CI-enforced |
| Retention | logo retention, Team tier | ≥ 90% annual | flat pricing should show up here |
| Trust | published benchmark languages | 5 at launch, all where we lose included | invariant #7 |
| Business | public-repo → paid private-repo conversion | ≥ 3% | the OSS funnel is the acquisition thesis |

**Counter-metrics (things we must watch getting worse):** PR revert rate; hand-edited translations later clobbered by a run (must be 0); ambiguity items raised per 100 strings (too high = annoying, too low = we are secretly guessing).

## 12. User stories

**Maya (P1)**
- As a dev with strings already in the repo, I run one command and get a reviewable PR, without creating an account first.
- As a dev re-running on a project I already localized, I am never silently robbed of a translation I hand-fixed.
- As a dev, a missing key fails `tsc` before it fails a user.
- As a dev, when the agent is unsure, I want it to ask me, not to pick.

**Tomás (P2)**
- As a lead, I can forecast next year's bill from this year's plan, at 3x the strings.
- As a lead, I can leave and take everything, and I can verify that claim before I buy.
- As a lead, I know exactly which sub-processors see our source code.

**Inès (P3)**
- As a PM, I fix a wrong German word from a link someone sent me, and it becomes a PR without me knowing what a PR is.
- As a PM, I see the string in the context of the screen it appears on.

**Wolfgang (P4)**
- As a reviewer, I clear 200 strings with the keyboard, never touching the mouse.
- As a reviewer, I see why the machine was unsure.

**Priya (P5)**
- As a security reviewer, I can answer "what leaves our network" from a public page, without a call.

## 13. Functional requirements

**FR-CLI**
1. `init` detects Next.js, Vite+React, React Native (Rails deferred to tree-sitter). *Built.*
2. Extraction never clobbers an existing translation; drops require `--force`. *Built, review-hardened.*
3. Per-locale failure isolation; one locale failing never aborts the run. *Built.*
4. Untranslated keys are surfaced (`missingKeys`), never silently dropped. *Built.*
5. No token → fail before any billed work. *Built.*

**FR-API**
6. Authenticated batch translate; authenticated PR open. *Built (single shared token).*
7. **Per-tenant auth and project scoping.** *Not built. Blocks the entire dashboard.*
8. Persistence of projects, runs, ambiguity items, decisions. *Not built.*
9. Idempotent runs — re-running does not open duplicate PRs.

**FR-WEB**
10. GitHub App install via per-user OAuth callback, multiple installations per account.
11. Ambiguity queue: keyboard-first, one decision per keystroke, decision persists and never re-asks. *Roadmap M4 "fait quand" criterion.*
12. Non-dev review: string in visual context, edit, submit → PR. Never exposes keys/paths.
13. Public benchmark page, per language, losses included.
14. Billing: flat plan selection, no usage meter anywhere in the UI.

**FR-DATA**
15. Postgres holds only: projects, members, active locales, context index, ambiguity decisions, cache. **Never the translations themselves.** *Invariant #1; enforceable test: drop the DB, recover fully from customer repos.*

## 14. Non-functional requirements

- **Performance.** `npx` → PR p50 < 3 min (met: 22 s measured). Dashboard TTI < 1.5 s on mid-tier laptop, 4G. Ambiguity queue keystroke → next item < 100 ms (it is a throughput tool; latency is the feature).
- **Accessibility.** WCAG 2.2 AA, non-negotiable. Keyboard-complete: every action reachable without a mouse. This is not compliance theater — P4's core workflow is keyboard-only, and screen-reader correctness is the honest floor for a product about language access.
- **Reliability.** A failed translation never produces a partial/corrupt PR. Locale isolation already enforced.
- **Security.** Least-privilege GitHub App scopes (`contents:write`, `pull_requests:write` only). Per-tenant isolation. Path allowlist on PR writes (built: `locales/*.json` only).
- **Data residency.** EU residency from first commit (invariant #5). **Currently violated — see R4.**
- **Internationalization of our own product.** We must ship in the languages we claim to serve. Failing this is fatal to credibility.

## 15. Risks

| id | Risk | Severity | Mitigation |
|---|---|---|---|
| **R1** | **Core mechanic already commoditized** (Locadex, General Translation, Crowdin). | **Critical** | Stop selling the pipeline. Lead with ownership + honesty + flat price. Ship F3 (ambiguity) early — it is the only screen competitors have no incentive to copy. |
| **R2** | Tolgee's free tier (500 keys, 3 seats, OSS) is good enough for many targets at €0. | High | Compete on flat pricing above their key ceiling and on data ownership; do not fight on features. |
| **R3** | Flat pricing gets arbitraged — one customer, one "project," a million strings, unbounded LLM cost. | High | Fair-use on *compute*, never on *value*. Rate-limit runs/day, not words. Price per active locale so the natural growth axis is still monetized. Model routing cheap→expensive by ambiguity. |
| **R4** | **We send customer source-code context (`filePath`, `componentName`, `surroundingCode`) to US-hosted Anthropic/OpenAI, contradicting invariant #5 and blocking P5.** | **Critical** | Already documented as a known gap in `CLAUDE.md` and `packages/cli/README.md`. Needs: EU-region model endpoints or BYOK, a public sub-processor list, and an opt-out that degrades gracefully to string-only context. **Must be resolved before selling to any EU enterprise.** |
| R5 | Dashboard scope creep re-creates the TMS we refuse to be. | High | Every screen must map to a claim in §6. Non-goals list is load-bearing. |
| R6 | Ambiguity queue is annoying rather than valuable; users disable it. | Medium | Tune escalation rate; measure resolved/raised; make each item resolvable in one keystroke. |
| R7 | Published benchmarks show us losing and are used against us. | Medium | Accepted deliberately. Honesty is the moat; a competitor quoting our own published loss is an argument we chose to have. |
| R8 | Designing 25 screens now, ~2 of which have backend, produces beautiful fiction. | High | Every screen annotated with backend dependency; build order follows backend reality (§ milestones doc). |

## 16. Edge cases

- Monorepo with several apps and several `locales/` dirs → project ≠ repo; needs explicit path config.
- Non-`locales/` directory conventions → currently hard-rejected by the path allowlist; needs configurable prefix before GA.
- Existing partially-translated catalog → merge must preserve; already enforced.
- Nested locale files (`de.json` containing objects) → merge writes `Record<string,string>`; **known latent type-lie**, must fix before non-flat catalogs are supported.
- JSX with embedded expressions (`<p>You have {count} messages</p>`) → currently extracted as fragments; **must be fixed before translation quality can be claimed**, since fragment translation breaks word order in DE/JA/AR. Documented known gap.
- RTL (Arabic) → affects our own UI, not just output.
- Repo with no default branch / empty repo / protected branch requiring reviews.
- Two runs racing on the same repo → idempotency, branch name collision.
- Revoked GitHub App install mid-run.
- 10k-string monorepo → batch size, timeout, partial-progress reporting.
- A locale the model does not meaningfully support → must fail loudly, not emit garbage.

## 17. Roadmap

Anchored to the existing build-prompt milestones, re-sequenced by the §0 finding.

- **Now (done).** Sprint 0 eval harness. M1 `npx` → PR, live-validated (22 s, real PR).
- **M2 (next).** Typed SDK; missing key breaks build. GitHub Action. Changesets/OSS release. *Plus, newly promoted: fix the JSX-fragment extraction gap — it gates every quality claim.*
- **M3.** Context engine (Playwright per-component capture). Measurable lift on the Sprint 0 harness is the gate.
- **M4.** **Ambiguity queue + agents + benchmark publication.** Promoted in importance: this is the differentiation. Also the first real dashboard screen.
- **M5.** Edge delivery, signed bundles, OTA.
- **M6.** Non-dev review surface, billing, org/teams.
- **Parallel, blocking enterprise:** R4 data-residency resolution.

## 18. Monetization

**Principle (invariant #3, non-negotiable): we never meter words, characters, keys, or reviewers.** Not even as a displayed statistic.

| Tier | Price | Includes | Gate |
|---|---|---|---|
| **Public repos** | **$0 forever, unlimited** | everything | repo is public |
| **Solo** | ~$19/mo flat | 1 private project, 3 active locales, unlimited strings/seats | — |
| **Team** | ~$99/mo flat | 5 private projects, 10 active locales, unlimited strings/seats, ambiguity queue, non-dev review | — |
| **Scale** | ~$399/mo flat | unlimited projects, 25 locales, SSO, audit log, priority routing | — |
| **Enterprise** | custom | EU residency, BYOK, DPA, SOC 2, self-host option | sales |

**Why these axes.** Projects and active locales are the two dimensions that correlate with value received but *not* with the customer's own success — a team with 10x the strings pays the same, which is precisely the promise. Seats are unlimited on purpose: seat-metering is what makes Inès unable to fix her one word, and P3 is our growth mechanic.

**⚠ Prices above are unvalidated hypotheses.** There is no willingness-to-pay evidence behind $19/$99/$399, and the unit economics were not modelled before they were written down. Rough arithmetic (see `08-critique.md` C3) shows the shape is unusual and must be understood before publishing:

| Scenario | Approx. LLM cost |
|---|---|
| Initial run, 2,000 strings × 10 locales | **~$85** — nearly a full month of Team revenue, in one run |
| Steady state, ~50 new strings/week × 10 locales | ~$8/month |
| Adversarial: 1M strings × 10 locales | **~$42,000** — unbounded without a guard |

**Flat pricing is healthy in steady state and fragile at onboarding** — the inverse of the usual SaaS curve. Three consequences, all load-bearing rather than optional:

1. **Push annual billing** (2 months free). Twelve months amortizes the expensive first run and converts the riskiest cohort into the safest.
2. **Fair-use expressed as translations per day** — a compute guard, never a value meter, so invariant #3 holds. Thresholds set from a real cost model, not intuition.
3. **Caching and model routing are architecture, not margin polish.** Content-hash caching (only changed strings cost anything) and cheap-model-by-default with escalation only on flagged ambiguity are what make the flat promise survivable. BYOK on Enterprise moves inference cost to the customer entirely.

**Do not publish prices until modelled.**

**The free public-repo tier is the acquisition strategy, not charity.** It puts our PRs in public repos where other developers read them.

## 19. Enterprise considerations

Ordered by what actually blocks deals:

1. **Data residency & sub-processors (R4).** Currently blocking. Needs a public sub-processor page, EU inference, and BYOK.
2. **SSO/SAML + SCIM.** Table stakes at Scale.
3. **Audit log.** Every translation, decision, PR, permission change — append-only, exportable.
4. **Self-hosting.** Our architecture is unusually well-suited (Git is already the master; the DB is disposable), which makes this a cheaper enterprise concession for us than for Tolgee or Lokalise. Potentially a major advantage.
5. **RBAC.** Owner/Admin/Developer/Reviewer/Billing.
6. **SOC 2 Type II**, DPA, security questionnaire pack, pen-test summary.
7. **Contractual price protection** — the flat-price promise in writing. Given what Phrase and Lokalise just did to their customers, an anti-repricing clause is a *sales weapon*, not a concession.

---

## 20. Open questions requiring a human decision

1. **R4 residency.** EU inference, BYOK, or scope-limit the context payload? Blocks EU enterprise. *Recommend: BYOK + EU endpoints, and make string-only context an explicit degraded mode.*
2. Is "project" = repo, or = directory within a repo? Affects pricing and data model. *Recommend: repo + path, priced per repo.*
3. Do we ship our own hosted app at all in v1, or stay CLI+GitHub-only until M4? *Recommend: CLI-only until the ambiguity queue exists, because that is the first screen worth logging into.*
4. Public benchmarks: do we publish competitor comparisons, or only our own per-language results? *Recommend: only our own. Comparative benchmarking invites a fight we cannot referee.*
