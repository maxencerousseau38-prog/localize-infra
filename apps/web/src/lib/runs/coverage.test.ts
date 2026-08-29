import { pendingKeys } from '@localize-infra/core';
import { describe, expect, it } from 'vitest';
import { buildCoverage } from './coverage.js';

/**
 * The scan promises what the run will do.
 *
 * That is the property worth testing. A screen saying "37 missing" followed by
 * a run that translates 41 would be worse than showing nothing, because the
 * developer would have based a decision on it.
 */

const source = { a: 'A', b: 'B', c: 'C', d: 'D' };

describe('buildCoverage', () => {
  it('counts what each locale is missing', () => {
    const coverage = buildCoverage(
      source,
      { fr: { a: 'A-fr', b: 'B-fr' }, de: { a: 'A-de' } },
      ['fr', 'de'],
    );
    expect(coverage.keys).toBe(4);
    expect(coverage.locales[0]).toMatchObject({
      locale: 'fr',
      missing: 2,
      translated: 2,
    });
    expect(coverage.locales[1]).toMatchObject({ locale: 'de', missing: 3 });
    expect(coverage.totalMissing).toBe(5);
  });

  it('treats a locale with no file as missing everything, not as absent', () => {
    const coverage = buildCoverage(source, {}, ['es']);
    expect(coverage.locales[0]?.missing).toBe(4);
    expect(coverage.locales[0]?.percent).toBe(0);
  });

  it('reports a fully translated repository as complete', () => {
    const coverage = buildCoverage(source, { fr: { ...source } }, ['fr']);
    expect(coverage.complete).toBe(true);
    expect(coverage.locales[0]?.percent).toBe(100);
  });

  /*
   * A repository at 99.6% is not finished. Rounding would print 100% beside a
   * run that still has work to do.
   */
  it('floors the percentage so nearly-done never reads as done', () => {
    const many = Object.fromEntries(
      Array.from({ length: 1000 }, (_, i) => [`k${i}`, 'x']),
    );
    const have = Object.fromEntries(
      Array.from({ length: 996 }, (_, i) => [`k${i}`, 'y']),
    );
    const coverage = buildCoverage(many, { fr: have }, ['fr']);
    expect(coverage.locales[0]?.percent).toBe(99);
    expect(coverage.complete).toBe(false);
  });

  /*
   * The property this file exists for: the scan's number is the run's number,
   * because both come from `pendingKeys` rather than from two rules that agree
   * by coincidence.
   */
  it('counts exactly what the run would send, by the run’s own rule', () => {
    const existing = { fr: { a: 'A-fr', c: 'C-fr' } };
    const coverage = buildCoverage(source, existing, ['fr']);
    expect(coverage.locales[0]?.missing).toBe(
      pendingKeys(source, existing.fr).length,
    );
  });

  /*
   * A key present in the locale file but absent from the source is obsolete,
   * not missing. It must not make coverage exceed the catalog.
   */
  it('does not count an obsolete key as progress', () => {
    const coverage = buildCoverage(
      { a: 'A' },
      { fr: { a: 'A-fr', removed: 'gone' } },
      ['fr'],
    );
    expect(coverage.locales[0]?.translated).toBe(1);
    expect(coverage.locales[0]?.percent).toBe(100);
  });

  it('handles a repository with no extractable keys without dividing by zero', () => {
    const coverage = buildCoverage({}, {}, ['fr']);
    expect(coverage.keys).toBe(0);
    expect(coverage.locales[0]?.percent).toBe(100);
    expect(coverage.complete).toBe(true);
  });

  it('returns no locales when the project targets none', () => {
    const coverage = buildCoverage(source, {}, []);
    expect(coverage.locales).toEqual([]);
    expect(coverage.totalMissing).toBe(0);
  });
});

/*
 * The sum of nothing is zero, so `totalMissing === 0` alone reported a project
 * with no target locales as fully translated. That is the same defect that made
 * a run say "Every target locale failed" having attempted none: an empty list
 * read as a finished job rather than as an unconfigured one.
 */
describe('a project with no target locales', () => {
  it('is not complete, it is unconfigured', () => {
    const coverage = buildCoverage({ a: 'A', b: 'B' }, {}, []);
    expect(coverage.keys).toBe(2);
    expect(coverage.locales).toEqual([]);
    expect(coverage.totalMissing).toBe(0);
    expect(coverage.complete).toBe(false);
  });

  it('still calls a fully translated project complete', () => {
    const coverage = buildCoverage({ a: 'A' }, { fr: { a: 'A-fr' } }, ['fr']);
    expect(coverage.complete).toBe(true);
  });
});
