import {
  CLOSER_STAGES,
  type CloserStage,
  funnelPosition,
  isTerminal,
} from './stages.js';

/**
 * Turning a bag of per-stage counts into something a person can read.
 *
 * Pure, and separate from the query, because the ordering decisions here are
 * the ones that quietly mislead. A pipeline drawn in alphabetical order tells
 * the reader nothing about flow; one that hides empty stages makes a funnel
 * look healthier than it is by omitting exactly the steps nothing reached.
 */

export interface StageCount {
  stage: CloserStage;
  count: number;
}

export interface PipelineSummary {
  /** The forward chain, in funnel order, including stages nothing reached. */
  active: StageCount[];
  /** Stages a lead stopped at, ordered by how many stopped there. */
  stopped: StageCount[];
  /** Leads anywhere on the forward chain. */
  activeTotal: number;
  /** Leads in a terminal state. */
  stoppedTotal: number;
  /** Customers. Counted apart from both — see below. */
  won: number;
}

/**
 * Empty stages are kept, and that is the point.
 *
 * A funnel that renders only the stages with leads in them is a funnel that
 * looks continuous when it has a hole: nine `contacted`, nothing `replied`,
 * three `interested` reads as a working pipeline instead of as the question it
 * should raise. Zero is a measurement.
 */
export function summarisePipeline(
  counts: readonly StageCount[],
): PipelineSummary {
  const byStage = new Map<CloserStage, number>();
  for (const row of counts) {
    byStage.set(row.stage, (byStage.get(row.stage) ?? 0) + row.count);
  }

  const active = CLOSER_STAGES.filter(
    (stage) => !isTerminal(stage) && stage !== 'won',
  )
    .map((stage) => ({ stage, count: byStage.get(stage) ?? 0 }))
    .sort(
      (a, b) => (funnelPosition(a.stage) ?? 0) - (funnelPosition(b.stage) ?? 0),
    );

  /*
   * Terminal stages sort by count, not by the enum.
   *
   * They are not a sequence — nothing flows from `not_a_fit` to `lost` — so
   * ordering them by position would invent a progression. What a reader wants
   * from this list is which wall leads hit most often, and the tie-break is
   * alphabetical so the order is stable between two loads.
   */
  const stopped = CLOSER_STAGES.filter(isTerminal)
    .map((stage) => ({ stage, count: byStage.get(stage) ?? 0 }))
    .sort((a, b) => b.count - a.count || a.stage.localeCompare(b.stage));

  return {
    active,
    stopped,
    activeTotal: active.reduce((sum, row) => sum + row.count, 0),
    stoppedTotal: stopped.reduce((sum, row) => sum + row.count, 0),
    /*
     * `won` is neither, and giving it its own field is the whole reason this
     * function exists rather than two `filter` calls at the call site. Counting
     * customers among "active" would say the work is unfinished; counting them
     * among "stopped" would file success with failure.
     */
    won: byStage.get('won') ?? 0,
  };
}
