import type { CorpusEntry, GlossaryEntry } from '@localize-infra/schemas'
import type { TranslateRequest } from '../router/types.js'

const BASE_INSTRUCTIONS =
  'You are a professional software localization translator. Preserve any placeholders or interpolation syntax exactly as they appear (e.g. %s, {{variable}}, {variable}, ICU plural/select blocks). Return only the translated string, with no explanation, quotes, or markdown.'

export function buildConditionAPrompt(entry: CorpusEntry): TranslateRequest {
  return {
    systemPrompt: `${BASE_INSTRUCTIONS} Translate the following UI string from English to locale "${entry.targetLocale}".`,
    userPrompt: entry.sourceText,
  }
}

export function buildConditionBPrompt(entry: CorpusEntry, glossary: GlossaryEntry[]): TranslateRequest {
  const relevantGlossary = glossary
    .filter((g) => entry.sourceText.includes(g.term) && g.translations[entry.targetLocale])
    .map((g) => `${g.term} -> ${g.translations[entry.targetLocale]}`)

  const contextLines = [
    `${BASE_INSTRUCTIONS} Translate the following UI string from English to locale "${entry.targetLocale}".`,
    `Source file: ${entry.filePath}`,
    entry.componentName ? `Component/module: ${entry.componentName}` : null,
    entry.surroundingCode ? `Surrounding code:\n${entry.surroundingCode}` : null,
    relevantGlossary.length > 0 ? `Glossary (use these exact translations for these terms):\n${relevantGlossary.join('\n')}` : null,
    entry.icuStructure ? `ICU message structure to preserve: ${entry.icuStructure}` : null,
    entry.maxLength ? `Length constraint: the translation must not exceed ${entry.maxLength} characters.` : null,
  ].filter((line): line is string => line !== null)

  return {
    systemPrompt: contextLines.join('\n'),
    userPrompt: entry.sourceText,
  }
}
