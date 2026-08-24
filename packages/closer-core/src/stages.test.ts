import { describe, expect, it } from 'vitest';
import {
  CLOSER_STAGES,
  type CloserStage,
  STAGE_LABELS,
  TERMINAL_STAGES,
  funnelPosition,
  funnelProgress,
  isTerminal,
} from './stages.js';

describe('the stage vocabulary', () => {
  it('names every stage exactly once', () => {
    expect(new Set(CLOSER_STAGES).size).toBe(CLOSER_STAGES.length);
  });

  /*
   * A stage without wording renders its database identifier —
   * "qualified_opportunity" — which tells the reader they are looking at a
   * table rather than at their pipeline. The Record type catches a missing key
   * at compile time; this catches a key that exists with nothing in it.
   */
  it('gives every stage a label and a meaning', () => {
    for (const stage of CLOSER_STAGES) {
      expect(STAGE_LABELS[stage].label.trim()).not.toBe('');
      expect(STAGE_LABELS[stage].meaning.trim()).not.toBe('');
    }
  });

  it('draws terminal stages from the stage list', () => {
    for (const stage of TERMINAL_STAGES) {
      expect(CLOSER_STAGES).toContain(stage);
    }
  });
});

describe('isTerminal', () => {
  it.each(TERMINAL_STAGES)('treats %s as terminal', (stage) => {
    expect(isTerminal(stage)).toBe(true);
  });

  /*
   * The one that matters.
   *
   * Grouping `won` with `lost` because both are endings would make every funnel
   * chart count success as a stop rather than as the point. It is the outcome
   * the pipeline exists to produce.
   */
  it('does not treat won as terminal', () => {
    expect(isTerminal('won')).toBe(false);
  });

  it('treats every stage on the forward chain as non-terminal', () => {
    const active = CLOSER_STAGES.filter(
      (s) => !(TERMINAL_STAGES as readonly string[]).includes(s),
    );
    expect(active).toHaveLength(14);
    for (const stage of active) expect(isTerminal(stage)).toBe(false);
  });
});

describe('funnelPosition', () => {
  it('orders the forward chain', () => {
    expect(funnelPosition('discovered')).toBe(0);
    expect(funnelPosition('contacted')).toBeGreaterThan(
      funnelPosition('qualified') as number,
    );
    expect(funnelPosition('won')).toBeGreaterThan(
      funnelPosition('negotiation') as number,
    );
  });

  /*
   * Null rather than a number, and this is the design rather than a gap.
   *
   * Any number would place a terminal stage somewhere on the funnel, and a lead
   * that said "not now" is not further along than one being researched — it is
   * off the line. Returning null forces the caller to decide where such rows
   * sort, which is the decision that would otherwise be made by accident.
   */
  it.each(TERMINAL_STAGES)('returns null for %s', (stage) => {
    expect(funnelPosition(stage)).toBeNull();
  });
});

describe('funnelProgress', () => {
  it('runs from 0 at discovered to 1 at won', () => {
    expect(funnelProgress('discovered')).toBe(0);
    expect(funnelProgress('won')).toBe(1);
  });

  it('increases monotonically along the chain', () => {
    const chain: CloserStage[] = CLOSER_STAGES.filter(
      (s) => funnelProgress(s) !== null,
    );
    const values = chain.map((s) => funnelProgress(s) as number);
    for (let i = 1; i < values.length; i += 1) {
      expect(values[i] as number).toBeGreaterThan(values[i - 1] as number);
    }
  });

  it('stays within 0 and 1', () => {
    for (const stage of CLOSER_STAGES) {
      const value = funnelProgress(stage);
      if (value === null) continue;
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it.each(TERMINAL_STAGES)('has no progress for %s', (stage) => {
    expect(funnelProgress(stage)).toBeNull();
  });
});
