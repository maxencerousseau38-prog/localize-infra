# Which model and settings should be the default

Date: 2026-08-22
Status: **the benchmark ran.** Quality is compared, not assumed. No production
default has been changed by this document.

`docs/product/09-unit-economics.md` recommended `effort: low` on cost and
correctness grounds and said, twice, that its effect on **quality** was
unmeasured. This measures it.

Everything below comes from `apps/api/eval/run.ts`, which drives the
**production** path — the prompt in `src/translate/prompt.ts`, the batching and
`missingKeys` accounting in `handleTranslateBatch`, the parser in
`parse-response.ts` — over the existing 414-entry corpus in `packages/eval`,
scored with that package's existing deterministic checks. Results are committed
at `apps/api/eval/results/`.

---

## The recommendation, first

**Keep `claude-sonnet-5` with `effort: low` as the default.** It was the only
configuration that answered every string, and on the one locale where all three
completed it also produced the *best* quality of the three. The cheaper option
was not a quality trade — it was a straight win.

That is the opposite of what the cost model assumed it was buying, and it is
worth stating plainly: `effort: low` was adopted in the P0 fix because it made
the pipeline work, with an explicit note that it might cost accuracy. It does
not.

| | Sonnet 5, `effort: low` | Sonnet 5, default reasoning | Haiku 4.5 |
|---|---:|---:|---:|
| Strings answered | **414 / 414** | 90 / 414 | 323 / 414 |
| Locales completed | **5 of 5** | 1 of 5 | 3 of 5 |
| chrF, Spanish¹ | **80.55** | 75.52 | 79.70 |
| Exact match, Spanish¹ | **40.0%** | 27.8% | 40.0% |
| Placeholders preserved | 19 / 19 | 2 / 2 | 13 / 13 |
| Glossary violations | **0** | 0 | 0 |
| Escalations | 2 | 2 | **0** |
| Latency per request | 42.7 s | 68.6 s | **34.5 s** |
| Cost per 1,000 pairs | $1.47 | $1.99 | **$0.44** |

¹ Spanish is the only locale all three configurations answered completely.
Comparing a five-locale average against a one-locale average would flatter
whichever config failed on the hard locales, so the like-for-like column is the
one to read.

---

## What each configuration did

### Sonnet 5, `effort: low` — the proposed default

Answered all 414 strings across all five locales, in five requests, with **65
thinking tokens in total**. Every one of the eleven requests it made across the
comparison and robustness runs returned parseable output.

### Sonnet 5, default reasoning — fails, and is also worse

Answered one locale of five, and **zero of six** attempts when the German batch
was repeated. The failures are all the same shape: the model spends its output
budget reasoning and the JSON is cut off mid-string.

Diagnosed directly on German at 90 strings: `stop_reason: max_tokens`, 8,192
output tokens of which **5,401 were thinking**, response truncated at position
4,456. At 45 strings the same configuration succeeds — so the failure is the
batch size against the reasoning overhead, not a hard limit.

`09-unit-economics.md` reported this configuration failing at `max_tokens:
4096`. It fails at 8,192 too. It would need a chunk size around 45, which
roughly doubles the number of requests *and* costs 36% more per pair.

And it is not buying quality with that: on Spanish it scored **75.52 chrF
against 80.55**, with exact-match agreement of 27.8% against 40.0%. More
reasoning produced worse translations here, not better ones.

### Haiku 4.5 — cheap, close on quality, and not reliable enough

Three locales of five, and the arithmetic is the interesting part. Its Spanish
quality is within a point of Sonnet's (79.70 against 80.55) and its Brazilian
Portuguese is *better* (83.3 against 81.4). Its Japanese is 8.3 points worse
(65.1 against 73.4). It preserved every placeholder and violated no glossary
term. It is 3.3× cheaper and 20% faster.

What rules it out is **unparseable output**. German failed in the comparison run and
again on one of five repeats — with `stop_reason: end_turn`, so the model
finished and emitted invalid JSON rather than running out of room. See the
robustness table below.

There is **no retry** in the pipeline. One malformed response is one locale that
produces nothing, in a run that still opens a pull request for the locales that
worked.

---

## Reliability, measured by repetition

`apps/api/eval/robustness.ts` sends the same 90-string German batch five times
per configuration through the production path. Committed at
`apps/api/eval/results/robustness.json`.

| Configuration | Complete attempts | Failure mode |
|---|---:|---|
| Sonnet 5, `effort: low` | **6 / 6** | — |
| Sonnet 5, default reasoning | **0 / 6** | Output truncated mid-JSON; once, no text block at all |
| Haiku 4.5 | **4 / 6** | Invalid JSON at `end_turn` — finished and emitted something unparseable |

Six attempts: the five repeats plus the one in the comparison run. They cannot
establish a failure rate. What they can establish is whether a failure recurs,
and it does — for Haiku intermittently, for default reasoning every single time.

Default reasoning failing 6 of 6 at 90 strings settles what the comparison run
only suggested: its one success there was the locale that happened to be short
enough, not a configuration that mostly works.

---

## What this benchmark could not measure

Stated here rather than buried, because three of the things a reader would most
want are not in it.

**Human preference — never run.** `08-critique.md` §C2 recorded that the human
evaluation was never carried out and that no evaluators were ever recruited.
That is still true. chrF and exact match are **reference-agreement proxies**: a
different but perfectly good translation scores as a miss, and a clumsy one
sharing characters with the reference scores well. Their *ordering* between
configurations on the same references is informative; their absolute level is
not, and neither is a substitute for asking a speaker of the language.

**ICU messages and plural categories — no applicable input.** The corpus
contains **zero** ICU messages, so `validateIcu` and `pluralCategoriesCorrect`
had nothing to run against. This is exactly the "No data" case CLAUDE.md
already records for `/benchmarks`. Any claim about how these models handle ICU
plurals would be invented.

**Placeholder preservation — 19 entries.** All 19 survived in every
configuration, which is a real result and a thin one: one failure would have
moved the figure five percentage points. It supports "no configuration is
obviously broken on placeholders" and not much more.

**Escalation behaviour — underpowered, and the one open risk.** Two escalations
fired out of 414 for `effort: low`, two out of 90 for default reasoning, zero
out of 323 for Haiku. The ones that fired were the right kind — *Digest*,
*Prompt*, *Architect*, *Sharing*, all genuine two-sense words. But two events
cannot distinguish 0.48% from 0%, and the corpus was assembled from
already-translated open-source projects rather than to contain ambiguity.

The rate difference that *would* matter if it survived a real test is that
default reasoning escalated at 2.2% against `effort: low`'s 0.48%. If lowering
effort makes the model less willing to say "I don't know", that trades against
invariant 4 — the agent raises ambiguities rather than guessing — and no amount
of chrF would show it. **This is the one place where `effort: low` might be
costing something, and this benchmark cannot tell.**

Settling it needs a corpus of strings that are ambiguous *by construction*,
with the expected escalation recorded — roughly 50 deliberately two-sense
strings per locale, which does not exist and would have to be written.

**Single-run quality.** Each configuration translated each locale once. Model
output varies between calls; the quality figures carry no error bars.

---

## Should the architecture change?

Mostly no. Three things came out of the run.

**Keep the chunking, and keep it where it is.** 100 strings per request is
comfortable for the recommended configuration — 5,727 output tokens against an
8,192 ceiling on the largest batch — and it is the size that makes the
one-request-per-locale shape work. Chunking in `handleTranslateBatch` rather
than in each caller is what let this benchmark drive the real path at all.

**Add a retry.** This is the one change the evidence actually demands, and it
is not model-specific: a malformed or truncated response currently loses every
string in its chunk with no second attempt. One retry would have recovered every
Haiku failure observed here, and would make the difference between "a locale is
missing" and "a locale took an extra four seconds". It is also the cheapest
insurance against the tail this benchmark is too small to see.

**Consider asking for structured output.** Every failure in this benchmark was
a JSON parsing failure rather than a translation failure. The API can constrain
the response format instead of asking for it in prose. That is a larger change
and it is not needed for the MVP, but it removes the entire failure class rather
than retrying it.

---

## Answers to the questions this was run to settle

**Which model and config should be the MVP default?**
`claude-sonnet-5` with `output_config: { effort: 'low' }` and
`max_tokens: 8192` — which is what `createAnthropicProvider` already sends. No
change to production defaults is required, and this document does not make one.

**Is `effort: low` acceptable?**
Yes, on the evidence available, and it is better than the alternative rather
than merely cheaper: complete where default reasoning is not, and higher
quality where they can be compared. The reservation is escalation behaviour,
which is unmeasured and worth measuring before this is called settled.

**Is Haiku acceptable for any tier or stage?**
Not as the default, and not yet anywhere. Its quality is close enough to be
tempting — within a point on Spanish, better on Portuguese — but it produced
invalid JSON in 2 of 6 repeated attempts on one batch, it never escalated once in 323
strings, and it is 8.3 chrF points behind on Japanese.

Where it would become reasonable: **after** a retry exists, for a free tier, on
locales where it has been shown to hold up. Routing by locale is a real option
the data supports and this document does not recommend acting on yet.

**Expected cost per 1,000 translation pairs**
$1.47 measured, against $1.55 modelled in `09-unit-economics.md` — the model
was 5% conservative, which is the direction to be wrong in. Haiku measured
$0.44.

**Expected quality trade-off**
None against default reasoning; it is a gain. Against Haiku, Sonnet buys
reliability and Japanese quality for 3.3× the token cost, which at $1.47 per
1,000 pairs is a rounding error against every plan in `09-unit-economics.md`.

**Should the current architecture be kept?**
Yes, plus a retry. See above.
