/**
 * Builds the benchmark summary published on the marketing site.
 *
 * Everything here is derived from data committed to this repository — the
 * corpus (`src/corpus/data/entries.json`), the translations produced by the
 * two prompt conditions (`translations.json`), and the glossary. Nothing is
 * typed in by hand, and nothing is estimated. Re-running
 * `npm run benchmarks:build -w @localize-infra/eval` regenerates the artifact,
 * and a test asserts the committed copy matches what the generator produces,
 * so a stale or edited number fails the build.
 *
 * What this does NOT measure: whether a translation is *good*. That needs
 * native speakers comparing against the human references, and that study has
 * not run. The artifact records that gap explicitly rather than omitting it,
 * because a benchmarks page that only reports what it happens to know reads as
 * a complete picture.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  CorpusEntry,
  DeterministicScore,
  GlossaryEntry,
  TranslationResult,
} from '@localize-infra/schemas';
import { isIcuMessage } from '../deterministic/icu.js';
import { scoreTranslation } from '../deterministic/score.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(HERE, '../corpus/data');
export const ARTIFACT_PATH = join(HERE, 'benchmarks.json');

export interface CheckResult {
  /** Denominator: only entries the check actually applies to. */
  applicable: number;
  passed: number;
}

export interface ConditionSummary {
  condition: 'A' | 'B';
  translations: number;
  /** Provider calls that returned an error and produced no text. */
  errors: number;
  placeholderIntact: CheckResult;
  icuValid: CheckResult;
  pluralCategoriesCorrect: CheckResult;
  withinLengthBudget: CheckResult;
  glossaryRespected: CheckResult;
  byLocale: Array<{
    locale: string;
    translations: number;
    placeholderIntact: CheckResult;
  }>;
}

export interface BenchmarkArtifact {
  corpus: {
    entries: number;
    projects: Array<{
      name: string;
      license: string;
      repoUrl: string;
      commit: string;
      entries: number;
    }>;
    locales: Array<{ locale: string; entries: number }>;
    icuEntries: number;
    withLengthBudget: number;
    withHumanReference: number;
  };
  run: {
    providers: string[];
    models: string[];
    translations: number;
  };
  conditions: ConditionSummary[];
  /** Named so the omission is impossible to miss when reading the artifact. */
  notMeasured: string[];
}

function read<T>(file: string): T {
  return JSON.parse(readFileSync(join(DATA_DIR, file), 'utf8')) as T;
}

function rate(applicable: number, passed: number): CheckResult {
  return { applicable, passed };
}

function summarise(
  condition: 'A' | 'B',
  entries: Map<string, CorpusEntry>,
  results: TranslationResult[],
  glossary: GlossaryEntry[],
): ConditionSummary {
  const forCondition = results.filter((r) => r.condition === condition);
  const errors = forCondition.filter((r) => r.error).length;
  // A failed provider call produced no text; scoring it would count an outage
  // as a translation defect. Errors are reported on their own line instead.
  const scorable = forCondition.filter((r) => !r.error && r.text);

  const scored: Array<{ entry: CorpusEntry; score: DeterministicScore }> = [];
  for (const result of scorable) {
    const entry = entries.get(result.corpusEntryId);
    if (!entry) continue;
    scored.push({ entry, score: scoreTranslation(entry, result, glossary) });
  }

  const icuScored = scored.filter(({ entry }) =>
    isIcuMessage(entry.sourceText),
  );
  const pluralScored = scored.filter(
    ({ score }) => score.pluralCategoriesCorrect !== null,
  );
  const lengthScored = scored.filter(({ entry }) => entry.maxLength != null);
  const glossaryScored = scored.filter(
    ({ score }) => score.glossaryHits.length > 0,
  );

  const locales = [...new Set(scored.map(({ entry }) => entry.targetLocale))]
    .sort()
    .map((locale) => {
      const inLocale = scored.filter(
        ({ entry }) => entry.targetLocale === locale,
      );
      return {
        locale,
        translations: inLocale.length,
        placeholderIntact: rate(
          inLocale.length,
          inLocale.filter(({ score }) => score.placeholderIntact).length,
        ),
      };
    });

  return {
    condition,
    translations: forCondition.length,
    errors,
    placeholderIntact: rate(
      scored.length,
      scored.filter(({ score }) => score.placeholderIntact).length,
    ),
    icuValid: rate(
      icuScored.length,
      icuScored.filter(({ score }) => score.icuValid).length,
    ),
    pluralCategoriesCorrect: rate(
      pluralScored.length,
      pluralScored.filter(({ score }) => score.pluralCategoriesCorrect).length,
    ),
    withinLengthBudget: rate(
      lengthScored.length,
      lengthScored.filter(({ score }) => !score.lengthOverflow).length,
    ),
    glossaryRespected: rate(
      glossaryScored.length,
      glossaryScored.filter(({ score }) =>
        score.glossaryHits.every((hit) => hit.respected),
      ).length,
    ),
    byLocale: locales,
  };
}

export function buildBenchmarks(): BenchmarkArtifact {
  const entries = read<CorpusEntry[]>('entries.json');
  const translations = read<TranslationResult[]>('translations.json');
  const glossary = read<GlossaryEntry[]>('glossary.json');
  const byId = new Map(entries.map((e) => [e.id, e]));

  const projectNames = [...new Set(entries.map((e) => e.sourceProject))].sort();
  const projects = projectNames.map((name) => {
    const inProject = entries.filter((e) => e.sourceProject === name);
    const first = inProject[0] as CorpusEntry;
    return {
      name,
      license: first.sourceLicense,
      repoUrl: first.sourceRepoUrl,
      commit: first.sourceCommit,
      entries: inProject.length,
    };
  });

  const locales = [...new Set(entries.map((e) => e.targetLocale))]
    .sort()
    .map((locale) => ({
      locale,
      entries: entries.filter((e) => e.targetLocale === locale).length,
    }));

  return {
    corpus: {
      entries: entries.length,
      projects,
      locales,
      icuEntries: entries.filter((e) => isIcuMessage(e.sourceText)).length,
      withLengthBudget: entries.filter((e) => e.maxLength != null).length,
      withHumanReference: entries.filter((e) => e.humanReference).length,
    },
    run: {
      providers: [...new Set(translations.map((t) => t.provider))].sort(),
      models: [...new Set(translations.map((t) => t.modelId))].sort(),
      translations: translations.length,
    },
    conditions: (['A', 'B'] as const).map((condition) =>
      summarise(condition, byId, translations, glossary),
    ),
    notMeasured: [
      'Whether a translation reads well to a native speaker. Requires the blind human comparison against the corpus references; that study has not run.',
      'Comparison against other localization vendors. We have not run their products over this corpus, and publishing a competitor number we did not measure would be the same dishonesty we are arguing against.',
      'Latency and cost per string. Not recorded during this run.',
    ],
  };
}

function main(): void {
  const artifact = buildBenchmarks();
  writeFileSync(ARTIFACT_PATH, `${JSON.stringify(artifact, null, 2)}\n`);
  process.stdout.write(`Wrote ${ARTIFACT_PATH}\n`);
}

// Windows-safe entrypoint check: process.argv[1] uses backslashes while
// import.meta.url does not.
const invokedDirectly =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url).replace(/\\/g, '/') ===
    process.argv[1].replace(/\\/g, '/');

if (invokedDirectly) main();
