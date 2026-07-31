import { readFileSync, writeFileSync } from 'node:fs'
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
  const providerName = pickProvider(`${entry.id}-${condition}`)
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
  const results = await runTranslationPipeline(entries, glossary, {
    anthropic: getProvider('anthropic'),
    openai: getProvider('openai'),
  })
  writeFileSync(join(DATA_DIR, 'translations.json'), JSON.stringify(results, null, 2))
  const failures = results.filter((r) => r.error !== null)
  console.log(`${results.length} translations written, ${failures.length} failed`)
}

if (process.argv[1] === new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')) {
  main()
}
