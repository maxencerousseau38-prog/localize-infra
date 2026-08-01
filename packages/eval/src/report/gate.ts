const B_PREFERRED_OR_EQUIVALENT_THRESHOLD = 0.5
const MIN_PASSING_LOCALES = 3

export interface LocaleResult {
  bPreferredOrEquivalentRate: number
}

export function computeGate(perLocale: Map<string, LocaleResult>): { passed: boolean; passingLocales: string[] } {
  const passingLocales = [...perLocale.entries()]
    .filter(([, result]) => result.bPreferredOrEquivalentRate >= B_PREFERRED_OR_EQUIVALENT_THRESHOLD)
    .map(([locale]) => locale)
  return { passed: passingLocales.length >= MIN_PASSING_LOCALES, passingLocales }
}
