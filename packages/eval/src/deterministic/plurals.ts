import {
  type MessageFormatElement,
  TYPE,
  parse,
} from '@formatjs/icu-messageformat-parser';

/**
 * CLDR's canonical order. Not decoration — it is the order the categories are
 * defined in, the order they read in, and the order a plural message is
 * conventionally written in.
 */
const CLDR_ORDER = ['zero', 'one', 'two', 'few', 'many', 'other'];

/**
 * The plural categories a locale requires, in a fixed order.
 *
 * `Intl.PluralRules` guarantees the *set* and not the sequence, and the
 * platforms disagree: Node 26 on Windows returns Arabic as zero · one · two ·
 * few · many · other, and Node 20 on Linux returns the same six sorted
 * alphabetically. This function returned that array untouched, so its output
 * changed shape depending on the machine — which is why the same test passed
 * locally and failed in CI, and why it stayed hidden for as long as CI could
 * not run.
 *
 * The set is whatever ICU says; only the order is ours. Anything ICU reports
 * outside the canonical six is appended rather than dropped, so a future CLDR
 * category cannot vanish here silently.
 */
export function expectedPluralCategories(locale: string): string[] {
  const reported = new Intl.PluralRules(locale).resolvedOptions()
    .pluralCategories as string[];

  const canonical = CLDR_ORDER.filter((category) =>
    reported.includes(category),
  );
  const unrecognised = reported
    .filter((category) => !CLDR_ORDER.includes(category))
    .sort();

  return [...canonical, ...unrecognised];
}

function findPluralArms(ast: MessageFormatElement[]): string[] {
  const arms: string[] = [];
  for (const node of ast) {
    if (node.type === TYPE.plural || node.type === TYPE.select) {
      for (const [key, option] of Object.entries(node.options)) {
        arms.push(key);
        arms.push(...findPluralArms(option.value));
      }
    } else if ('children' in node && node.children) {
      arms.push(...findPluralArms(node.children));
    }
  }
  return arms;
}

export function pluralCategoriesCorrect(
  icuText: string,
  locale: string,
): boolean {
  // requiresOtherClause defaults to true and makes parse() throw when the
  // mandatory `other` arm is missing, before our own check below can run.
  // Disable it so malformed-by-missing-other messages fall through to the
  // `namedArms.has('other')` check instead of throwing a SyntaxError.
  const ast = parse(icuText, { requiresOtherClause: false });
  const arms = findPluralArms(ast);
  const namedArms = new Set(arms.filter((arm) => !arm.startsWith('=')));
  if (!namedArms.has('other')) return false;
  const expected = new Set(expectedPluralCategories(locale));
  for (const arm of namedArms) {
    if (!expected.has(arm)) return false;
  }
  return true;
}
