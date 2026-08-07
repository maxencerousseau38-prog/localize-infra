/**
 * Locale presentation helpers.
 *
 * Rendering a translation without `lang` and `dir` is the single most visible
 * competence failure available to a localization product: the browser picks the
 * wrong font, hyphenation and quotation marks are wrong, and a screen reader
 * announces Japanese with an English voice. These helpers exist so no component
 * has to remember to do it.
 */

/**
 * Right-to-left scripts, by language subtag. Deliberately a small explicit list
 * rather than a guess: `Intl.Locale.prototype.getTextInfo` is not available in
 * every runtime we target, and a wrong `dir` is worse than a missing one.
 */
const RTL_LANGUAGES = new Set([
  'ar',
  'arc',
  'ckb',
  'dv',
  'fa',
  'he',
  'ks',
  'ps',
  'sd',
  'ug',
  'ur',
  'yi',
]);

/** Language subtag, lowercased — `pt-BR` → `pt`. */
function language(locale: string): string {
  return locale.split(/[-_]/)[0]?.toLowerCase() ?? '';
}

export function localeDir(locale: string): 'ltr' | 'rtl' {
  return RTL_LANGUAGES.has(language(locale)) ? 'rtl' : 'ltr';
}

/**
 * Font stack class for a locale's script. Latin locales fall through to the
 * interface font, which is deliberate — the design system uses one typeface
 * everywhere it can.
 */
export function localeFontClass(locale: string): string {
  switch (language(locale)) {
    case 'ja':
      return 'font-jp';
    case 'ar':
    case 'fa':
    case 'ur':
      return 'font-ar';
    default:
      return '';
  }
}

/**
 * The full display name of a locale, resolved by the platform.
 *
 * Locale codes are shown because they are what appears in the repository, but
 * `pt-BR` means nothing to a non-technical reviewer — every chip carries the
 * resolved name in its accessible name (design system §4.7). Falls back to the
 * code itself when the runtime cannot resolve it, never to an invented name.
 */
export function localeDisplayName(locale: string, displayIn = 'en'): string {
  try {
    return (
      new Intl.DisplayNames([displayIn], { type: 'language' }).of(locale) ??
      locale
    );
  } catch {
    return locale;
  }
}

/** Props to spread onto any element rendering text in `locale`. */
export function localeTextProps(locale: string) {
  return { lang: locale, dir: localeDir(locale) } as const;
}
