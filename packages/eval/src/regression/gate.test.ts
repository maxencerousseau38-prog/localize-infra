import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CorpusEntrySchema,
  GlossaryEntrySchema,
  TranslationResultSchema,
} from '@localize-infra/schemas';
import { describe, expect, it } from 'vitest';
import { scoreTranslation } from '../deterministic/score.js';
import { computeSourceHash, readCommittedSourceHash } from './staleness.js';

const DATA_DIR = join(process.cwd(), 'src/corpus/data');
const PLACEHOLDER_ICU_THRESHOLD = 0.995;
// The scored population (entries with a usable condition-B translation) must not be a
// shrunken/degenerate subset of the full corpus — e.g. a corpus:build re-run that reshuffles
// stratifiedSample and drops previously-sampled ids, without a matching translate:run, would
// otherwise silently pass this gate on a much smaller denominator than intended.
const COVERAGE_FLOOR = 0.95;

const entries = (
  JSON.parse(readFileSync(join(DATA_DIR, 'entries.json'), 'utf-8')) as unknown[]
).map((e) => CorpusEntrySchema.parse(e));
const glossary = (
  JSON.parse(
    readFileSync(join(DATA_DIR, 'glossary.json'), 'utf-8'),
  ) as unknown[]
).map((g) => GlossaryEntrySchema.parse(g));
const translations = (
  JSON.parse(
    readFileSync(join(DATA_DIR, 'translations.json'), 'utf-8'),
  ) as unknown[]
).map((t) => TranslationResultSchema.parse(t));

describe('Sprint 0 exit gate: placeholder/ICU integrity on condition B', () => {
  it('meets or exceeds 99.5% across the full corpus', () => {
    // translate.ts checkpoints translations.json across process invocations and never prunes
    // entries whose corpusEntryId no longer appears in entries.json (e.g. after corpus:build is
    // re-run with different/added sources, which reshuffles stratifiedSample's per-group stride
    // and drops some previously-sampled ids). Scoping this gate to `entries` (the current
    // corpus) rather than to the raw `translations` array keeps the denominator equal to what
    // was actually scored, instead of silently counting stale, unscored translations as failures.
    const conditionBByEntryId = new Map(
      translations
        .filter((t) => t.condition === 'B' && t.error === null)
        .map((t) => [t.corpusEntryId, t]),
    );

    let intact = 0;
    let scored = 0;
    const failures: string[] = [];
    const skipped: string[] = [];
    for (const entry of entries) {
      const result = conditionBByEntryId.get(entry.id);
      if (!result) {
        skipped.push(
          `${entry.id}: source="${entry.sourceText}" (no matching condition-B translation — either missing from translations.json or errored out)`,
        );
        continue;
      }
      scored++;
      const score = scoreTranslation(entry, result, glossary);
      const passed = score.placeholderIntact && score.icuValid;
      if (passed) intact++;
      else
        failures.push(
          `${entry.id}: source="${entry.sourceText}" translated="${result.text}"`,
        );
    }
    expect(scored).toBeGreaterThan(0);

    const coverage = scored / entries.length;
    const rate = intact / scored;

    if (coverage < COVERAGE_FLOOR || rate < PLACEHOLDER_ICU_THRESHOLD) {
      if (skipped.length > 0) {
        console.error(
          `Corpus entries skipped — no scoreable condition-B translation (${skipped.length}/${entries.length}):\n${skipped.slice(0, 20).join('\n')}`,
        );
      }
      if (failures.length > 0) {
        console.error(
          `Placeholder/ICU failures (${failures.length}):\n${failures.slice(0, 20).join('\n')}`,
        );
      }
    }

    // Coverage floor: the scored population must be at least 95% of the full corpus, so a
    // shrunken/degenerate subset can't silently pass the placeholder/ICU rate check below.
    expect(coverage).toBeGreaterThanOrEqual(COVERAGE_FLOOR);
    expect(rate).toBeGreaterThanOrEqual(PLACEHOLDER_ICU_THRESHOLD);
  });

  it('fails with a clear message if prompts.ts or the corpus changed since the last translate:run', () => {
    const currentHash = computeSourceHash();
    const committedHash = readCommittedSourceHash();
    expect(
      committedHash,
      'translations.meta.json is missing or unreadable — run `pnpm --filter @localize-infra/eval run translate:run` to generate it',
    ).not.toBeNull();
    expect(
      currentHash,
      'prompts or corpus changed since the last translate:run — re-run `pnpm --filter @localize-infra/eval run translate:run` before trusting this gate',
    ).toBe(committedHash);
  });
});
