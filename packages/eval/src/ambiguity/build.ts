import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildAmbiguityCases } from './cases.js';

/**
 * Emits the corpus that the runner and the tests read.
 *
 * Committed rather than generated at run time, and checked by a test that
 * rebuilds it and compares — the same arrangement `benchmarks.json` and
 * `cost-model.json` use in this repository. The reason is the same each time:
 * a corpus that is regenerated on every run can change silently between two
 * measurements, and then a score that moved tells you nothing about whether
 * the agent moved.
 */
export const AMBIGUITY_DATA_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  'data',
);

export const AMBIGUITY_CASES_PATH = join(
  AMBIGUITY_DATA_DIR,
  'ambiguity-cases.json',
);

export function renderAmbiguityCases(): string {
  return `${JSON.stringify(buildAmbiguityCases(), null, 2)}\n`;
}

const invokedPath = process.argv[1]?.replace(/\\/g, '/');
const modulePath = fileURLToPath(import.meta.url).replace(/\\/g, '/');
if (invokedPath === modulePath) {
  writeFileSync(AMBIGUITY_CASES_PATH, renderAmbiguityCases(), 'utf-8');
  const cases = buildAmbiguityCases();
  const escalate = cases.filter((c) => c.expected === 'escalate').length;
  console.log(
    `wrote ${cases.length} cases (${escalate} escalate / ${cases.length - escalate} confident) to ${AMBIGUITY_CASES_PATH}`,
  );
}
