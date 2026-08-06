# Self-critique of documents 01–07

Date: 2026-08-06
Purpose: adversarial review of our own work, before anyone builds against it.

The instruction was to critique every decision and keep going until this could confidently ship as a world-class SaaS. Below is the honest state. **Three findings are serious enough that building against these documents without addressing them would be a mistake.**

---

## C1 — 🔴 Zero primary research. The personas are inventions.

**The problem.** Maya, Tomás, Inès, Wolfgang and Priya are constructed archetypes. Not one is derived from an interview, a survey, a support ticket, or a sales call. The *problems* they represent are evidence-backed — the extract/paste/push loop, the dev↔localization skill gap, setup cost as an adoption barrier, and the 2025–26 repricing are all documented — but the **people** are fiction, and every design decision downstream inherits that.

Specifically unvalidated: that Inès exists in enough accounts to justify FE-5; that Wolfgang wants keyboard throughput rather than a comfortable review pace; that Maya prefers absence over control.

**Why it matters.** The ambiguity queue (FE-4) is designed as a keyboard-first throughput instrument on the strength of an assumption about how P4 works. If reviewers actually work in slow, deliberative bursts, the whole interaction model is wrong.

**Fix.** Ten interviews before FE-4 is built — five developers currently hand-editing locale files, three who left Phrase/Lokalise after the repricing, two non-developers who have tried to fix a translation. FE-1 (marketing) can and should ship first *without* this; it is a broadcast, not a bet on interaction design.

**Status: unresolved. This is the largest weakness in the set.**

---

## C2 — 🔴 The benchmark page had no data behind it

**The problem.** I positioned public per-language benchmarks as a core differentiator (PRD §6), put them on the landing page, and scheduled them in FE-1 — the *first* milestone. Then I drew a wireframe with German 71%, Japanese 48%, Arabic 44%.

**Those numbers were invented.** Sprint 0 built the eval harness but the human evaluation never ran; no evaluators were ever recruited. The only real number is the deterministic one (100% placeholder/ICU integrity, 413/413, CI-verified).

Publishing fabricated numbers on the one page whose entire purpose is honesty would have been self-refuting — and would have been a real, shipped lie, not a documentation slip.

**Fix applied.** `04-wireframes.md` §11 rewritten into two stages: Stage 1 publishes only the CI-verified mechanical results and states plainly that human preference is *not yet measured*, with the pre-commitment to publish losses. Stage 2 waits for real evaluation. Hard rule added: no illustrative numbers ever ship on that page.

**Residual risk.** FE-1's value is now smaller than claimed. "Not yet measured" is still more credible than competitors' unsourced accuracy claims, but it is weaker than real data. **Recruiting the 15 evaluators is now on the critical path for the marketing claim**, not just for Sprint 0's exit gate.

**Status: fixed in the documents; underlying data still missing.**

---

## C3 — 🔴 Flat pricing has an unmodelled cost bomb at onboarding

**The problem.** I committed to flat pricing (invariant #3, and the strongest part of the positioning) and named $19/$99/$399 without modelling unit economics. Rough arithmetic for a Team customer at $99/mo:

| Scenario | Translations | Approx. LLM cost |
|---|---|---|
| **Initial run** — 2,000 strings × 10 locales | 20,000 | **~$85** |
| **Steady state** — ~50 new strings/week × 10 locales | ~2,000/mo | **~$8/mo** |
| **Adversarial** — 1M strings × 10 locales | 10M | **~$42,000** |

Two conclusions, neither of which appears in the PRD:

1. **Month one costs almost the entire month's revenue.** A customer who churns after 30 days is roughly break-even *before* Stripe fees and support. The model is healthy in steady state and fragile at onboarding — the exact inverse of the usual SaaS shape.
2. **The adversarial case is unbounded and would be fatal.** "Unlimited strings" without a compute guard is an open invitation.

**Fixes required in the PRD before pricing is published:**
- **Push annual billing hard** (offer 2 months free). Twelve months amortizes the initial run and converts the riskiest cohort into the safest.
- Quantify the fair-use guard as **translations per day**, not words ever — a compute limit, not a value meter, so invariant #3 holds. Numbers must be set from a real cost model.
- Content-hash caching and cheap-model-by-default routing move from "margin control" (a footnote) to **load-bearing architecture**. They are what make the flat promise survivable.
- Treat the $19/$99/$399 figures as **hypotheses with no willingness-to-pay evidence**, to be tested against the displaced Phrase/Lokalise cohort.

**Status: unresolved. Do not publish prices until modelled.**

---

## C4 — 🟠 No hands-on competitor evaluation

All competitive analysis is from secondary sources — comparison articles and pricing pages read at arm's length. Nobody signed up for Tolgee, ran Crowdin's GitHub integration, or timed Lokalise's onboarding. The original build prompt explicitly called for a hands-on teardown using a browser, and that was not done.

**Consequence.** The claim "we beat Tolgee on data ownership and pricing, not features" is reasoned, not verified. Tolgee's in-context editor may already be better than our planned FE-5, which would reorder the roadmap.

**Fix.** Two hours per competitor, hands-on, before FE-4 and FE-5. Cheap, and I can do it with browser access if you want it.

---

## C5 — 🟠 "A decision is never re-asked" breaks when the source string changes

The M4 exit criterion, which I restated as a hard behavioural contract, has an unhandled case: **if the English source text changes, a prior decision may no longer be valid.** "Close" → "Close window" is a different string with a different resolution.

Neither the roadmap nor my documents define this. Options: invalidate on any source change (safe, possibly noisy); invalidate on semantic change only (needs a similarity threshold, i.e. a new judgement call); or keep the decision and flag it as *possibly stale*.

**Recommendation:** invalidate and re-ask, but pre-fill the previous answer and label it "you previously chose X for the earlier wording." Preserves trust in both directions.

**Status: gap identified, needs a product decision.**

---

## C6 — 🟠 Twenty-five screens designed against two screens of backend

Stated in the architecture doc, but it deserves restating as the dominant schedule risk. Track B (identity, tenancy, persistence, per-user GitHub install, ambiguity API, suggestions API, billing) is **XL and completely unbuilt** — the repo has no database at all. Every milestone from FE-2 onward is gated behind it.

The honest read: **FE-1 is weeks away; everything else is months away**, and the gap is backend, not frontend. Any plan presenting FE-2…FE-6 as near-term is misleading.

---

## C7 — 🟡 Unverified specifics

| Claim | Status |
|---|---|
| All token pairs meet WCAG contrast | **Only one pair spot-checked** (Iris `#5B4BE8` on white ≈ 5.8:1, passes). The rest are proposed, not verified. The CI contrast job in FE-0 must run before the palette is called final. |
| Ambiguity queue read-only on mobile | A judgement call with no evidence. Wolfgang may want to triage on a train. Test in the C1 interviews. |
| Two-app split (`site` / `web`) | Justified on bundle isolation, but it is two deploys and two configs for a pre-revenue product. Reasonable, not obviously correct. |
| Inter + JetBrains Mono + Noto | Safe and well-reasoned, but Inter is the most-used interface font on the web; distinctiveness comes from the palette and State Rule, not the type. Accepted deliberately — legibility across three writing systems beats novelty. |

---

## C8 — 🟡 What I removed, and why that was right

Recorded so it is not quietly re-added: analytics dashboards, activity graphs, and "words translated" counters were cut from the Home screen. They are what every competitor shows, and they are the on-ramp to a usage meter — which invariant #3 forbids. The cost is that Home looks sparse next to a Lokalise screenshot. **That is the correct trade**, but expect it to be challenged by whoever sees a competitor demo next.

---

## Would I ship this?

**The documents: yes, as a basis for FE-0 and FE-1.** The strategy is sound, the competitive read is current and evidence-backed, the invariants are respected, and the reframe away from the now-commoditized `npx → PR` pitch is the single most valuable thing in the set.

**The product, on this alone: no** — and claiming otherwise would be the same failure as C2. Three things must happen first:

1. **Ten user interviews** (C1) before FE-4's interaction model is committed.
2. **A unit-economics model** (C3) before any price is published.
3. **Track B** (C6), which is a full backend project and the real schedule.

**Recommended next action: build FE-0 and FE-1 and ship the public site.** It needs no backend, it opens the market window that the Phrase/Lokalise repricing created, and it is the cheapest way to buy the evidence that C1 and C3 are missing — real traffic from a real, displaced audience, which is better validation than any number of interviews.
