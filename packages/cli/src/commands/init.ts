import { join } from 'node:path';
import {
  buildKeyCatalog,
  detectFramework,
  extractFromProject,
  mergeLocaleFile,
  readLocaleFile,
  writeLocaleFile,
} from '@localize-infra/core';
import { OpenPrApiRequestSchema } from '@localize-infra/schemas';
import { requestPr } from '../open-pr-client.js';
import { translateBatch } from '../translate-client.js';

// Same owner/repo character-set constraints the API enforces server-side
// (OpenPrApiRequestSchema), reused here so an invalid --owner/--repo fails
// fast, client-side, before the per-locale translation loop below runs any
// billed LLM calls — rather than failing with a raw ZodError from
// requestPr() only after that loop (and every locale's translation) has
// already completed.
const OwnerRepoSchema = OpenPrApiRequestSchema.pick({
  owner: true,
  repo: true,
});

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
      pr?: { prUrl: string; prNumber: number };
    }
  | { ok: false; reason: string };

export async function runInit(
  targetDir: string,
  options?: {
    force?: boolean;
    apiUrl?: string;
    apiToken?: string;
    locales?: string[];
    openPr?: boolean;
    owner?: string;
    repo?: string;
    baseBranch?: string;
  },
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

  const apiToken = options?.apiToken;
  if (!apiToken) {
    return {
      ok: false,
      reason:
        'No API token configured. Pass --api-token or set the LOCALIZE_API_TOKEN environment variable.',
    };
  }

  // Fail fast, before any writes and before the (billed) per-locale
  // translation loop runs: --open-pr without a valid --owner/--repo can
  // only ever fail later at the requestPr() call, but by then every locale
  // has already been translated. Catching it here means a typo'd or
  // missing --owner/--repo costs nothing.
  if (options?.openPr) {
    const ownerRepoResult = OwnerRepoSchema.safeParse({
      owner: options.owner ?? '',
      repo: options.repo ?? '',
    });
    if (!ownerRepoResult.success) {
      return {
        ok: false,
        reason:
          '--open-pr requires valid --owner and --repo values (non-empty, matching GitHub repository slug characters: letters, digits, ".", "_", "-"). Pass both flags and re-run.',
      };
    }
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
        apiToken,
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

  const keysWritten = Object.keys(merged).length;

  if (options?.openPr) {
    // Only include locales that actually succeeded: a locale whose translateBatch call
    // failed was never written to disk, so readLocaleFile would return `{}` for it and
    // silently include an empty locale file in the PR instead of omitting it.
    const prFiles = localeResults
      .filter((r) => r.error === null)
      .map((r) => ({
        path: `${framework.localesDir}/${r.locale}.json`,
        // Read back what was just written, rather than recomputing a merge: mergeLocaleFile's
        // loop only walks the KEYS OF ITS `fresh` ARGUMENT, so calling it with an empty catalog
        // here would silently return `{}`, not the file's real contents. readLocaleFile reads
        // the actual bytes on disk that writeLocaleFile produced a few lines above.
        content: `${JSON.stringify(readLocaleFile(localesDir, r.locale), null, 2)}\n`,
      }));

    // If every target locale's translation failed, there's nothing to put in a PR.
    // OpenPrApiRequestSchema requires a non-empty `files` array, so calling requestPr
    // here would throw a raw ZodError from client-side validation before the request
    // is even sent. Skip the call and return normally instead: the per-locale `error`
    // fields in localeResults already explain what failed and why.
    if (prFiles.length > 0) {
      const prResult = await requestPr(
        apiUrl,
        {
          owner: options.owner ?? '',
          repo: options.repo ?? '',
          baseBranch: options.baseBranch ?? 'main',
          title: `Add translations (${targetLocales.join(', ')})`,
          body: `Automated by \`localize-infra init\`. ${localeResults.map((r) => `${r.locale}: ${r.keysWritten} key(s)${r.missingKeys.length > 0 ? ` (${r.missingKeys.length} untranslated)` : ''}`).join('; ')}`,
          files: prFiles,
        },
        apiToken,
      );
      return {
        ok: true,
        framework: framework.name,
        keysWritten,
        locales: localeResults,
        pr: prResult,
      };
    }
  }

  return {
    ok: true,
    framework: framework.name,
    keysWritten,
    locales: localeResults,
  };
}
