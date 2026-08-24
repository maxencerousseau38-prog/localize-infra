import { describe, expect, it } from 'vitest';
import { type StageCount, summarisePipeline } from './pipeline.js';
import { CLOSER_STAGES, isTerminal } from './stages.js';

const counts = (...rows: StageCount[]) => rows;

describe('summarisePipeline', () => {
  it('returns every forward stage for an empty pipeline', () => {
    const summary = summarisePipeline([]);
    expect(summary.active).toHaveLength(13);
    expect(summary.activeTotal).toBe(0);
    expect(summary.stoppedTotal).toBe(0);
    expect(summary.won).toBe(0);
  });

  /*
   * The reason this function exists rather than a filter at the call site.
   *
   * A pipeline rendered from only the stages that have leads looks continuous
   * when it has a hole: nine contacted, nothing replied, three interested reads
   * as a working funnel instead of as the question it should raise.
   */
  it('keeps stages nothing reached, so a hole in the funnel is visible', () => {
    const summary = summarisePipeline(
      counts(
        { stage: 'contacted', count: 9 },
        { stage: 'interested', count: 3 },
      ),
    );
    const replied = summary.active.find((r) => r.stage === 'replied');
    expect(replied).toBeDefined();
    expect(replied?.count).toBe(0);
  });

  it('orders the forward chain by funnel position', () => {
    const summary = summarisePipeline([]);
    const stages = summary.active.map((r) => r.stage);
    expect(stages[0]).toBe('discovered');
    expect(stages.indexOf('contacted')).toBeGreaterThan(
      stages.indexOf('qualified'),
    );
    expect(stages).not.toContain('won');
    for (const stage of stages) expect(isTerminal(stage)).toBe(false);
  });

  /*
   * Terminal stages are not a sequence — nothing flows from `not_a_fit` to
   * `lost` — so ordering them by enum position would invent a progression.
   * What a reader wants is which wall leads hit most often.
   */
  it('orders terminal stages by how many stopped there', () => {
    const summary = summarisePipeline(
      counts(
        { stage: 'lost', count: 2 },
        { stage: 'not_a_fit', count: 7 },
        { stage: 'unresponsive', count: 4 },
      ),
    );
    expect(summary.stopped.map((r) => r.stage).slice(0, 3)).toEqual([
      'not_a_fit',
      'unresponsive',
      'lost',
    ]);
  });

  it('breaks a tie between terminal stages the same way every time', () => {
    const first = summarisePipeline(
      counts({ stage: 'lost', count: 3 }, { stage: 'not_now', count: 3 }),
    );
    const again = summarisePipeline(
      counts({ stage: 'not_now', count: 3 }, { stage: 'lost', count: 3 }),
    );
    expect(first.stopped.map((r) => r.stage)).toEqual(
      again.stopped.map((r) => r.stage),
    );
  });

  /*
   * `won` is counted apart from both, and this is the assertion that pins it.
   *
   * Among "active" it would say the work is unfinished; among "stopped" it
   * would file success with failure. Either makes the one number the whole
   * pipeline exists to produce unreadable.
   */
  it('counts won separately from both active and stopped', () => {
    const summary = summarisePipeline(
      counts(
        { stage: 'won', count: 5 },
        { stage: 'contacted', count: 2 },
        { stage: 'lost', count: 1 },
      ),
    );
    expect(summary.won).toBe(5);
    expect(summary.activeTotal).toBe(2);
    expect(summary.stoppedTotal).toBe(1);
    expect(summary.active.some((r) => r.stage === 'won')).toBe(false);
    expect(summary.stopped.some((r) => r.stage === 'won')).toBe(false);
  });

  it('adds up duplicate rows for the same stage', () => {
    const summary = summarisePipeline(
      counts(
        { stage: 'contacted', count: 2 },
        { stage: 'contacted', count: 3 },
      ),
    );
    expect(summary.active.find((r) => r.stage === 'contacted')?.count).toBe(5);
    expect(summary.activeTotal).toBe(5);
  });

  it('accounts for every stage exactly once across the three buckets', () => {
    const summary = summarisePipeline([]);
    const seen = [
      ...summary.active.map((r) => r.stage),
      ...summary.stopped.map((r) => r.stage),
      'won' as const,
    ];
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen.length).toBe(CLOSER_STAGES.length);
  });
});
