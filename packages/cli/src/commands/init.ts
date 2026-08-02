import { join } from 'node:path';
import {
  buildKeyCatalog,
  detectFramework,
  extractFromProject,
  mergeLocaleFile,
  readLocaleFile,
  writeLocaleFile,
} from '@localize-infra/core';
import { translateBatch } from '../translate-client.js';

const DEFAULT_LOCALES = ['de', 'ja', 'es', 'ar', 'pt-BR'];
const DEFAULT_API_URL = 'http://localhost:8787';

export type InitResult =
  | {
      ok: true;
      framework: string;
      keysWritten: number;
      locales: {
        locale: string;
        keysWritten: number;
        missingKeys: string[];
        error: string | null;
      }[];
    }
  | { ok: false; reason: string };

export async function runInit(
  targetDir: string,
  options?: { force?: boolean; apiUrl?: string; locales?: string[] },
): Promise<InitResult> {
  const framework = detectFramework(targetDir);
  if (!framework) {
    return {
      ok: false,
      reason:
        'No supported framework detected. Supported: Next.js, Vite + React, React Native.',
    };
  }

  const extracted = extractFromProject(targetDir, framework.sourceGlobs);
  const fresh = buildKeyCatalog(extracted);
  const localesDir = join(targetDir, framework.localesDir);

  const existing = readLocaleFile(localesDir, 'en');
  const droppedKeys = Object.keys(existing).filter((key) => !(key in fresh));
  if (droppedKeys.length > 0 && !options?.force) {
    return {
      ok: false,
      reason: `Refusing to overwrite locales/en.json: ${droppedKeys.length} existing key(s) would be removed (they no longer match any extracted string). Re-run with --force to proceed anyway.`,
    };
  }

  const merged = mergeLocaleFile(localesDir, 'en', fresh);
  writeLocaleFile(localesDir, 'en', merged);

  const apiUrl = options?.apiUrl ?? DEFAULT_API_URL;
  const targetLocales = options?.locales ?? DEFAULT_LOCALES;
  const translatableStrings = extracted.map((e) => ({
    key: e.key,
    text: e.text,
    filePath: e.filePath,
    componentName: e.componentName,
    surroundingCode: e.surroundingCode,
  }));

  const localeResults: {
    locale: string;
    keysWritten: number;
    missingKeys: string[];
    error: string | null;
  }[] = [];
  for (const locale of targetLocales) {
    try {
      const { translations, missingKeys } = await translateBatch(
        apiUrl,
        locale,
        translatableStrings,
      );
      const freshForLocale = buildKeyCatalog(translations);
      const mergedLocale = mergeLocaleFile(localesDir, locale, freshForLocale);
      writeLocaleFile(localesDir, locale, mergedLocale);
      localeResults.push({
        locale,
        keysWritten: Object.keys(mergedLocale).length,
        missingKeys,
        error: null,
      });
    } catch (error) {
      localeResults.push({
        locale,
        keysWritten: 0,
        missingKeys: [],
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    ok: true,
    framework: framework.name,
    keysWritten: Object.keys(merged).length,
    locales: localeResults,
  };
}
