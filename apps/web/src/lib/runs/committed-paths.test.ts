import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { repoRelativePath } from '@localize-infra/core';
import { describe, expect, it } from 'vitest';

/**
 * Reading and writing use two different roots, and nothing else can check it.
 *
 * A run holds a checkout in a temporary directory and reads at
 * `<workdir>/<rootDir>/<localesDir>`. What it *commits* is relative to the
 * customer's repository: `<rootDir>/<localesDir>`. Both are strings, both are
 * built from the same two parts, and using the wrong one produces a pull
 * request that adds a whole tree named after a temp directory beside the real
 * one — wrong in a way that looks right, which is the failure mode the
 * `locales_dir` stamp was already introduced to stop once.
 *
 * A type cannot separate them: they are both `string`. A unit test cannot reach
 * them either, since both live inside server actions that need Supabase, GitHub
 * and a network. So this reads the source.
 *
 * That is a blunt instrument, and it is chosen deliberately over nothing. This
 * repository has shipped the same defect four times — a comment asserting a
 * check that does not exist — and the two pull-request builders here carry a
 * comment saying they "have drifted twice". A grep that fails loudly when
 * somebody reintroduces `workdir` on the detection path is worth more than a
 * paragraph asking them not to.
 */

/*
 * Anchored on this file, not on `process.cwd()`. The gates run vitest from the
 * repository root with `--root apps/web`, which moves the config root and
 * leaves the working directory where it was — so a cwd-relative path resolved
 * two levels too high and every read here failed with ENOENT.
 */
const ACTIONS = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'app',
  '[org]',
  'projects',
  '[project]',
);

const read = (file: string) => readFileSync(join(ACTIONS, file), 'utf8');

describe('the run and scan pipelines separate the two roots', () => {
  for (const file of ['run-actions.ts', 'scan-actions.ts']) {
    describe(file, () => {
      /*
       * Detection and extraction must run at the project, not at the checkout
       * root. Passing `workdir` is what made every monorepo report "No
       * supported framework detected".
       */
      it('detects and extracts at the project directory, not the checkout root', () => {
        const source = read(file);
        expect(source).not.toContain('detectFramework(workdir)');
        expect(source).not.toContain('extractFromProject(workdir');
        expect(source).toContain('detectFramework(projectDir)');
      });

      it('joins the locales directory onto the project directory', () => {
        const source = read(file);
        expect(source).not.toContain('join(workdir, detected.localesDir)');
      });
    });
  }

  /*
   * The write half, which only run-actions.ts performs. `detected.localesDir`
   * is relative to the project; interpolating it straight into a committed path
   * silently drops the subdirectory, and the pull request lands the files one
   * level too high.
   */
  it('run-actions builds every committed path from the repository root', () => {
    const source = read('run-actions.ts');
    expect(source).not.toContain('`${detected.localesDir}/');
    expect(source).toContain('repoRelativePath(rootDir, detected.localesDir)');
    // The stamp the approval path reads back must be the same string as the
    // paths committed here, or an approved run writes somewhere else entirely.
    expect(source).toContain('p_locales_dir: committedLocalesDir');
    expect(source).toContain('path: `${committedLocalesDir}/');
  });
});

describe('what the two roots actually produce', () => {
  /*
   * The arithmetic the guard above protects, stated once so a reader does not
   * have to reconstruct it from greps.
   */
  it('a monorepo project commits inside its subdirectory', () => {
    expect(repoRelativePath('apps/web', 'locales', 'fr.json')).toBe(
      'apps/web/locales/fr.json',
    );
  });

  it('a root-level project is untouched, so existing runs keep working', () => {
    expect(repoRelativePath(null, 'locales', 'fr.json')).toBe(
      'locales/fr.json',
    );
  });
});
