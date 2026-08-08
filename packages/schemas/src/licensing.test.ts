import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guards the repository's licence scope.
 *
 * The root LICENSE was previously unscoped MIT while five directories were
 * proprietary, which arguably granted MIT rights over all of them. Nothing
 * caught it because licensing is not something a build checks. This does.
 *
 * It lives in `schemas` only because that package already runs a test suite and
 * has no dependencies of its own; it asserts nothing about schemas itself.
 */
const REPO_ROOT = join(import.meta.dirname, '../../..');

/** The open core. Everything else is proprietary by default. */
const MIT_PACKAGES = [
  'packages/cli',
  'packages/core',
  'packages/eval',
  'packages/schemas',
];

function workspaceDirs(): string[] {
  const dirs: string[] = [];
  for (const group of ['packages', 'apps', 'services']) {
    const groupPath = join(REPO_ROOT, group);
    if (!existsSync(groupPath)) continue;
    for (const entry of readdirSync(groupPath)) {
      if (existsSync(join(groupPath, entry, 'package.json'))) {
        dirs.push(`${group}/${entry}`);
      }
    }
  }
  return dirs;
}

function manifest(dir: string) {
  return JSON.parse(
    readFileSync(join(REPO_ROOT, dir, 'package.json'), 'utf8'),
  ) as { license?: string; private?: boolean };
}

describe('repository licensing', () => {
  const dirs = workspaceDirs();

  it('finds the workspaces it is meant to check', () => {
    expect(dirs.length).toBeGreaterThanOrEqual(9);
    for (const mit of MIT_PACKAGES) expect(dirs).toContain(mit);
  });

  it('scopes the root LICENSE instead of licensing everything as MIT', () => {
    const root = readFileSync(join(REPO_ROOT, 'LICENSE'), 'utf8');

    // An unscoped MIT file at the root is the defect this test exists for.
    expect(root).toMatch(/PROPRIETARY PARTS/);
    for (const mit of MIT_PACKAGES) {
      expect(root, `root LICENSE must name ${mit} as MIT`).toContain(mit);
    }
  });

  it('gives every workspace a LICENSE file', () => {
    // Without one, anyone browsing a directory on GitHub falls back to
    // assuming the root licence applies — which is how this went wrong.
    const missing = dirs.filter(
      (dir) => !existsSync(join(REPO_ROOT, dir, 'LICENSE')),
    );
    expect(missing).toEqual([]);
  });

  it('declares MIT only where the root LICENSE grants it', () => {
    for (const dir of dirs) {
      const { license } = manifest(dir);
      if (MIT_PACKAGES.includes(dir)) {
        expect(license, `${dir} should be MIT`).toBe('MIT');
      } else {
        expect(license, `${dir} must not claim MIT`).not.toBe('MIT');
      }
    }
  });

  it('keeps proprietary packages unpublishable', () => {
    for (const dir of dirs) {
      if (MIT_PACKAGES.includes(dir)) continue;
      const { private: isPrivate } = manifest(dir);
      // `private: true` is what stops an accidental `npm publish` from
      // distributing proprietary code under any licence at all.
      expect(isPrivate, `${dir} must be private`).toBe(true);
    }
  });

  it('ships the licence with every publishable package', () => {
    for (const dir of MIT_PACKAGES) {
      const text = readFileSync(join(REPO_ROOT, dir, 'LICENSE'), 'utf8');
      // The per-package copy must be the plain grant, not the root's scope
      // statement — a consumer extracting a tarball has no repository around it.
      expect(text, `${dir}: plain MIT text`).toMatch(/^MIT License/);
      expect(text).toMatch(/WITHOUT WARRANTY OF ANY KIND/);
    }
  });

  it('marks proprietary directories as such in their own LICENSE', () => {
    for (const dir of dirs) {
      if (MIT_PACKAGES.includes(dir)) continue;
      const text = readFileSync(join(REPO_ROOT, dir, 'LICENSE'), 'utf8');
      expect(text, `${dir}`).toMatch(/PROPRIETARY/);
      expect(text).toMatch(/ALL RIGHTS RESERVED/i);
    }
  });
});
