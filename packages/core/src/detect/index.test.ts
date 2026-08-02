import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { detectFramework } from './index.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'core-detect-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function writePackageJson(
  deps: Record<string, string>,
  devDeps: Record<string, string> = {},
): void {
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({
      name: 'fixture',
      dependencies: deps,
      devDependencies: devDeps,
    }),
  );
}

describe('detectFramework', () => {
  it('detects Next.js from a "next" dependency', () => {
    writePackageJson({ next: '^14.0.0', react: '^18.0.0' });
    const framework = detectFramework(dir);
    expect(framework?.id).toBe('nextjs');
    expect(framework?.sourceGlobs).toContain('app/**/*.{ts,tsx}');
  });

  it('detects Next.js from a next.config.js file even without the dependency listed under a different key', () => {
    writePackageJson({}, { next: '^14.0.0' });
    writeFileSync(join(dir, 'next.config.js'), 'module.exports = {}');
    expect(detectFramework(dir)?.id).toBe('nextjs');
  });

  it('detects Vite + React from vite and react dependencies together', () => {
    writePackageJson({ react: '^18.0.0' }, { vite: '^5.0.0' });
    const framework = detectFramework(dir);
    expect(framework?.id).toBe('vite-react');
    expect(framework?.sourceGlobs).toContain('src/**/*.{ts,tsx}');
  });

  it('does not detect Vite + React from vite alone without react', () => {
    writePackageJson({}, { vite: '^5.0.0' });
    expect(detectFramework(dir)).toBeNull();
  });

  it('detects React Native from a "react-native" dependency', () => {
    writePackageJson({ react: '^18.0.0', 'react-native': '^0.74.0' });
    const framework = detectFramework(dir);
    expect(framework?.id).toBe('react-native');
  });

  it('prefers Next.js over React Native-style detection when both signals could theoretically overlap', () => {
    writePackageJson({ next: '^14.0.0', react: '^18.0.0' });
    expect(detectFramework(dir)?.id).toBe('nextjs');
  });

  it('returns null when no package.json exists', () => {
    expect(detectFramework(dir)).toBeNull();
  });

  it('returns null when package.json exists but matches no known framework', () => {
    writePackageJson({ express: '^4.0.0' });
    expect(detectFramework(dir)).toBeNull();
  });

  it('throws a clear, actionable error (naming the file) when package.json is malformed JSON', () => {
    const path = join(dir, 'package.json');
    writeFileSync(path, '{ not valid json');
    let thrown: unknown;
    try {
      detectFramework(dir);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(Error);
    const message = (thrown as Error).message;
    expect(message).toContain(path);
    expect(message).not.toMatch(/^Unexpected token/);
  });
});
