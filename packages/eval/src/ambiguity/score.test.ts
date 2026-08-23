import type { AmbiguityObservation } from '@localize-infra/schemas';
import { describe, expect, it } from 'vitest';
import { buildAmbiguityCases } from './cases.js';
import { formatPercent, scoreAmbiguity } from './score.js';

const cases = buildAmbiguityCases();

function observe(
  decide: (expected: 'escalate' | 'confident') => 'escalate' | 'confident',
): AmbiguityObservation[] {
  return cases.map((c) => ({
    caseId: c.id,
    observed: decide(c.expected),
    question: null,
    alternativeCount: 0,
    error: null,
  }));
}

describe('scoreAmbiguity', () => {
  it('scores a perfect agent as perfect, and every pair as discriminating', () => {
    const score = scoreAmbiguity(
      cases,
      observe((expected) => expected),
    );
    expect(score.overall.precision).toBe(1);
    expect(score.overall.recall).toBe(1);
    expect(score.overall.f1).toBe(1);
    expect(score.pairs.discriminated).toBe(100);
    expect(score.pairs.insensitive).toBe(0);
  });

  /*
   * The test the pairing exists for.
   *
   * An agent that escalates on everything gets perfect recall, which is the
   * number a positives-only corpus would report — and it is the exact failure
   * the production prompt warns about, a queue nobody reads. Precision catches
   * half of it. The pair count catches all of it: zero discrimination means
   * the context was not read, and no aggregate can explain that away.
   */
  it('exposes an always-escalate agent through the pairs, not just precision', () => {
    const score = scoreAmbiguity(
      cases,
      observe(() => 'escalate'),
    );
    expect(score.overall.recall).toBe(1);
    expect(score.overall.precision).toBe(0.5);
    expect(score.pairs.discriminated).toBe(0);
    expect(score.pairs.insensitive).toBe(100);
  });

  it('reports undefined precision for an agent that never escalates, not zero', () => {
    const score = scoreAmbiguity(
      cases,
      observe(() => 'confident'),
    );
    expect(score.overall.recall).toBe(0);
    // Never predicting the positive class leaves precision undefined. Printing
    // 0% would read as a measurement rather than the absence of one.
    expect(score.overall.precision).toBeNull();
    expect(score.overall.f1).toBeNull();
    expect(score.pairs.insensitive).toBe(100);
  });

  it('counts an inverted pair separately from an insensitive one', () => {
    const inverted = cases.map((c) => ({
      caseId: c.id,
      observed: (c.expected === 'escalate' ? 'confident' : 'escalate') as
        | 'escalate'
        | 'confident',
      question: null,
      alternativeCount: 0,
      error: null,
    }));
    const score = scoreAmbiguity(cases, inverted);
    expect(score.pairs.inverted).toBe(100);
    expect(score.pairs.discriminated).toBe(0);
    expect(score.pairs.insensitive).toBe(0);
  });

  it('excludes errored cases from the counts and reports them', () => {
    const observations = observe((expected) => expected).map((o, index) =>
      index < 10 ? { ...o, observed: null, error: 'timeout' } : o,
    );
    const score = scoreAmbiguity(cases, observations);
    expect(score.errors).toBe(10);
    expect(score.overall.scored).toBe(190);
  });

  it('treats a case with no observation at all as an error, not a pass', () => {
    const score = scoreAmbiguity(cases, []);
    expect(score.errors).toBe(200);
    expect(score.overall.scored).toBe(0);
    expect(score.pairs.incomplete).toBe(100);
  });

  it('scores each category separately', () => {
    const score = scoreAmbiguity(
      cases,
      observe((expected) => expected),
    );
    expect(score.byCategory.polysemy.scored).toBe(120);
    expect(score.byCategory['insufficient-grammar'].scored).toBe(50);
    expect(score.byCategory.register.scored).toBe(30);
  });

  it('prints "no data" rather than a percentage for an undefined rate', () => {
    expect(formatPercent(null)).toBe('no data');
    expect(formatPercent(0.5)).toBe('50.0%');
  });
});
