import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type CorpusEntry,
  CorpusEntrySchema,
  type GlossaryEntry,
  GlossaryEntrySchema,
} from '@localize-infra/schemas';

/**
 * Reading the corpus, from anywhere.
 *
 * `conditions/translate.ts` resolves the same two files from
 * `process.cwd()`, which works because it is run as an npm script from this
 * package's directory and fails for every other caller. Resolved from this
 * module's own location instead, so a consumer in another package gets the
 * corpus rather than a path error.
 *
 * Parsed through the shared schemas rather than cast: a corpus row that has
 * drifted from the contract should fail here, loudly, and not halfway through
 * a run that has already spent money on inference.
 */
export const CORPUS_DATA_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  'data',
);

export function loadCorpus(dir: string = CORPUS_DATA_DIR): CorpusEntry[] {
  const raw = JSON.parse(
    readFileSync(join(dir, 'entries.json'), 'utf-8'),
  ) as unknown[];
  return raw.map((entry) => CorpusEntrySchema.parse(entry));
}

export function loadGlossary(dir: string = CORPUS_DATA_DIR): GlossaryEntry[] {
  const raw = JSON.parse(
    readFileSync(join(dir, 'glossary.json'), 'utf-8'),
  ) as unknown[];
  return raw.map((entry) => GlossaryEntrySchema.parse(entry));
}
