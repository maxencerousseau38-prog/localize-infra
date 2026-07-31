import type { CorpusEntry, GlossaryEntry } from '@localize-infra/schemas'

const CANDIDATE_TERMS = ['GitHub', 'OAuth', 'SSH', 'Markdown', 'API', 'URL', 'Excalidraw', 'Gitea', 'Zulip', 'webhook']
const MIN_OCCURRENCES = 3
const VERBATIM_THRESHOLD = 0.8

export function deriveGlossary(entries: CorpusEntry[]): GlossaryEntry[] {
  const byLocale = new Map<string, CorpusEntry[]>()
  for (const e of entries) {
    const list = byLocale.get(e.targetLocale) ?? []
    list.push(e)
    byLocale.set(e.targetLocale, list)
  }

  const glossary: GlossaryEntry[] = []
  for (const term of CANDIDATE_TERMS) {
    const translations: Record<string, string> = {}
    for (const [locale, localeEntries] of byLocale) {
      const withTerm = localeEntries.filter((e) => e.sourceText.includes(term))
      if (withTerm.length < MIN_OCCURRENCES) continue
      const keptVerbatim = withTerm.filter((e) => e.humanReference.includes(term))
      if (keptVerbatim.length / withTerm.length >= VERBATIM_THRESHOLD) {
        translations[locale] = term
      }
    }
    if (Object.keys(translations).length > 0) glossary.push({ term, translations })
  }
  return glossary
}
