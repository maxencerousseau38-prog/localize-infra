import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Framework } from './types.js';

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

function readPackageJson(rootDir: string): PackageJson | null {
  const path = join(rootDir, 'package.json');
  if (!existsSync(path)) return null;
  const raw = readFileSync(path, 'utf-8');
  try {
    return JSON.parse(raw) as PackageJson;
  } catch {
    throw new Error(`Failed to parse package.json as JSON: ${path}`);
  }
}

function hasDependency(pkg: PackageJson, name: string): boolean {
  return Boolean(pkg.dependencies?.[name] || pkg.devDependencies?.[name]);
}

/**
 * The extensions the extractor can actually read.
 *
 * `.jsx` and `.js` were missing, and the omission was **silent**:
 * `detectFramework` only reads `package.json` and a config file, so a
 * JavaScript Vite project was detected correctly and then extracted **zero**
 * strings — every source file fell outside the glob and
 * `addSourceFilesAtPaths` opened nothing. Reported from a real
 * `npm create vite -- --template react` project, whose components are
 * `src/App.jsx`.
 *
 * That failure mode is the worst kind this repository keeps meeting: the step
 * that could have said something (detection) succeeded, and the step that
 * failed reported a plausible number rather than an error.
 *
 * Verified before widening, against the real extractor: ts-morph parses JSX in
 * both `.jsx` and `.js` under the settings `extractFromProject` already uses,
 * with no compiler option added — and a plain `.js` module with no JSX yields
 * nothing, so the wider glob costs no false positives.
 */
const SOURCE_EXTENSIONS = '{ts,tsx,js,jsx}';

const NEXT_CONFIG_FILES = [
  'next.config.js',
  'next.config.mjs',
  'next.config.ts',
];
const VITE_CONFIG_FILES = [
  'vite.config.js',
  'vite.config.ts',
  'vite.config.mjs',
];

export function detectFramework(rootDir: string): Framework | null {
  const pkg = readPackageJson(rootDir);
  if (!pkg) return null;

  const hasNextConfig = NEXT_CONFIG_FILES.some((f) =>
    existsSync(join(rootDir, f)),
  );
  if (hasDependency(pkg, 'next') || hasNextConfig) {
    return {
      id: 'nextjs',
      name: 'Next.js',
      sourceGlobs: [
        `app/**/*.${SOURCE_EXTENSIONS}`,
        `pages/**/*.${SOURCE_EXTENSIONS}`,
        `components/**/*.${SOURCE_EXTENSIONS}`,
        `src/**/*.${SOURCE_EXTENSIONS}`,
      ],
      localesDir: 'locales',
    };
  }

  const hasViteConfig = VITE_CONFIG_FILES.some((f) =>
    existsSync(join(rootDir, f)),
  );
  if (
    hasDependency(pkg, 'react') &&
    (hasDependency(pkg, 'vite') || hasViteConfig)
  ) {
    return {
      id: 'vite-react',
      name: 'Vite + React',
      sourceGlobs: [`src/**/*.${SOURCE_EXTENSIONS}`],
      localesDir: 'locales',
    };
  }

  if (hasDependency(pkg, 'react-native')) {
    return {
      id: 'react-native',
      name: 'React Native',
      sourceGlobs: [
        `App.${SOURCE_EXTENSIONS}`,
        `src/**/*.${SOURCE_EXTENSIONS}`,
      ],
      localesDir: 'locales',
    };
  }

  return null;
}
