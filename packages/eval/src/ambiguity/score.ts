import type {
  AmbiguityCase,
  AmbiguityCategory,
  AmbiguityObservation,
} from '@localize-infra/schemas';

export interface ConfusionCounts {
  /** Should ask, did ask. */
  truePositive: number;
  /** Should not ask, asked anyway — the "cried wolf" error. */
  falsePositive: number;
  /** Should ask, guessed instead — the invariant-4 violation. */
  falseNegative: number;
  /** Should not ask, did not. */
  trueNegative: number;
}

export interface ScoreBlock extends ConfusionCounts {
  scored: number;
  precision: number | null;
  recall: number | null;
  f1: number | null;
}

export interface PairOutcome {
  pairId: string;
  category: AmbiguityCategory;
  /** Escalated on the open half and not on the settled half. */
  discriminated: boolean;
  /** Same answer for both halves, whatever that answer was. */
  insensitive: boolean;
  /** Escalated on the settled half but not the open one. */
  inverted: boolean;
}

export interface AmbiguityScore {
  overall: ScoreBlock;
  byCategory: Record<AmbiguityCategory, ScoreBlock>;
  /**
   * How often the agent gave different answers to the two halves of a pair,
   * in the right direction.
   *
   * The headline precision and recall can both look respectable while this is
   * near zero — that is the signature of an agent applying a blanket policy to
   * a word rather than reading the context around it. Because the halves of a
   * pair differ in nothing else, this number cannot be explained by anything
   * but the context.
   */
  pairs: {
    total: number;
    discriminated: number;
    insensitive: number;
    inverted: number;
    /** Pairs where at least one half errored, so the pair says nothing. */
    incomplete: number;
  };
  errors: number;
}

function emptyCounts(): ConfusionCounts {
  return {
    truePositive: 0,
    falsePositive: 0,
    falseNegative: 0,
    trueNegative: 0,
  };
}

function block(counts: ConfusionCounts): ScoreBlock {
  const { truePositive, falsePositive, falseNegative, trueNegative } = counts;
  const predictedPositive = truePositive + falsePositive;
  const actualPositive = truePositive + falseNegative;

  // Null rather than 0 when the denominator is empty: an agent that never
  // escalated has undefined precision, not perfect or zero precision, and
  // printing 0% would read as a measurement that was taken.
  const precision =
    predictedPositive === 0 ? null : truePositive / predictedPositive;
  const recall = actualPositive === 0 ? null : truePositive / actualPositive;
  const f1 =
    precision === null || recall === null || precision + recall === 0
      ? null
      : (2 * precision * recall) / (precision + recall);

  return {
    ...counts,
    scored: truePositive + falsePositive + falseNegative + trueNegative,
    precision,
    recall,
    f1,
  };
}

export function scoreAmbiguity(
  cases: AmbiguityCase[],
  observations: AmbiguityObservation[],
): AmbiguityScore {
  const byId = new Map(observations.map((o) => [o.caseId, o]));
  const overall = emptyCounts();
  const categories = new Map<AmbiguityCategory, ConfusionCounts>();
  let errors = 0;

  for (const testCase of cases) {
    const observed = byId.get(testCase.id)?.observed ?? null;
    if (observed === null) {
      errors += 1;
      continue;
    }

    const counts =
      categories.get(testCase.category) ??
      categories.set(testCase.category, emptyCounts()).get(testCase.category);
    if (!counts) continue;

    const shouldEscalate = testCase.expected === 'escalate';
    const didEscalate = observed === 'escalate';
    const field = shouldEscalate
      ? didEscalate
        ? 'truePositive'
        : 'falseNegative'
      : didEscalate
        ? 'falsePositive'
        : 'trueNegative';

    overall[field] += 1;
    counts[field] += 1;
  }

  const pairIds = [...new Set(cases.map((c) => c.pairId))];
  const outcomes: PairOutcome[] = [];
  for (const pairId of pairIds) {
    const open = cases.find(
      (c) => c.pairId === pairId && c.expected === 'escalate',
    );
    const settled = cases.find(
      (c) => c.pairId === pairId && c.expected === 'confident',
    );
    if (!open || !settled) continue;

    const openObserved = byId.get(open.id)?.observed ?? null;
    const settledObserved = byId.get(settled.id)?.observed ?? null;
    if (openObserved === null || settledObserved === null) {
      outcomes.push({
        pairId,
        category: open.category,
        discriminated: false,
        insensitive: false,
        inverted: false,
      });
      continue;
    }

    outcomes.push({
      pairId,
      category: open.category,
      discriminated:
        openObserved === 'escalate' && settledObserved === 'confident',
      insensitive: openObserved === settledObserved,
      inverted: openObserved === 'confident' && settledObserved === 'escalate',
    });
  }

  const complete = outcomes.filter(
    (o) => o.discriminated || o.insensitive || o.inverted,
  );

  const byCategory = {} as Record<AmbiguityCategory, ScoreBlock>;
  for (const [category, counts] of categories) {
    byCategory[category] = block(counts);
  }

  return {
    overall: block(overall),
    byCategory,
    pairs: {
      total: outcomes.length,
      discriminated: outcomes.filter((o) => o.discriminated).length,
      insensitive: outcomes.filter((o) => o.insensitive).length,
      inverted: outcomes.filter((o) => o.inverted).length,
      incomplete: outcomes.length - complete.length,
    },
    errors,
  };
}

export function formatPercent(value: number | null): string {
  return value === null ? 'no data' : `${(value * 100).toFixed(1)}%`;
}
