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
  for (const [key, value] of Object.entries(catalog).sort(([a], [b]) =>
    a.localeCompare(b),
  ))
    sorted[key] = value;
  writeFileSync(
    join(localesDir, `${locale}.json`),
    `${JSON.stringify(sorted, null, 2)}\n`,
  );
}
