import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { REPORT } from './build.js';

/**
 * The committed report must be what the generator produces.
 *
 * The same guard `packages/eval` puts on the benchmarks the marketing site
 * publishes, and it matters more here: these figures decide a price. Without
 * it, a number could be edited into cost-model.json — or into
 * docs/product/09-unit-economics.md, which quotes it — and nothing would
 * notice. Hand-written figures with no provenance are exactly what
 * `08-critique.md` §C3 refused to let a price be built on.
 */
describe('cost-model.json', () => {
  it('matches its generator', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const committed = JSON.parse(
      readFileSync(join(here, 'cost-model.json'), 'utf8'),
    );

    expect(committed).toEqual(JSON.parse(JSON.stringify(REPORT)));
  });

  it('records the provenance of every input it used', () => {
    // The tiering is the point of this model. A report that lost it would be
    // the rough arithmetic it replaced.
    expect(REPORT.inputs).toHaveProperty('MEASURED');
    expect(REPORT.inputs).toHaveProperty('PRICES');
    expect(REPORT.inputs).toHaveProperty('ASSUMPTIONS');
  });

  it('is priced at standard rates, not the expiring introductory ones', () => {
    expect(REPORT.rates.standard.input).toBe(3.0);
    expect(REPORT.rates.introductoryUntil).toBe('2026-08-31');
  });
});
