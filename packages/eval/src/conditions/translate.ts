import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { CorpusEntrySchema, GlossaryEntrySchema, type CorpusEntry, type GlossaryEntry, type TranslationResult } from '@localize-infra/schemas'
import { getProvider, pickProvider } from '../router/index.js'
import type { Provider } from '../router/types.js'
import { buildConditionAPrompt, buildConditionBPrompt } from './prompts.js'

const DATA_DIR = join(process.cwd(), 'src/corpus/data')
const ANTHROPIC_MODEL = process.env.EVAL_ANTHROPIC_MODEL ?? 'claude-sonnet-5'
const OPENAI_MODEL = process.env.EVAL_OPENAI_MODEL ?? 'gpt-4o'

interface Providers {
  anthropic: Provider
  openai: Provider
}

async function translateOne(
  entry: CorpusEntry,
  condition: 'A' | 'B',
  glossary: GlossaryEntry[],
  providers: Providers,
): Promise<TranslationResult> {
  const forcedProvider = process.env.EVAL_FORCE_PROVIDER
  const providerName = forcedProvider === 'anthropic' || forcedProvider === 'openai' ? forcedProvider : pickProvider(`${entry.id}-${condition}`)
  const provider = providers[providerName]
  const modelId = providerName === 'anthropic' ? ANTHROPIC_MODEL : OPENAI_MODEL
  const request = condition === 'A' ? buildConditionAPrompt(entry) : buildConditionBPrompt(entry, glossary)

  try {
    const text = await provider.translate(request, modelId)
    return { corpusEntryId: entry.id, condition, targetLocale: entry.targetLocale, provider: providerName, modelId, text, error: null }
  } catch (err) {
    return {
      corpusEntryId: entry.id,
      condition,
      targetLocale: entry.targetLocale,
      provider: providerName,
      modelId,
      text: '',
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function runTranslationPipeline(
  entries: CorpusEntry[],
  glossary: GlossaryEntry[],
  providers: Providers,
): Promise<TranslationResult[]> {
  const results: TranslationResult[] = []
  for (const entry of entries) {
    results.push(await translateOne(entry, 'A', glossary, providers))
    results.push(await translateOne(entry, 'B', glossary, providers))
  }
  return results
}

async function main(): Promise<void> {
  const entries = (JSON.parse(readFileSync(join(DATA_DIR, 'entries.json'), 'utf-8')) as unknown[]).map((e) =>
    CorpusEntrySchema.parse(e),
  )
  const glossary = (JSON.parse(readFileSync(join(DATA_DIR, 'glossary.json'), 'utf-8')) as unknown[]).map((g) =>
    GlossaryEntrySchema.parse(g),
  )
  const providers: Providers = { anthropic: getProvider('anthropic'), openai: getProvider('openai') }
  const outPath = join(DATA_DIR, 'translations.json')

  // Operational note: this run is resumable across process invocations. The live corpus is
  // large enough (403 entries x 2 conditions) that a single invocation can be interrupted
  // (e.g. an external timeout) before completion. Re-running this script picks up exactly
  // where the last run left off — already-recorded (corpusEntryId, condition) pairs are
  // skipped rather than re-called and re-billed — and checkpoints to disk after every call so
  // no completed work is ever lost. This does not change runTranslationPipeline's behavior or
  // its exported signature (still covered by its existing unit tests); it only affects the CLI
  // entrypoint below.
  const results: TranslationResult[] = existsSync(outPath)
    ? (JSON.parse(readFileSync(outPath, 'utf-8')) as TranslationResult[])
    : []
  const completed = new Set(results.map((r) => `${r.corpusEntryId}:${r.condition}`))

  for (const entry of entries) {
    for (const condition of ['A', 'B'] as const) {
      const key = `${entry.id}:${condition}`
      if (completed.has(key)) continue
      const result = await translateOne(entry, condition, glossary, providers)
      results.push(result)
      completed.add(key)
      // Checkpoint write, with a couple of short retries: on Windows this file is written
      // once per API call (hundreds of times per run) and can occasionally hit a transient
      // "file busy" error from antivirus/indexing. Losing the whole run to that would be far
      // more wasteful (re-billed API calls on next resume) than a brief retry here.
      for (let attempt = 0; ; attempt++) {
        try {
          writeFileSync(outPath, JSON.stringify(results, null, 2))
          break
        } catch (err) {
          if (attempt >= 3) throw err
          await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)))
        }
      }
    }
  }

  const failures = results.filter((r) => r.error !== null)
  console.log(`${results.length} translations written, ${failures.length} failed`)
}

const invokedPath = process.argv[1]?.replace(/\\/g, '/')
const modulePath = new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
if (invokedPath === modulePath) {
  main()
}
