import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { USAGE, parseTopLevel, readVersion } from './meta.js';

describe('parseTopLevel', () => {
  /*
   * `--help` and `--version` used to fall through to the unknown-command
   * branch, which printed "Unknown command: --version" and exited 1. They are
   * the first two things anyone types at a command they have just installed,
   * and the second is what a bug report is asked for — with 0.1.0 already on
   * npm and 0.2.0 following it, there was no way to tell them apart from
   * inside a shell.
   */
  it('recognises --help and -h', () => {
    expect(parseTopLevel(['--help'])).toEqual({ kind: 'help' });
    expect(parseTopLevel(['-h'])).toEqual({ kind: 'help' });
  });

  it('recognises --version and -v', () => {
    expect(parseTopLevel(['--version'])).toEqual({ kind: 'version' });
    expect(parseTopLevel(['-v'])).toEqual({ kind: 'version' });
  });

  it('recognises init', () => {
    expect(parseTopLevel(['init'])).toEqual({ kind: 'init' });
    expect(parseTopLevel(['init', 'some/dir', '--force'])).toEqual({
      kind: 'init',
    });
  });

  /*
   * Anywhere, not only first. `localize-infra init --help` is a reasonable
   * thing to type, and answering it with a run that costs money to find out
   * would be the wrong reading of the request.
   */
  it('answers help even when it follows a command', () => {
    expect(parseTopLevel(['init', '--help'])).toEqual({ kind: 'help' });
    expect(parseTopLevel(['init', 'dir', '--version'])).toEqual({
      kind: 'version',
    });
  });

  it('reports an unknown command, and no command at all', () => {
    expect(parseTopLevel(['bogus'])).toEqual({
      kind: 'unknown',
      command: 'bogus',
    });
    expect(parseTopLevel([])).toEqual({ kind: 'unknown', command: undefined });
  });

  /*
   * Help wins over version when both are given: it is the more general
   * request, and printing one of the two silently is worse than a rule stated
   * here. This is a decision, not an accident of ordering.
   */
  it('prefers help when both are asked for', () => {
    expect(parseTopLevel(['--version', '--help'])).toEqual({ kind: 'help' });
  });
});

describe('readVersion', () => {
  /*
   * Read from the manifest rather than baked in at build time, so the number a
   * user is told can never disagree with the one npm installed.
   *
   * The path works from both `src/` and `dist/` because both sit one level
   * under the package root — a coincidence worth an assertion rather than a
   * comment, since a future `dist/cli/` would break it silently.
   */
  it('reports the version the manifest carries', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const manifest = JSON.parse(
      readFileSync(join(here, '..', 'package.json'), 'utf8'),
    ) as { version: string };

    expect(readVersion()).toBe(manifest.version);
  });

  it('reports something that looks like a version', () => {
    expect(readVersion()).toMatch(/^\d+\.\d+\.\d+/);
  });
});

describe('USAGE', () => {
  it('names every flag the parser consumes', () => {
    for (const flag of [
      '--force',
      '--api-url',
      '--api-token',
      '--locales',
      '--open-pr',
      '--owner',
      '--repo',
      '--base-branch',
      '--help',
      '--version',
    ]) {
      expect(USAGE).toContain(flag);
    }
  });

  /*
   * The token warning is not decoration. `--api-token` puts a credential into
   * shell history and into `ps` output, and the usage text is where somebody
   * decides which of the two to use.
   */
  it('keeps steering people away from --api-token', () => {
    expect(USAGE).toContain('LOCALIZE_API_TOKEN');
    expect(USAGE).toMatch(/shell history/);
  });
});
