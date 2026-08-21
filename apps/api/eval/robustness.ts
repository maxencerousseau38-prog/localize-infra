import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCorpus } from '../../../packages/eval/src/index.js';
import { createAnthropicProvider } from '../src/router/anthropic.js';
import { handleTranslateBatch } from '../src/translate/handler.js';
import { CONFIGS } from './configs.js';

/**
 * How often a configuration returns something the parser cannot use.
 *
 * The comparison run in `run.ts` translates each locale once, which measures
 * quality and cannot measure reliability: it saw Haiku lose a whole locale to
 * unparseable JSON, and a single observation cannot tell a systematic limit
 * from a bad roll. Re-running the same input settles which.
 *
 * It matters more than a footnote suggests, because there is **no retry** in
 * the pipeline. One malformed response is one locale that silently produces
 * nothing, and the run still opens a pull request for the locales that worked.
 *
 * Run with: npx tsx apps/api/eval/robustness.ts
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, 'results');

/** German: the locale that failed in the comparison run. */
const LOCALE = 'de';
const ATTEMPTS = 5;

function readApiKey(): string {
  const env = readFileSync(join(HERE, '../../../.env'), 'utf8');
  const key = /^ANTHROPIC_API_KEY\s*=\s*(.+)$/m
    .exec(env)?.[1]
    ?.trim()
    .replace(/^["']|["']$/g, '');
  if (!key) throw new Error('ANTHROPIC_API_KEY not found in .env');
  return key;
}

async function main(): Promise<void> {
  const apiKey = readApiKey();
  const entries = loadCorpus().filter((e) => e.targetLocale === LOCALE);
  const strings = entries.map((entry) => ({
    key: entry.id,
    text: entry.sourceText,
    filePath: entry.filePath,
    componentName: entry.componentName,
    surroundingCode: entry.surroundingCode,
  }));

  const results = [];

  for (const config of CONFIGS) {
    const provider = createAnthropicProvider(apiKey, config.settings);
    const attempts: { answered: number; error: string | null }[] = [];

    for (let i = 0; i < ATTEMPTS; i += 1) {
      try {
        const result = await handleTranslateBatch(
          { targetLocale: LOCALE, strings },
          provider,
          config.modelId,
        );
        attempts.push({
          answered: result.translations.length,
          error: result.missingKeys.length > 0 ? 'incomplete' : null,
        });
      } catch (error) {
        attempts.push({
          answered: 0,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const complete = attempts.filter(
      (a) => a.answered === strings.length,
    ).length;
    results.push({
      id: config.id,
      label: config.label,
      locale: LOCALE,
      stringsPerAttempt: strings.length,
      attempts: attempts.length,
      completeAttempts: complete,
      failures: attempts.filter((a) => a.answered !== strings.length),
    });
    process.stdout.write(
      `${config.id}: ${complete}/${attempts.length} complete\n`,
    );
  }

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(
    join(OUT_DIR, 'robustness.json'),
    `${JSON.stringify(
      {
        ranAt: new Date().toISOString(),
        method: `The same ${strings.length}-string ${LOCALE} batch, sent ${ATTEMPTS} times per configuration through the production path. A configuration is complete only if every string came back.`,
        limitation:
          'Five attempts per configuration cannot establish a failure rate, only whether failures recur. Read it as evidence that a failure is or is not a one-off.',
        results,
      },
      null,
      2,
    )}\n`,
  );
  process.stdout.write(`wrote ${join(OUT_DIR, 'robustness.json')}\n`);
}

await main();
