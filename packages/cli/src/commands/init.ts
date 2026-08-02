import { join } from 'node:path';
import {
  buildKeyCatalog,
  detectFramework,
  extractFromProject,
  mergeLocaleFile,
  writeLocaleFile,
} from '@localize-infra/core';

export type InitResult =
  | { ok: true; framework: string; keysWritten: number }
  | { ok: false; reason: string };

export async function runInit(targetDir: string): Promise<InitResult> {
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
  const merged = mergeLocaleFile(localesDir, 'en', fresh);
  writeLocaleFile(localesDir, 'en', merged);

  return {
    ok: true,
    framework: framework.name,
    keysWritten: Object.keys(merged).length,
  };
}
