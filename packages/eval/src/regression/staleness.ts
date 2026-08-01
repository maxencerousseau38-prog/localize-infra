import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Both callers (translate.ts's main(), gate.test.ts) invoke this with process.cwd() equal to
// packages/eval — matches the DATA_DIR convention used throughout this package.
const EVAL_ROOT = process.cwd();
const PROMPTS_PATH = join(EVAL_ROOT, 'src/conditions/prompts.ts');
const ENTRIES_PATH = join(EVAL_ROOT, 'src/corpus/data/entries.json');
export const TRANSLATIONS_META_PATH = join(
  EVAL_ROOT,
  'src/corpus/data/translations.meta.json',
);

export interface TranslationsMeta {
  sourceHash: string;
}

// Hashes the concatenation of the condition-A/B prompt builders' source text and the current
// corpus's entries.json content. If either changes, translations previously collected via
// translate:run no longer reflect what the pipeline would now produce, and the regression gate
// should refuse to trust them until translate:run is re-run.
export function computeSourceHash(): string {
  const promptsSource = readFileSync(PROMPTS_PATH, 'utf-8');
  const entriesJson = readFileSync(ENTRIES_PATH, 'utf-8');
  return createHash('sha256')
    .update(promptsSource)
    .update(entriesJson)
    .digest('hex');
}

export function readCommittedSourceHash(): string | null {
  try {
    const raw = readFileSync(TRANSLATIONS_META_PATH, 'utf-8');
    const meta = JSON.parse(raw) as TranslationsMeta;
    return meta.sourceHash ?? null;
  } catch {
    return null;
  }
}
