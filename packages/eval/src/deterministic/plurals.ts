import {
  type MessageFormatElement,
  TYPE,
  parse,
} from '@formatjs/icu-messageformat-parser';

export function expectedPluralCategories(locale: string): string[] {
  return new Intl.PluralRules(locale).resolvedOptions().pluralCategories;
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
