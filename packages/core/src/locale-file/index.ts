import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export type LocaleCatalog = Record<string, string>;

export function buildKeyCatalog(
  entries: { key: string; text: string }[],
): LocaleCatalog {
  const catalog: LocaleCatalog = {};
  for (const entry of entries) catalog[entry.key] = entry.text;
  return catalog;
}

export function readLocaleFile(
  localesDir: string,
  locale: string,
): LocaleCatalog {
  const path = join(localesDir, `${locale}.json`);
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, 'utf-8')) as LocaleCatalog;
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
  for (const key of Object.keys(fresh)) {
    merged[key] = locale === 'en' ? fresh[key] : (existing[key] ?? fresh[key]);
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
  for (const key of Object.keys(catalog).sort()) sorted[key] = catalog[key];
  writeFileSync(
    join(localesDir, `${locale}.json`),
    `${JSON.stringify(sorted, null, 2)}\n`,
  );
}
