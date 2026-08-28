import { describe, expect, it } from 'vitest';
import {
  InvalidRootDir,
  normaliseRootDir,
  repoRelativePath,
} from './root-dir.js';

/**
 * A subdirectory is a path a customer types, and it reaches two dangerous
 * places: `join()` against a checkout, and file paths committed to their
 * repository. Most of what follows is about what must be refused.
 */

describe('normaliseRootDir', () => {
  it('reads an empty value as the repository root', () => {
    expect(normaliseRootDir(null)).toBeNull();
    expect(normaliseRootDir(undefined)).toBeNull();
    expect(normaliseRootDir('')).toBeNull();
    expect(normaliseRootDir('   ')).toBeNull();
    expect(normaliseRootDir('/')).toBeNull();
  });

  it('accepts an ordinary path', () => {
    expect(normaliseRootDir('apps/web')).toBe('apps/web');
  });

  /*
   * One location, one spelling. Otherwise the same directory connected twice
   * looks like two projects and the stamped `locales_dir` disagrees with itself
   * between runs.
   */
  it.each([
    ['/apps/web', 'apps/web'],
    ['apps/web/', 'apps/web'],
    ['  apps/web  ', 'apps/web'],
    ['apps\\web', 'apps/web'],
  ])('normalises %j to %j', (input, expected) => {
    expect(normaliseRootDir(input)).toBe(expected);
  });

  describe('refuses what would escape', () => {
    /*
     * The reason this function exists. `..` escapes the checkout when reading
     * and escapes the repository when writing.
     */
    it.each(['../etc', 'apps/../../etc', 'a/../../b', '..'])(
      'refuses %j',
      (input) => {
        expect(() => normaliseRootDir(input)).toThrow(InvalidRootDir);
      },
    );

    it.each(['C:\\Windows', '\\\\server\\share', '//server/share'])(
      'refuses the absolute path %j',
      (input) => {
        expect(() => normaliseRootDir(input)).toThrow(/absolute/);
      },
    );

    /*
     * A single leading slash is *not* absolute here. Inside a repository
     * `/etc/passwd` names a directory called `etc`, which escapes nothing — the
     * safety property is "cannot leave the repository", and only `..`, a drive
     * letter and a UNC share can do that. An earlier version of this test
     * refused it, which would have rejected the most natural way to type the
     * value for no gain at all.
     */
    it('treats a leading slash as "from the repository root"', () => {
      expect(normaliseRootDir('/etc/passwd')).toBe('etc/passwd');
    });

    /*
     * A NUL truncates a path at the syscall boundary, so the string that was
     * checked and the path that gets opened are different strings.
     */
    it('refuses a null byte', () => {
      expect(() => normaliseRootDir('apps\0/web')).toThrow(/null byte/);
    });

    it('refuses a "." segment rather than quietly dropping it', () => {
      expect(() => normaliseRootDir('apps/./web')).toThrow(InvalidRootDir);
    });

    it('refuses a doubled slash, which is the same ambiguity', () => {
      expect(() => normaliseRootDir('apps//web')).toThrow(InvalidRootDir);
    });

    it('refuses something absurdly long', () => {
      expect(() => normaliseRootDir('a/'.repeat(200))).toThrow(/too long/);
    });
  });

  it('explains itself, because a person typed the value', () => {
    expect(() => normaliseRootDir('../x')).toThrow(/outside the repository/);
  });
});

describe('repoRelativePath', () => {
  /*
   * The distinction the whole feature turns on: reading happens inside a
   * checkout, writing happens against the repository. Committing a checkout
   * path would add a tree named after a temporary directory instead of updating
   * the one that exists.
   */
  it('joins the subdirectory to the path being committed', () => {
    expect(repoRelativePath('apps/web', 'locales', 'fr.json')).toBe(
      'apps/web/locales/fr.json',
    );
  });

  it('leaves a root-level project alone', () => {
    expect(repoRelativePath(null, 'locales', 'fr.json')).toBe(
      'locales/fr.json',
    );
  });

  it('never produces a leading slash, which would read as absolute', () => {
    expect(repoRelativePath('/apps/web/', '/locales/')).toBe(
      'apps/web/locales',
    );
  });

  it('drops empty parts rather than emitting a doubled slash', () => {
    expect(repoRelativePath('apps/web', '', 'fr.json')).toBe(
      'apps/web/fr.json',
    );
  });

  it('normalises backslashes, so a Windows-shaped value still commits correctly', () => {
    expect(repoRelativePath('apps\\web', 'locales')).toBe('apps/web/locales');
  });
});
