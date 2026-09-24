import { describe, expect, it } from 'vitest';
import { type CoverageShape, isBehind, summariseCoverage } from './summary';

/**
 * That the sentence at the top of `/locales` agrees with the rows beneath it.
 *
 * The band is the page's dominant element, so it is the claim a reader takes
 * away without scrolling. It is derived from the same rows the list renders,
 * which makes disagreement impossible by construction — and this pins the
 * arithmetic that makes the derivation right.
 */

const locale = (over: Partial<CoverageShape> = {}): CoverageShape => ({
  translated: 10,
  total: 10,
  needsDecision: 0,
  ...over,
});

describe('summariseCoverage', () => {
  it('says nothing when there is nothing to say', () => {
    /*
     * Not "0 languages behind". The page shows its empty state instead, which
     * names what is missing; a cheerful zero here would be a measurement
     * nobody took — the rule `lib/metrics/funnel.ts` already follows.
     */
    expect(summariseCoverage([])).toBeNull();
  });

  it('puts a pending question above a language that is merely behind', () => {
    /*
     * The ordering is the whole design of this function. Behind is fixed by
     * running again, which the product can do; a question cannot be resolved by
     * anything but a person. So a workspace that is both reports the question.
     */
    const summary = summariseCoverage([
      locale({ translated: 2, total: 10 }),
      locale({ needsDecision: 3 }),
    ]);
    expect(summary?.tone).toBe('ambiguous');
    expect(summary?.headline).toBe('3 questions waiting on you');
  });

  it('counts questions, not the languages carrying them', () => {
    // Two languages with two questions each is four questions. Reporting "2"
    // would be counting the wrong noun, and a reader would open Review
    // expecting half the work.
    const summary = summariseCoverage([
      locale({ needsDecision: 2 }),
      locale({ needsDecision: 2 }),
    ]);
    expect(summary?.headline).toBe('4 questions waiting on you');
    expect(summary?.detail).toContain('2 languages');
  });

  it('reports behind only when nothing is waiting', () => {
    const summary = summariseCoverage([
      locale({ translated: 4, total: 10 }),
      locale(),
    ]);
    expect(summary?.tone).toBe('degraded');
    expect(summary?.headline).toBe('1 language is behind');
  });

  it('agrees with itself in the singular', () => {
    // Three plurals in one function is three chances to ship "1 languages are
    // behind", which is the kind of thing nobody writes a test for and every
    // reader notices.
    expect(summariseCoverage([locale({ needsDecision: 1 })])?.headline).toBe(
      '1 question waiting on you',
    );
    expect(summariseCoverage([locale({ needsDecision: 1 })])?.detail).toContain(
      '1 language.',
    );
    expect(summariseCoverage([locale()])?.headline).toBe(
      'The one target language is current',
    );
  });

  it('is confident only when every language is complete', () => {
    const summary = summariseCoverage([locale(), locale(), locale()]);
    expect(summary?.tone).toBe('confident');
    expect(summary?.headline).toBe('All 3 languages are current');
  });

  it('treats a zero-total language as behind rather than complete', () => {
    /*
     * `translated: 0, total: 0` passes `translated >= total`, so a naive
     * completeness check calls a language with nothing in it current. The row
     * component guards this with `total > 0`; `isBehind` is the shared
     * predicate both it and the page count through, so the two cannot disagree
     * about what "behind" means.
     */
    expect(isBehind({ translated: 0, total: 0, needsDecision: 0 })).toBe(false);
    expect(isBehind({ translated: 0, total: 4, needsDecision: 0 })).toBe(true);
    expect(isBehind({ translated: 4, total: 4, needsDecision: 0 })).toBe(false);
  });
});
