export function lengthOverflow(translated: string, maxLength: number | null): boolean {
  if (maxLength === null) return false
  return translated.length > maxLength
}
