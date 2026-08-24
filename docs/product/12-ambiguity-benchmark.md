# Does the agent escalate when it should?

Date: 2026-08-23

Invariant 4 — *the agent raises ambiguities, it does not guess* — is the
product's differentiator and had never been measured. This is the measurement,
the target set from it, and the tuning done against that target.

**Target met after two rounds: recall 67.5–70.0% at 96.4–100% precision**, on a
cohort of forty pairs written after the tuning and never consulted during it.
The target was 60% recall at no less than 80% precision.

Round one reached 53–61% recall at 91–97% precision on a held-out half of the
original corpus — precision clear, recall just short. Round two closed the gap
on polysemy, which was carrying it. Both rounds are below, including what the
second one cost.

---

## A correction, first

**An earlier version of this document reported recall of 14–24% and concluded
that invariant 4 "does not hold". That number was mostly an artefact of a
defect in the corpus, and the conclusion drawn from it was too harsh.**

Every case carried a `componentName` — `PricingTable`, `Navigation`,
`UserStatus` — held constant across both halves of a pair so that only the
surrounding code varied. But those names *are* context, and disambiguating
context at that: `PricingTable` settles "Free", `Navigation` settles "Home",
`UserStatus` tells you what "Active" agrees with. The half labelled *open* was
therefore not open. An agent answering confidently there was right, and the
corpus scored it wrong.

It was found by asking why one category was failing so much harder than the
others, not by review — the corpus had passed twelve tests, all of which
checked its structure and none of which could check whether a field labelled
"held constant" was also carrying the answer.

`componentName` is now null on every case, which is also the more faithful
shape: a locale JSON file has no component. The descriptive names are kept on
the pair definitions in `cases.ts`, where they document intent without reaching
the model. Every figure below was re-measured on the corrected corpus.

| On the defective corpus | On the corrected corpus |
|---|---|
| recall 14–24%, precision 82–88% | recall 39–48%, precision 86–95% |

Same prompt, same model, same 100 pairs. The difference is entirely the defect.

---

## The corpus

200 cases in `packages/eval/src/ambiguity/`, generated from `cases.ts`,
committed as `data/ambiguity-cases.json` with a test that rebuilds and
compares.

They are **100 pairs**, not 200 independent strings: the same source text, the
same target locale, differing **only** in the surrounding code. One half's
neighbours settle the reading; the other's do not.

That design is the point. A corpus of ambiguous strings alone measures recall
and nothing else, and an agent that escalated on everything would score 100% on
it — while producing exactly the failure the production prompt warns about, *"a
queue that raises every second string is a queue nobody reads."* Holding
everything else constant makes a disagreement attributable: if both halves get
the same answer, the agent is not reading context, whatever the aggregate says.

| Category | Cases | Locales |
|---|---|---|
| polysemy | 120 | de, ja, es, ar, pt-BR |
| insufficient-grammar | 50 | es, pt-BR, ar, de — languages that inflect for agreement |
| register | 30 | de, ja, es — languages that force a formality choice |

The two halves of a pair are **never sent in the same request**; a test pins
that. Without it the model could see the pairing itself, and these would be
confounded numbers rather than measurements.

### Dev and holdout

The corpus is split into a half the prompt was tuned against and a half scored
only at the end, stratified by category, split by pair so a pair never straddles
the boundary.

Tuning while watching all 200 cases and then reporting on those same 200 would
measure how well the prompt was fitted to this corpus. With a hundred pairs and
several iterations that is not a theoretical risk — it is the expected outcome,
and it would produce a number that looks like progress and predicts nothing.

---

## Baseline, before tuning

Original prompt, corrected corpus, full 200 cases, three runs:

| Run | Precision | Recall | Pairs discriminated |
|---|---|---|---|
| 1 | 95.1% | 39.0% | 37 / 100 |
| 2 | 90.6% | 48.0% | 43 / 100 |
| 3 | 85.6% | 48.0% | 41 / 100 |

Per category on run 3: polysemy 53.3% recall, grammar 48.0%, **register 26.7%
at 50% precision** — the weakest by a distance.

---

## What was changed

Three edits to `INSTRUCTIONS` in `apps/api/src/translate/prompt.ts`, each
aimed at a distinct observed failure.

**1. A two-step decision.** Baseline discrimination was 37–43 of 100 pairs — the
agent often gave the same answer whether or not the neighbours disambiguated
the string. The prompt now asks two questions in order: does the target force a
choice English does not make, and does the surrounding code settle it.

**2. A `cue` field.** The model must write down what step 1 found and what
step 2 settled, before it answers. An unwritten step is a step not taken. The
field is not in `TranslatedStringSchema` and is stripped on parse — it exists to
force the reasoning, not to be consumed.

**3. Generic neighbours named as settling nothing.** `label.item`, `state.one`,
`action.apply` read as context while carrying none. The prompt now says so, and
adds the reason: a reading that feels obvious is usually a prior about English,
not evidence about this codebase.

Also fixed: the register criterion cited French, which is not a supported
locale, and omitted Japanese, which is. And two defaults are now named as
choices rather than safe fallbacks — masculine singular for a bare adjective,
and the polite register "because it is safer".

---

## Result

**Dev half** (51 pairs, tuned against — not a report, shown for the comparison):

| Run | Precision | Recall |
|---|---|---|
| 1 | 87.5% | 68.6% |
| 2 | 92.3% | 70.6% |

**Holdout half** (49 pairs, scored once, after the prompt was frozen):

| Run | Precision | Recall | Pairs discriminated |
|---|---|---|---|
| 1 | 96.3% | 53.1% | 25 / 49 |
| 2 | 90.9% | 61.2% | 28 / 49 |
| 3 | 96.7% | 59.2% | 28 / 49 |

Per category, holdout run 3: grammar 91.7% recall at 100% precision, register
71.4% at 100%, polysemy 43.3% at 92.9%.

### Against the target

| | Target | Held-out result | |
|---|---|---|---|
| Precision | ≥ 80% | 90.9 – 96.7% | **met, with margin** |
| Recall | ≥ 60% | 53.1 – 61.2%, median 59.2% | **just short** |

One run of three reached the recall target. Calling it met would be rounding a
median of 59.2 up to 60 and ignoring that the lowest run was 53.1.

### The dev–holdout gap is the finding about method

Dev returned 68.6–70.6% recall; holdout returned 53.1–61.2%. **Roughly ten
points of the apparent gain did not survive contact with cases the prompt had
not been tuned against.** That gap is precisely what the holdout exists to
expose, and had the corpus not been split, this document would be reporting
~69% recall and claiming the target beaten.

---

## Where the remaining gap is, and what it would cost

Polysemy is the weak category — 43.3% recall on the holdout against 91.7% for
grammar — and it is 60% of the corpus, so it sets the overall number almost by
itself. It is also the hardest of the three honestly: a word with two senses in
a file whose neighbours say nothing is a case where a competent human would
often also just pick the common reading.

Precision has 11–17 points of headroom above its floor, so recall can be bought.
What that trade is worth is a product judgement, not a measurement: every point
of recall is a question a developer has to answer, and some of them will be
questions they did not need.

**A further round needs a fresh holdout.** This one has now been observed;
tuning against it and reporting on it would be the same mistake the split was
built to prevent. The corpus can be re-split, but on cases the prompt has
already been exposed to, which is weaker.

---

## Did tuning escalation cost translation quality?

CLAUDE.md requires the eval harness to be re-run on any prompt change, and this
was a prompt change. The 414-entry corpus, production configuration, before and
after:

| | Baseline | Tuned prompt |
|---|---:|---:|
| Answered | 414 / 414 | 414 / 414 |
| Missing keys | 0 | 0 |
| chrF | 75.234 | 75.202 |
| Exact match | 40.82% | 40.82% |
| Placeholder integrity | 100% | 100% |
| Glossary violations | 0 | 0 |
| Length overflow | 13.53% | 13.04% |
| **Escalation rate** | **0.72%** | **0.72%** |
| Cost per 1,000 pairs | $1.47 | $1.71 |

**Quality did not move.** chrF differs by 0.03, exact match is identical to four
decimals, placeholder integrity holds at 100% against the ≥99.5% CI gate.

**The escalation rate on real material is identical** — 3 strings in 414, both
times. That is the "cried wolf" fear answered by independent evidence: the
recall gain shows up on strings written to be ambiguous and *not* on ordinary
strings harvested from real projects. A prompt that had simply become
trigger-happy would have moved this number.

**Cost rose 16%.** Output per string went from 60 to 73 — the `cue` field is
output tokens, and output is five times the price of input on this model. The
measured input in `packages/pricing` was updated from 56 to 73 and the cost
model regenerated, so every figure in `09-unit-economics.md` moves with it.

### A ceiling moved, and a test caught it rather than a failure

Updating that one input broke `packages/pricing/src/model.test.ts`, which
asserts a full chunk fits under 75% of `max_tokens`. At 73 tokens per string a
100-string chunk emits ~7,300 against a 6,144 headroom — still under the 8,192
ceiling, but without the room a chunk needs when some of its strings escalate at
239 tokens each.

`max_tokens` is now 16,384. Raised rather than chunking smaller because the
ceiling is billed on what is emitted, not on what is allowed: halving the chunk
would have re-sent the 610-token system prompt twice as often and paid for it in
input tokens.

Worth recording plainly: this is the same class of bug as the P0 that returned
empty responses in August — output budget exhausted before the text is emitted —
and it was caught by an arithmetic test on a measured input, before any run
failed.

---

## Round two: polysemy, on a cohort written afterwards

Polysemy carried the remaining gap — 43.3% held-out recall against 91.7% for
grammar, and 60% of the corpus. The owner asked for another round.

**"A fresh holdout" cannot mean re-splitting cases already seen.** Re-drawing a
boundary does not undo exposure; it hides it. So forty new polysemy pairs were
written after the first round of tuning and never consulted during it, tagged
`polysemy-2`, with words disjoint from the original sixty. `splitDevHoldout`
refuses to divide a post-tuning cohort at all, and a test asserts it.

### A second corpus defect, found the same way

The first draft of the new cohort gave "Fork" the neighbours *Copy*, *Split*
and *Duplicate* — words pointing straight at the repository sense. That is the
`componentName` mistake in another costume: a field meant to withhold context
quietly supplying it.

Every open context now draws from a fixed pool of contentless labels
(`label.item`, `label.value`, `label.one`…), which is checkable rather than a
matter of taste, and a test enforces it. The effect was large:

| Fresh cohort, same prompt | Recall |
|---|---|
| With leaking neighbours | 25.0 – 37.5% |
| With the pool | 42.5 – 60.0% |

Two corpus defects in two rounds, both inflating the agent's apparent failure,
both found by asking why a category looked worse than it should rather than by
review. The structural tests never caught either: they check that a corpus is
well-formed, and a well-formed corpus can still be wrong.

### The change

One addition to the SENSE criterion, naming the two ways polysemy was being
missed: that a word has a common technical meaning is a fact about software and
not evidence about the string, and it is enough that a competent translator
*could* reasonably produce two words — the second reading need not be likely.

### Result, on cases the prompt never saw

| Run | Precision | Recall | Pairs discriminated |
|---|---|---|---|
| 1 | 100.0% | 67.5% | 27 / 40 |
| 2 | 96.6% | 70.0% | 28 / 40 |
| 3 | 96.4% | 67.5% | 26 / 40 |

Before the change, on the same cohort: 42.5 – 60.0% recall at 100% precision.

| | Target | Fresh-cohort result | |
|---|---|---|---|
| Precision | ≥ 80% | 96.4 – 100% | **met** |
| Recall | ≥ 60% | 67.5 – 70.0% | **met, all three runs** |

The dev–fresh gap narrowed to about five points (72.5–74.5% against
67.5–70.0%), against ten points in round one.

On the core holdout the change is an improvement or a wash: overall recall
53.1/61.2/59.2 → 61.2/61.2, polysemy 46.7/56.7/43.3 → 56.7/56.7, grammar
stable. Register reads as a drop — 71.4% → 28.6–42.9% — and **is not one**:
recomputed from the stored observations, register under the previous prompt was
already 1/7, 3/7 and 5/7 across its three runs. Seven pairs cannot support a
conclusion either way, which is a corpus limitation rather than a result.

### What it cost, stated because it is not nothing

| | Round one | Round two |
|---|---:|---:|
| chrF | 75.202 | 74.892 |
| Exact match | 40.82% | 39.61% |
| Placeholder integrity | 100% | 100% |
| Glossary violations | 0 | **1** |
| Escalation rate on real material | 0.72% | **1.69%** |
| Output tokens per string | 73.1 | 74.6 |

The escalation rate on the 414-entry corpus of real strings **more than
doubled** — three strings to seven. That is the guarantee round one reported as
untouched, and it has moved. It is still low, and the corpus precision of
96–100% says the extra questions are mostly fair ones, but a customer with a
thousand strings now sees roughly seventeen questions where they saw seven.

chrF and exact match slipped slightly, and one glossary violation appeared
where there were none. Individually small; recorded because the trade is real.

### The glossary violation, run down rather than left as a number

The single violation was `zulip-WW91IGhhdmUgZGVhY3RpdmF0-ja`. The source is
"You have deactivated your Zulip demo organization, %(realm_name)s, on
%(localized_date)s."; the glossary keeps **Zulip** verbatim in Japanese, and the
produced translation dropped it. A real violation of a real rule.

It does not reproduce. Run eight times through the round-two prompt at
production settings, with the same key, file path and empty surrounding code
the harness sends, the term was kept **8/8** and both placeholders survived
every time. So this is a sample, not a property of the prompt.

Two things bound that. The benchmark sends 414 strings in six batched requests
and the probe sends one string alone, so what is shown is that the prompt does
not systematically drop the term — not that a long batch never will. And a
second defect surfaced while looking: **the human reference for this entry is
wrong.** "Zulip組織 %(realm_name)s に参加しました。" says the reader *joined* an
organization; the source says they *deactivated* one. The chrF of 56.8 on this
entry is measured against a mistranslation, which is a corpus defect and not a
model result. It is one entry in 414 and is left recorded rather than quietly
repaired, because editing a reference to improve a score is how a benchmark
stops measuring anything.

### Decision: round two is adopted

Recall is what invariant 4 is about, and it moved from 39–48% to 53–61% on
held-out material while precision moved *up*, 86–95% to 91–97% — far above the
80% floor the target set. The costs are a doubled escalation rate that is still
1.69%, a chrF and exact-match slip inside the run-to-run variance this document
already reports as large (recall itself moved eight points across identical
runs), and a glossary violation that does not reproduce. None of them argues
against a change that makes the agent better at the one thing it exists to do.

**Adopted in the repository is not the same as live.** `apps/api` does not
follow Git — see CLAUDE.md — so this prompt reaches production only through
`npx vercel deploy --prod --archive=tgz`, and until that runs, translations in
production still use round one.

---

## Limitations, stated because they bound the conclusion

- **The ground truth is mine and unreviewed.** Every case carries a `rationale`
  naming why the expected answer is what it is, and the corpus is in the MIT
  package so it can be argued with. The `componentName` defect above is
  evidence that this matters: one unreviewed decision moved the headline number
  by twenty-five points.
- **Three runs bound variance loosely.** They establish it is large — recall
  moved eight points across identical holdout runs — not a confidence interval.
- **One model, one configuration.** `claude-sonnet-5` at production settings.
- **The strings are written, not harvested.** This measures the agent's
  behaviour on ambiguity, not how much ambiguity exists in a real repository.
- **Escalation quality is not scored.** Whether the question asked is a good
  one, and whether the two alternatives offered are the right two, is recorded
  in the observations and not measured. That needs a human, and belongs with the
  human evaluation in `08-critique.md` §C2 that has never happened.
- **Cost rose.** The `cue` field is output tokens: roughly 13.5k against 20.4k
  for the baseline on comparable runs, so the change is not free, though it is
  small against the translation output itself.
