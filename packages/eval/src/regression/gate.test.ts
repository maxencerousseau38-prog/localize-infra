import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CorpusEntrySchema, GlossaryEntrySchema, TranslationResultSchema, type CorpusEntry } from '@localize-infra/schemas'
import { scoreTranslation } from '../deterministic/score.js'

const DATA_DIR = join(process.cwd(), 'src/corpus/data')
const PLACEHOLDER_ICU_THRESHOLD = 0.995

const entries = (JSON.parse(readFileSync(join(DATA_DIR, 'entries.json'), 'utf-8')) as unknown[]).map((e) =>
  CorpusEntrySchema.parse(e),
)
const glossary = (JSON.parse(readFileSync(join(DATA_DIR, 'glossary.json'), 'utf-8')) as unknown[]).map((g) =>
  GlossaryEntrySchema.parse(g),
)
const translations = (JSON.parse(readFileSync(join(DATA_DIR, 'translations.json'), 'utf-8')) as unknown[]).map((t) =>
  TranslationResultSchema.parse(t),
)

const entriesById = new Map<string, CorpusEntry>(entries.map((e) => [e.id, e]))

describe('Sprint 0 exit gate: placeholder/ICU integrity on condition B', () => {
  it('meets or exceeds 99.5% across the full corpus', () => {
    const conditionB = translations.filter((t) => t.condition === 'B' && t.error === null)
    expect(conditionB.length).toBeGreaterThan(0)

    let intact = 0
    const failures: string[] = []
    for (const result of conditionB) {
      const entry = entriesById.get(result.corpusEntryId)
      if (!entry) continue
      const score = scoreTranslation(entry, result, glossary)
      const passed = score.placeholderIntact && score.icuValid
      if (passed) intact++
      else failures.push(`${entry.id}: source="${entry.sourceText}" translated="${result.text}"`)
    }

    const rate = intact / conditionB.length
    if (rate < PLACEHOLDER_ICU_THRESHOLD) {
      console.error(`Failures (${failures.length}):\n${failures.slice(0, 20).join('\n')}`)
    }
    expect(rate).toBeGreaterThanOrEqual(PLACEHOLDER_ICU_THRESHOLD)
  })
})
