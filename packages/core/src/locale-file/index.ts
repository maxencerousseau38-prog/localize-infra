import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export type LocaleCatalog = Record<string, string>;

// When two extracted entries share the same key (e.g. because `keyFor`
// truncates its slug and two different strings collide on the truncated
// prefix), the later one is disambiguated with a numeric suffix instead of
// silently overwriting the earlier one. Entries that share both the same key
// AND the same text are genuine duplicate extractions of the identical
// string and collapse into a single catalog entry.
export function buildKeyCatalog(
  entries: { key: string; text: string }[],
): LocaleCatalog {
  const catalog: LocaleCatalog = {};
  for (const entry of entries) {
    let key = entry.key;
    let suffix = 2;
    while (key in catalog && catalog[key] !== entry.text) {
      key = `${entry.key}_${suffix}`;
      suffix++;
    }
    catalog[key] = entry.text;
  }
  return catalog;
}

export function readLocaleFile(
  localesDir: string,
  locale: string,
): LocaleCatalog {
  const path = join(localesDir, `${locale}.json`);
  if (!existsSync(path)) return {};
  const raw = readFileSync(path, 'utf-8');
  try {
    return JSON.parse(raw) as LocaleCatalog;
  } catch {
    throw new Error(`Failed to parse locale file as JSON: ${path}`);
  }
}

// Keys present in `fresh` but not in the existing file are added. Keys present in the
// existing file but not in `fresh` are dropped (the source string was removed/changed
// upstream). For any locale other than 'en', a key present in BOTH keeps its existing
// (human- or model-translated) value — a re-extraction must never silently overwrite a
// real translation with the English source text. For 'en' itself, the freshly extracted
// text is always authoritative (it IS the source of truth).
export function mergeLocaleFile(
  localesDir: string,
  locale: string,
  fresh: LocaleCatalog,
): LocaleCatalog {
  const existing = readLocaleFile(localesDir, locale);
  const merged: LocaleCatalog = {};
  for (const [key, freshValue] of Object.entries(fresh)) {
    merged[key] = locale === 'en' ? freshValue : (existing[key] ?? freshValue);
  }
  return merged;
}

export function writeLocaleFile(
  localesDir: string,
  locale: string,
  catalog: LocaleCatalog,
): void {
  mkdirSync(localesDir, { recursive: true });
  const sorted: LocaleCatalog = {};
  // Plain code-unit comparison, not localeCompare: sort order must be stable across
  // machines/locales since this output is committed to git and diffed.
  for (const [key, value] of Object.entries(catalog).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  ))
    sorted[key] = value;
  writeFileSync(
    join(localesDir, `${locale}.json`),
    `${JSON.stringify(sorted, null, 2)}\n`,
  );
}

/**
 * Which keys still need a translation.
 *
 * A key already present in the committed locale file is never re-translated:
 * whatever is there is either a previous machine translation somebody accepted
 * or a correction somebody made by hand, and both are decisions this pipeline
 * has no business revisiting. It is also the difference between paying a model
 * for every string on every run and paying it only for new ones.
 */
export function pendingKeys(
  fresh: LocaleCatalog,
  existing: LocaleCatalog,
): string[] {
  return Object.keys(fresh).filter((key) => !(key in existing));
}

/**
 * Builds the locale file to commit.
 *
 * The precedence is the whole point, and it was wrong in the pipeline for as
 * long as the pipeline existed: `{ ...existing, ...translated }` let fresh
 * model output win, so every run overwrote the hand-corrected German that a
 * customer had gone to the trouble of fixing. The promise this product makes
 * about preserving manual modifications was false at the only layer that
 * actually writes the file.
 *
 * Precedence, highest first:
 *
 *  1. `existing` — a human's or a previous run's decision, never overwritten.
 *  2. `translated` — a new translation, for keys that had none.
 *  3. `fresh` — the source text, when a locale failed or the model skipped a
 *     key. An untranslated string is visibly wrong in the product; a missing
 *     key is a crash or a blank space, which is worse.
 *
 * Keys are taken from `fresh` alone, so a string deleted from the source stops
 * being shipped in every locale rather than lingering forever.
 */
export function mergeTranslations(
  fresh: LocaleCatalog,
  existing: LocaleCatalog,
  translated: LocaleCatalog,
): LocaleCatalog {
  const merged: LocaleCatalog = {};
  for (const key of Object.keys(fresh)) {
    merged[key] = existing[key] ?? translated[key] ?? (fresh[key] as string);
  }
  return merged;
}

/**
 * Whether two catalogs carry the same translations.
 *
 * Compared as parsed key/value maps, deliberately, and not as the JSON this
 * pipeline would write. `JSON.stringify(..., 2)` normalises indentation, so a
 * repository formatted differently from our output would differ on every byte
 * comparison while carrying identical translations — and the pipeline would
 * open a reformatting pull request on every run. That is the same noise as the
 * empty pull request this function exists to prevent, wearing a better excuse.
 */
export function catalogsEqual(a: LocaleCatalog, b: LocaleCatalog): boolean {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => key in b && a[key] === b[key]);
}
