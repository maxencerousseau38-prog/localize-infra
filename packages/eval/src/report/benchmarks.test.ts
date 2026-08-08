import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ARTIFACT_PATH, buildBenchmarks } from './benchmarks.js';

/**
 * The marketing site renders published numbers straight from
 * `benchmarks.json`. That file is the only place on the site where a figure
 * could be quietly edited into something flattering, so it is pinned here: if
 * the committed artifact drifts from what the generator produces off the
 * committed corpus, the build fails.
 */
describe('benchmark artifact', () => {
  const artifact = buildBenchmarks();

  it('matches the committed file the site renders', () => {
    const committed = JSON.parse(readFileSync(ARTIFACT_PATH, 'utf8'));
    expect(committed).toEqual(artifact);
  });

  it('reports the corpus the site describes', () => {
    expect(artifact.corpus.entries).toBe(414);
    expect(artifact.corpus.projects).toHaveLength(5);
    // Every entry carries a human reference, which is what makes the unmeasured
    // preference study possible later.
    expect(artifact.corpus.withHumanReference).toBe(artifact.corpus.entries);
    // Each project is pinned to one commit, or the corpus is not reproducible.
    for (const project of artifact.corpus.projects) {
      expect(project.commit).toMatch(/^[0-9a-f]{40}$/);
    }
  });

  it('scores both prompt conditions', () => {
    expect(artifact.conditions.map((c) => c.condition)).toEqual(['A', 'B']);
  });

  it('never reports a pass rate above its applicable count', () => {
    for (const condition of artifact.conditions) {
      for (const [name, check] of Object.entries(condition)) {
        if (
          typeof check !== 'object' ||
          check === null ||
          !('applicable' in check)
        ) {
          continue;
        }
        expect(
          check.passed,
          `${condition.condition}.${name}`,
        ).toBeLessThanOrEqual(check.applicable);
      }
    }
  });

  it('excludes failed provider calls from the scored denominator', () => {
    // Counting an API outage as a translation defect would understate quality;
    // silently dropping it without reporting would overstate coverage. Errors
    // are carried separately so the page can show both.
    for (const condition of artifact.conditions) {
      expect(condition.errors).toBeGreaterThanOrEqual(0);
      expect(condition.placeholderIntact.applicable).toBe(
        condition.translations - condition.errors,
      );
    }
  });

  it('records checks the corpus cannot exercise as zero-applicable, not as passes', () => {
    // The corpus contains no ICU messages. A page that renders "Pass" for a
    // check with nothing to check is the exact dishonesty this project argues
    // against, so the artifact must expose the empty denominator.
    for (const condition of artifact.conditions) {
      expect(condition.icuValid.applicable).toBe(0);
      expect(condition.pluralCategoriesCorrect.applicable).toBe(0);
    }
  });

  it('names what has not been measured', () => {
    expect(artifact.notMeasured.length).toBeGreaterThan(0);
    expect(artifact.notMeasured.join(' ')).toMatch(/native speaker/i);
  });
});
