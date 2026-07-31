export function flattenLocaleJson(obj: unknown, prefix = ''): Map<string, string> {
  const result = new Map<string, string>()
  if (typeof obj !== 'object' || obj === null) return result
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'string') {
      if (value.length > 0) result.set(path, value)
    } else if (typeof value === 'object' && value !== null) {
      for (const [nestedKey, nestedValue] of flattenLocaleJson(value, path)) {
        result.set(nestedKey, nestedValue)
      }
    }
  }
  return result
}

export interface ExtractedString {
  key: string
  sourceText: string
  humanReference: string
}

export function extractJsonLocaleStrings(sourceJson: unknown, targetJson: unknown): ExtractedString[] {
  const source = flattenLocaleJson(sourceJson)
  const target = flattenLocaleJson(targetJson)
  const extracted: ExtractedString[] = []
  for (const [key, sourceText] of source) {
    const humanReference = target.get(key)
    if (humanReference) extracted.push({ key, sourceText, humanReference })
  }
  return extracted
}
