import { describe, expect, it } from 'vitest';
import { buildAmbiguityCases } from './cases.js';
import { splitDevHoldout } from './holdout.js';

const cases = buildAmbiguityCases();
const { dev, holdout } = splitDevHoldout(cases);

function pairIds(subset: typeof cases) {
  return new Set(subset.map((c) => c.pairId));
}

function categoryCounts(subset: typeof cases) {
  const counts = new Map<string, number>();
  for (const c of subset)
    counts.set(c.category, (counts.get(c.category) ?? 0) + 1);
  return counts;
}

describe('splitDevHoldout', () => {
  const core = cases.filter((c) => c.cohort === 'core');

  it('uses every core case exactly once', () => {
    expect(dev.length + holdout.length).toBe(core.length);
    const ids = [...dev, ...holdout].map((c) => c.id);
    expect(new Set(ids).size).toBe(core.length);
  });

  /*
   * A cohort written after a round of tuning is unseen, and that is a property
   * that can only be spent once. Splitting half of it into a dev set would
   * spend it on the first caller that asked.
   */
  it('never divides a cohort written after tuning', () => {
    expect(cases.some((c) => c.cohort === 'polysemy-2')).toBe(true);
    for (const subset of [dev, holdout]) {
      expect(subset.every((c) => c.cohort === 'core')).toBe(true);
    }
  });

  /*
   * The guard that makes the holdout a holdout.
   *
   * A pair split across the two halves would leak: tuning against the open
   * half in dev tunes against a string whose settled twin is in the holdout,
   * and the held-out score would be reporting on material the prompt was
   * fitted to. It would also make pair discrimination uncomputable on both
   * sides, which is the one metric the aggregates cannot substitute for.
   */
  it('never splits a pair across the two halves', () => {
    const devPairs = pairIds(dev);
    const holdoutPairs = pairIds(holdout);
    for (const pairId of devPairs) {
      expect(holdoutPairs.has(pairId)).toBe(false);
    }
    expect(devPairs.size + holdoutPairs.size).toBe(
      new Set(core.map((c) => c.pairId)).size,
    );
  });

  it('keeps both halves complete pairs, so discrimination is computable', () => {
    for (const subset of [dev, holdout]) {
      for (const pairId of pairIds(subset)) {
        const halves = subset.filter((c) => c.pairId === pairId);
        expect(halves).toHaveLength(2);
        expect(halves.filter((c) => c.expected === 'escalate')).toHaveLength(1);
      }
    }
  });

  it('stratifies by category rather than slicing the corpus in order', () => {
    const devCounts = categoryCounts(dev);
    const holdoutCounts = categoryCounts(holdout);
    expect(devCounts.get('polysemy')).toBe(60);
    expect(holdoutCounts.get('polysemy')).toBe(60);
    // Core only — the 40 pairs of `polysemy-2` are held out entire.
    expect(devCounts.get('insufficient-grammar')).toBe(26);
    expect(holdoutCounts.get('insufficient-grammar')).toBe(24);
    expect(devCounts.get('register')).toBe(16);
    expect(holdoutCounts.get('register')).toBe(14);
  });

  it('is deterministic', () => {
    expect(splitDevHoldout(cases).dev.map((c) => c.id)).toEqual(
      dev.map((c) => c.id),
    );
  });

  it('keeps each half internally balanced between escalate and confident', () => {
    for (const subset of [dev, holdout]) {
      const escalate = subset.filter((c) => c.expected === 'escalate').length;
      expect(escalate).toBe(subset.length / 2);
    }
  });
});
