import type { GlossaryEntry } from '@localize-infra/schemas'

export interface GlossaryHit {
  term: string
  respected: boolean
}

export function checkGlossaryConsistency(
  sourceText: string,
  translatedText: string,
  locale: string,
  glossary: GlossaryEntry[],
): GlossaryHit[] {
  const hits: GlossaryHit[] = []
  for (const entry of glossary) {
    if (!sourceText.includes(entry.term)) continue
    const expected = entry.translations[locale]
    if (!expected) continue
    hits.push({ term: entry.term, respected: translatedText.includes(expected) })
  }
  return hits
}
