import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  AmbiguityCase,
  AmbiguityObservation,
} from '@localize-infra/schemas';
import {
  buildAmbiguityCases,
  formatPercent,
  freshCohort,
  scoreAmbiguity,
  splitDevHoldout,
  splitIntoUnpairedGroups,
} from '../../../packages/eval/src/index.js';
import {
  type AnthropicUsage,
  createAnthropicProvider,
} from '../src/router/anthropic.js';
import { handleTranslateBatch } from '../src/translate/handler.js';

/**
 * Does the agent escalate when it should, and stay quiet when it should not?
 *
 * Invariant 4 is the product's differentiator and had no measurement. The
 * 414-entry translation corpus produced two escalations on material that
 * contains nothing ambiguous by construction, which can report neither
 * precision nor recall.
 *
 * Goes through the **production** path: the prompt in `src/translate/prompt.ts`,
 * `handleTranslateBatch`, the parser in `parse-response.ts`, the production
 * model and effort setting. Measuring a prompt written for this system against
 * some other prompt would measure nothing about the product.
 *
 * Run with: npm run eval:ambiguity -w @localize-infra/api
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, 'results');
const MODEL_ID = process.env.API_ANTHROPIC_MODEL ?? 'claude-sonnet-5';
/*
 * Which file this run writes.
 *
 * Runs are numbered rather than overwritten because one run of this benchmark
 * is not a number: across three runs of the identical corpus, recall moved
 * between 14% and 24%. Overwriting would have hidden that, and a single figure
 * would have been reported as though it were stable.
 */
const RUN_LABEL = process.env.AMBIGUITY_RUN ?? '1';
/*
 * Which half of the corpus to run.
 *
 * "dev" is the only half the prompt may be tuned against; "holdout" is scored
 * once, at the end. Reporting a tuned prompt's score on the cases it was tuned
 * against measures the fitting, not the agent — see `holdout.ts`.
 */
const SUBSET = process.env.AMBIGUITY_SUBSET ?? 'all';

function selectSubset(all: AmbiguityCase[]): AmbiguityCase[] {
  if (SUBSET === 'all') return all;
  /*
   * "fresh" is the cohort written after the last round of tuning. It is the
   * only subset that can answer whether a gain generalised, and it can answer
   * that once — after which it is material the author has seen.
   */
  if (SUBSET === 'fresh') return freshCohort(all);
  const { dev, holdout } = splitDevHoldout(all);
  if (SUBSET === 'dev') return dev;
  if (SUBSET === 'holdout') return holdout;
  throw new Error(
    `AMBIGUITY_SUBSET must be all, dev, holdout or fresh — got ${SUBSET}`,
  );
}

function byLocale(cases: AmbiguityCase[]): Map<string, AmbiguityCase[]> {
  const map = new Map<string, AmbiguityCase[]>();
  for (const testCase of cases) {
    const bucket = map.get(testCase.targetLocale) ?? [];
    bucket.push(testCase);
    map.set(testCase.targetLocale, bucket);
  }
  return map;
}

async function runGroup(
  group: AmbiguityCase[],
  provider: ReturnType<typeof createAnthropicProvider>,
): Promise<AmbiguityObservation[]> {
  const observations: AmbiguityObservation[] = [];

  for (const [locale, entries] of byLocale(group)) {
    try {
      const result = await handleTranslateBatch(
        {
          targetLocale: locale as never,
          strings: entries.map((c) => ({
            key: c.id,
            text: c.sourceText,
            filePath: c.filePath,
            componentName: c.componentName,
            surroundingCode: c.surroundingCode,
          })),
        },
        provider,
        MODEL_ID,
      );

      const returned = new Map(result.translations.map((t) => [t.key, t]));
      for (const entry of entries) {
        const translation = returned.get(entry.id);
        if (!translation) {
          // A key the model never answered is an error, not a "confident".
          // Counting it as one would credit silence as a decision.
          observations.push({
            caseId: entry.id,
            observed: null,
            question: null,
            alternativeCount: 0,
            error: 'missing from response',
          });
          continue;
        }
        observations.push({
          caseId: entry.id,
          observed:
            translation.confidence === 'ambiguous' ? 'escalate' : 'confident',
          question: translation.question ?? null,
          alternativeCount: translation.alternatives?.length ?? 0,
          error: null,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      for (const entry of entries) {
        observations.push({
          caseId: entry.id,
          observed: null,
          question: null,
          alternativeCount: 0,
          error: message,
        });
      }
    }
    console.log(`  ${locale}: ${entries.length} strings`);
  }

  return observations;
}

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');

  const cases = selectSubset(buildAmbiguityCases());
  const [groupA, groupB] = splitIntoUnpairedGroups(cases);
  const usage: AnthropicUsage[] = [];
  /*
   * No settings overrides. `createAnthropicProvider` already defaults to the
   * production values — effort "low", 8192 max tokens — and passing them again
   * here would let this measurement drift from production silently the next
   * time one of them changes.
   */
  const provider = createAnthropicProvider(apiKey, {
    onUsage: (u) => usage.push(u),
  });

  console.log(
    `ambiguity corpus [${SUBSET}]: ${cases.length} cases, ${cases.length / 2} pairs, model ${MODEL_ID}`,
  );
  console.log('group A');
  const a = await runGroup(groupA, provider);
  console.log('group B');
  const b = await runGroup(groupB, provider);

  const observations = [...a, ...b];
  const score = scoreAmbiguity(cases, observations);

  const inputTokens = usage.reduce((sum, u) => sum + (u.inputTokens ?? 0), 0);
  const outputTokens = usage.reduce((sum, u) => sum + (u.outputTokens ?? 0), 0);

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(
    join(OUT_DIR, `ambiguity-${SUBSET}-run-${RUN_LABEL}.json`),
    `${JSON.stringify(
      { modelId: MODEL_ID, inputTokens, outputTokens, observations },
      null,
      2,
    )}\n`,
    'utf-8',
  );

  console.log('');
  console.log(`scored          ${score.overall.scored} / ${cases.length}`);
  console.log(`errors          ${score.errors}`);
  console.log(`precision       ${formatPercent(score.overall.precision)}`);
  console.log(`recall          ${formatPercent(score.overall.recall)}`);
  console.log(`F1              ${formatPercent(score.overall.f1)}`);
  console.log('');
  console.log(
    `asked when it should not (false positives)  ${score.overall.falsePositive}`,
  );
  console.log(
    `guessed when it should ask (false negatives) ${score.overall.falseNegative}`,
  );
  console.log('');
  console.log('by category');
  for (const [category, blockScore] of Object.entries(score.byCategory)) {
    console.log(
      `  ${category.padEnd(22)} P ${formatPercent(blockScore.precision).padEnd(8)} R ${formatPercent(blockScore.recall)}`,
    );
  }
  console.log('');
  console.log('pairs (same string, context is the only difference)');
  console.log(
    `  discriminated  ${score.pairs.discriminated} / ${score.pairs.total}`,
  );
  console.log(`  same answer    ${score.pairs.insensitive}`);
  console.log(`  inverted       ${score.pairs.inverted}`);
  console.log(`  incomplete     ${score.pairs.incomplete}`);
  console.log('');
  console.log(`tokens          ${inputTokens} in / ${outputTokens} out`);
}

const invokedPath = process.argv[1]?.replace(/\\/g, '/');
const modulePath = fileURLToPath(import.meta.url).replace(/\\/g, '/');
if (invokedPath === modulePath) {
  await main();
}
