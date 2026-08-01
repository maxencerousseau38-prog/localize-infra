import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  type CorpusEntry,
  CorpusEntrySchema,
  type GlossaryEntry,
  GlossaryEntrySchema,
  type TranslationResult,
} from '@localize-infra/schemas';
import {
  TRANSLATIONS_META_PATH,
  computeSourceHash,
} from '../regression/staleness.js';
import { getProvider, pickProvider } from '../router/index.js';
import type { Provider } from '../router/types.js';
import { buildConditionAPrompt, buildConditionBPrompt } from './prompts.js';

const DATA_DIR = join(process.cwd(), 'src/corpus/data');
const ANTHROPIC_MODEL = process.env.EVAL_ANTHROPIC_MODEL ?? 'claude-sonnet-5';
const OPENAI_MODEL = process.env.EVAL_OPENAI_MODEL ?? 'gpt-4o';

interface Providers {
  anthropic: Provider;
  openai: Provider;
}

async function translateOne(
  entry: CorpusEntry,
  condition: 'A' | 'B',
  glossary: GlossaryEntry[],
  providers: Providers,
): Promise<TranslationResult> {
  const forcedProvider = process.env.EVAL_FORCE_PROVIDER;
  const providerName =
    forcedProvider === 'anthropic' || forcedProvider === 'openai'
      ? forcedProvider
      : pickProvider(`${entry.id}-${condition}`);
  const provider = providers[providerName];
  const modelId = providerName === 'anthropic' ? ANTHROPIC_MODEL : OPENAI_MODEL;
  const request =
    condition === 'A'
      ? buildConditionAPrompt(entry)
      : buildConditionBPrompt(entry, glossary);

  try {
    const text = await provider.translate(request, modelId);
    return {
      corpusEntryId: entry.id,
      condition,
      targetLocale: entry.targetLocale,
      provider: providerName,
      modelId,
      text,
      error: null,
    };
  } catch (err) {
    return {
      corpusEntryId: entry.id,
      condition,
      targetLocale: entry.targetLocale,
      provider: providerName,
      modelId,
      text: '',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export interface RunTranslationPipelineOptions {
  // Keys of the form `${corpusEntryId}:${condition}` that should be skipped rather than
  // re-translated (and re-billed) — used by main()'s resume-from-checkpoint logic. Entries/
  // conditions not present are translated as normal.
  alreadyCompleted?: Set<string>;
  // Invoked once per newly-produced result, in the same order results are appended to the
  // returned array. main() uses this to checkpoint to disk after every call instead of
  // buffering the whole run in memory before persisting anything.
  onResult?: (result: TranslationResult) => void | Promise<void>;
}

export async function runTranslationPipeline(
  entries: CorpusEntry[],
  glossary: GlossaryEntry[],
  providers: Providers,
  options?: RunTranslationPipelineOptions,
): Promise<TranslationResult[]> {
  const alreadyCompleted = options?.alreadyCompleted;
  const results: TranslationResult[] = [];
  for (const entry of entries) {
    for (const condition of ['A', 'B'] as const) {
      const key = `${entry.id}:${condition}`;
      if (alreadyCompleted?.has(key)) continue;
      const result = await translateOne(entry, condition, glossary, providers);
      results.push(result);
      await options?.onResult?.(result);
    }
  }
  return results;
}

// Writes the checkpoint atomically: write to a temp file in the same directory, then rename it
// into place. fs.renameSync is atomic on both POSIX and Windows when source and destination are
// on the same filesystem, which a same-directory temp file guarantees. This means a checkpoint
// write is never observed half-written — a mid-write process kill (SIGKILL, power loss, OOM)
// leaves either the old complete file or the new complete file, never a truncated one.
function writeCheckpoint(outPath: string, data: string): void {
  const tmpPath = `${outPath}.tmp`;
  writeFileSync(tmpPath, data);
  renameSync(tmpPath, outPath);
}

async function main(): Promise<void> {
  const entries = (
    JSON.parse(
      readFileSync(join(DATA_DIR, 'entries.json'), 'utf-8'),
    ) as unknown[]
  ).map((e) => CorpusEntrySchema.parse(e));
  const glossary = (
    JSON.parse(
      readFileSync(join(DATA_DIR, 'glossary.json'), 'utf-8'),
    ) as unknown[]
  ).map((g) => GlossaryEntrySchema.parse(g));
  const providers: Providers = {
    anthropic: getProvider('anthropic'),
    openai: getProvider('openai'),
  };
  const outPath = join(DATA_DIR, 'translations.json');

  // Operational note: this run is resumable across process invocations. The live corpus is
  // large enough (403 entries x 2 conditions) that a single invocation can be interrupted
  // (e.g. an external timeout) before completion. Re-running this script picks up exactly
  // where the last run left off — already-recorded (corpusEntryId, condition) pairs are
  // skipped rather than re-called and re-billed. The checkpoint-skip and translate-and-collect
  // logic both live in runTranslationPipeline (via alreadyCompleted/onResult) so this CLI
  // entrypoint is a thin wrapper around the same code path the unit tests exercise, instead of
  // a second, untested implementation of the same loop.
  const validEntryIds = new Set(entries.map((e) => e.id));
  const loadedResults: TranslationResult[] = existsSync(outPath)
    ? (JSON.parse(readFileSync(outPath, 'utf-8')) as TranslationResult[])
    : [];
  // Drop any loaded record whose corpusEntryId no longer exists in the current entries.json
  // (leftover from an earlier corpus:build sampling) before it can be re-checkpointed forward —
  // otherwise stale records accumulate across every future run instead of getting pruned.
  const results: TranslationResult[] = loadedResults.filter((r) =>
    validEntryIds.has(r.corpusEntryId),
  );
  const alreadyCompleted = new Set(
    results.map((r) => `${r.corpusEntryId}:${r.condition}`),
  );

  await runTranslationPipeline(entries, glossary, providers, {
    alreadyCompleted,
    onResult: async (result) => {
      results.push(result);
      // Checkpoint write, with a couple of short retries: on Windows this file is written
      // once per API call (hundreds of times per run) and can occasionally hit a transient
      // "file busy" error from antivirus/indexing. Losing the whole run to that would be far
      // more wasteful (re-billed API calls on next resume) than a brief retry here. The write
      // itself is atomic (temp file + rename) so a hard kill mid-write can never corrupt the
      // on-disk checkpoint; the retry here only covers the transient file-busy error above.
      for (let attempt = 0; ; attempt++) {
        try {
          writeCheckpoint(outPath, JSON.stringify(results, null, 2));
          break;
        } catch (err) {
          if (attempt >= 3) throw err;
          await new Promise((resolve) =>
            setTimeout(resolve, 200 * (attempt + 1)),
          );
        }
      }
    },
  });

  const failures = results.filter((r) => r.error !== null);
  console.log(
    `${results.length} translations written, ${failures.length} failed`,
  );

  // Record which prompts.ts + entries.json state this translations.json reflects, so the
  // regression gate can detect when either has changed since this run without a re-run.
  writeFileSync(
    TRANSLATIONS_META_PATH,
    JSON.stringify({ sourceHash: computeSourceHash() }, null, 2),
  );
}

const invokedPath = process.argv[1]?.replace(/\\/g, '/');
const modulePath = new URL(import.meta.url).pathname.replace(
  /^\/([A-Za-z]:)/,
  '$1',
);
if (invokedPath === modulePath) {
  main();
}
