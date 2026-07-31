export type PlaceholderSyntax = 'brace' | 'doubleBrace' | 'printf'

export interface PlaceholderToken {
  syntax: PlaceholderSyntax
  token: string
}

export function extractPlaceholders(text: string): PlaceholderToken[] {
  const tokens: PlaceholderToken[] = []

  for (const m of text.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)) {
    tokens.push({ syntax: 'doubleBrace', token: `{{${m[1]}}}` })
  }

  const withoutDoubleBrace = text.replace(/\{\{\s*[a-zA-Z0-9_]+\s*\}\}/g, '')
  for (const m of withoutDoubleBrace.matchAll(/\{([a-zA-Z0-9_]+)\}/g)) {
    tokens.push({ syntax: 'brace', token: `{${m[1]}}` })
  }

  for (const m of text.matchAll(/%(?:\d+\$)?[sd]/g)) {
    tokens.push({ syntax: 'printf', token: m[0] })
  }

  return tokens
}

function tokenCounts(tokens: PlaceholderToken[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const t of tokens) counts.set(t.token, (counts.get(t.token) ?? 0) + 1)
  return counts
}

export function placeholdersIntact(source: string, translated: string): boolean {
  const sourceCounts = tokenCounts(extractPlaceholders(source))
  const translatedCounts = tokenCounts(extractPlaceholders(translated))
  if (sourceCounts.size !== translatedCounts.size) return false
  for (const [token, count] of sourceCounts) {
    if (translatedCounts.get(token) !== count) return false
  }
  return true
}
