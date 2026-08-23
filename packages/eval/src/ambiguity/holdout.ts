import type { AmbiguityCase } from '@localize-infra/schemas';

/**
 * Split the corpus into a half to tune against and a half to report on.
 *
 * Tuning a prompt while watching all 200 cases and then reporting the score on
 * those same 200 cases measures how well the prompt was fitted to this corpus,
 * not how well the agent escalates. With a hundred pairs and a handful of
 * iterations that is not a theoretical risk — it is the likely outcome, and it
 * would produce a number that looks like progress and predicts nothing.
 *
 * So: `dev` is the only half the prompt is allowed to see during iteration, and
 * `holdout` is scored once, at the end. A gap between the two is itself the
 * finding — it says the gain was fitted rather than real.
 *
 * Split by **pair**, never by case, so a pair's two halves always land on the
 * same side. Splitting by case would put the open half in dev and the settled
 * half in holdout, and the pair-discrimination metric — the one thing the
 * aggregates cannot show — would be uncomputable on both.
 *
 * Stratified by category and deterministic, so both halves carry polysemy,
 * grammar and register in the same proportions and a rerun compares against
 * the same division.
 */
export interface CorpusSplit {
  dev: AmbiguityCase[];
  holdout: AmbiguityCase[];
}

export function splitDevHoldout(cases: AmbiguityCase[]): CorpusSplit {
  const seen = new Map<string, string>();
  const perCategory = new Map<string, number>();

  for (const testCase of cases) {
    if (seen.has(testCase.pairId)) continue;
    const index = perCategory.get(testCase.category) ?? 0;
    perCategory.set(testCase.category, index + 1);
    seen.set(testCase.pairId, index % 2 === 0 ? 'dev' : 'holdout');
  }

  return {
    dev: cases.filter((c) => seen.get(c.pairId) === 'dev'),
    holdout: cases.filter((c) => seen.get(c.pairId) === 'holdout'),
  };
}
