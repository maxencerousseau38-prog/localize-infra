import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CorpusEntrySchema, GlossaryEntrySchema, TranslationResultSchema } from '@localize-infra/schemas'
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

describe('Sprint 0 exit gate: placeholder/ICU integrity on condition B', () => {
  it('meets or exceeds 99.5% across the full corpus', () => {
    // translate.ts checkpoints translations.json across process invocations and never prunes
    // entries whose corpusEntryId no longer appears in entries.json (e.g. after corpus:build is
    // re-run with different/added sources, which reshuffles stratifiedSample's per-group stride
    // and drops some previously-sampled ids). Scoping this gate to `entries` (the current
    // corpus) rather than to the raw `translations` array keeps the denominator equal to what
    // was actually scored, instead of silently counting stale, unscored translations as failures.
    const conditionBByEntryId = new Map(
      translations.filter((t) => t.condition === 'B' && t.error === null).map((t) => [t.corpusEntryId, t]),
    )

    let intact = 0
    let scored = 0
    const failures: string[] = []
    for (const entry of entries) {
      const result = conditionBByEntryId.get(entry.id)
      if (!result) continue
      scored++
      const score = scoreTranslation(entry, result, glossary)
      const passed = score.placeholderIntact && score.icuValid
      if (passed) intact++
      else failures.push(`${entry.id}: source="${entry.sourceText}" translated="${result.text}"`)
    }
    expect(scored).toBeGreaterThan(0)

    const rate = intact / scored
    if (rate < PLACEHOLDER_ICU_THRESHOLD) {
      console.error(`Failures (${failures.length}):\n${failures.slice(0, 20).join('\n')}`)
    }
    expect(rate).toBeGreaterThanOrEqual(PLACEHOLDER_ICU_THRESHOLD)
  })
})
