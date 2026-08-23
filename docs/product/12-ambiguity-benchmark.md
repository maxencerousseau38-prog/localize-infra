# Does the agent escalate when it should?

Date: 2026-08-23

Invariant 4 — *the agent raises ambiguities, it does not guess* — is the
product's differentiator and had never been measured. This is the measurement.

**It does not hold.** On 100 strings written to be genuinely ambiguous, the
agent asked a question about 14–24% of them and translated the rest without
saying anything. When it does ask, it is usually right to (82–88% precision).
The bar is not merely high, as the prompt intends; it is high enough that the
feature rarely fires.

---

## The corpus

200 cases, in `packages/eval/src/ambiguity/`, generated from
`cases.ts` and committed as `data/ambiguity-cases.json` with a test that
rebuilds and compares — the arrangement `benchmarks.json` and `cost-model.json`
already use.

They are **100 pairs**, not 200 independent strings. Each pair is the same
source text, the same target locale, the same component, differing **only** in
the surrounding code:

| Half | Surrounding keys | Expected |
|---|---|---|
| open | generic labels that settle nothing | escalate |
| settled | sibling keys that fix the reading | confident |

That design is the point rather than a convenience. A corpus of ambiguous
strings alone measures recall and nothing else, and an agent that escalated on
every string would score 100% on it — while producing exactly the failure the
production prompt warns about, *"a queue that raises every second string is a
queue nobody reads."* Holding everything constant but the context is what makes
a disagreement attributable: if both halves get the same answer, the agent is
not reading context, whatever the aggregate says.

The three categories are the ones the production prompt itself declares as
grounds for escalation. Measuring against criteria the system was never given
would measure the wrong thing.

| Category | Cases | Locales |
|---|---|---|
| polysemy | 120 | de, ja, es, ar, pt-BR |
| insufficient-grammar | 50 | es, pt-BR, ar, de — languages that inflect for agreement |
| register | 30 | de, ja, es — languages that force a formality choice |

Locales are assigned round-robin, not chosen per case: choosing would let a
preference for the locale where a case "works best" inflate the score.

**The halves of a pair are never sent in the same request.** Each of the two
groups takes exactly one half of every pair, alternating which, so neither
batch is all-ambiguous and the model never sees the pairing itself. A test
pins this; without it the numbers below would be a confound rather than a
measurement.

---

## What was run

The **production** path: the prompt in `apps/api/src/translate/prompt.ts`,
`handleTranslateBatch`, the parser, `claude-sonnet-5` at the production effort
setting. No overrides — the runner passes no settings, so this measurement
follows production if production changes.

Three runs of the identical corpus. `npm run eval:ambiguity -w @localize-infra/api`,
raw observations in `apps/api/eval/results/ambiguity-run-{1,2,3}.json`.

---

## Results

| Run | Precision | Recall | F1 | Pairs discriminated | Asked wrongly | Guessed instead of asking |
|---|---|---|---|---|---|---|
| 1 | 88.2% | 15.0% | 25.6% | 13 / 100 | 2 | 85 |
| 2 | 82.8% | 24.0% | 37.2% | 20 / 100 | 5 | 76 |
| 3 | 82.4% | 14.0% | 23.9% | 12 / 100 | 3 | 86 |

600 cases scored, **zero errors** — every string came back, so nothing here is
an artefact of failed calls.

### By category

| Category | Recall, run 1 / 2 / 3 | Precision, run 1 / 2 / 3 |
|---|---|---|
| polysemy | 15.0% / 21.7% / 13.3% | 81.8% / 86.7% / 72.7% |
| insufficient-grammar | 24.0% / 28.0% / 24.0% | 100% / 87.5% / 100% |
| register | **0% / 26.7% / 0%** | no data / 66.7% / no data |

Register is the weakest and the least stable: in two runs of three the agent
raised **not one** of the fifteen strings where German or Japanese forces a
formality the English does not supply. "No data" rather than 0% for precision
in those runs is deliberate — an agent that never predicts the positive class
has undefined precision, and printing 0% would read as a measurement that was
taken.

---

## What the numbers mean

**One run of this benchmark is not a number.** Recall moved from 15.0% to 24.0%
to 14.0% on an identical corpus with an identical configuration. Any single
figure quoted from one run — including a flattering one — would be
overstating what was measured. That is why three runs are reported rather than
a best or a mean, and why the runner numbers its output files instead of
overwriting.

**Precision is genuinely good.** 82–88% across runs, and 100% on the grammar
category twice. When the agent raises a question, a developer will almost
always find it a fair question. The prompt's stated fear — crying wolf until
ignored — is not what is happening.

**Recall is the finding.** 76–86 of the 100 genuinely ambiguous strings were
translated with a confident answer and no question. For a product whose
differentiator is *"it asks instead of guessing"*, that is the gap between the
claim and the behaviour.

**The pair count says it is not a context problem in the way one might hope.**
Only 12–20 of 100 pairs got different answers for their two halves. The other
80-odd got the same answer both times — and since the agent rarely escalates,
that overwhelmingly means *confident in both*. It is not weighing the
surrounding code and deciding; it is mostly answering confidently regardless.

**The prompt is doing this on purpose, and the dial is set too far.** The
instruction says to mark a string ambiguous *"ONLY when a competent human
translator would have to ask"*, forbids escalating merely because several good
translations exist, and states that the failure mode to avoid is crying wolf.
Given that, low recall and high precision is the intended shape. What the
measurement adds is where the dial actually sits: at a recall low enough that
the differentiator fires on roughly one ambiguous string in five.

---

## Limitations, stated because they bound the conclusion

- **The ground truth is mine.** Every case carries a `rationale` field naming
  why the expected answer is what it is, which makes each one arguable, and
  the corpus is in the open-source package so it can be argued with. But no
  second person has reviewed it. A reviewer who disagreed with, say, twenty
  of the polysemy cases would move recall by several points.
- **Three runs bound the variance loosely.** They establish that variance is
  large; they do not establish a confidence interval.
- **One model, one configuration.** `claude-sonnet-5` at production settings.
  Whether a different effort setting trades precision for recall is unmeasured
  and is the obvious next experiment.
- **The strings are written, not harvested.** They are realistic UI strings but
  they are not drawn from a real product, so the *rate* of ambiguity here says
  nothing about the rate in a customer's repository. This measures the agent's
  behaviour on ambiguity, not how much ambiguity exists in the wild.
- **Escalation quality is not scored.** Whether the question asked is a *good*
  question, and whether the alternatives offered are the right two, is recorded
  in the observations but not measured. That needs a human, and belongs with
  the human evaluation in `08-critique.md` §C2 that has never happened.

---

## What follows

Nothing in this document changes production. The dial is set in one place —
`INSTRUCTIONS` in `apps/api/src/translate/prompt.ts` — and moving it is a
product decision with a real cost on the other side: every point of recall
bought at the expense of precision is a question a developer did not need to
answer.

The measurement now exists to make that decision with, and to tell afterwards
whether the change worked. Before it, the honest answer to "does the agent
escalate when it should?" was *nobody knows*.
