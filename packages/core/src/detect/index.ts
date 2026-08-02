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
        'app/**/*.{ts,tsx}',
        'pages/**/*.{ts,tsx}',
        'components/**/*.{ts,tsx}',
        'src/**/*.{ts,tsx}',
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
      sourceGlobs: ['src/**/*.{ts,tsx}'],
      localesDir: 'locales',
    };
  }

  if (hasDependency(pkg, 'react-native')) {
    return {
      id: 'react-native',
      name: 'React Native',
      sourceGlobs: ['App.tsx', 'App.ts', 'src/**/*.{ts,tsx}'],
      localesDir: 'locales',
    };
  }

  return null;
}
