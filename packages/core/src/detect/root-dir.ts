/**
 * Where inside a repository a project actually lives.
 *
 * `detectFramework` and `extractFromProject` have always run at the root of the
 * checkout, which works for a repository that is one application and fails for
 * every monorepo. It fails *correctly* — "No supported framework detected" — but
 * that is a wall with no door, and the shape it describes is extremely common.
 * This repository is itself one: its two Next applications sit two levels down,
 * and a run against it detects nothing.
 *
 * A subdirectory is a path a customer types, and it ends up in `join()` calls
 * against a checkout and in file paths committed to their repository. Both are
 * places where `../../` is a real problem, so the value is normalised once, here,
 * and everything downstream takes the result rather than the input.
 */

/** Why a subdirectory was refused, in words for the person who typed it. */
export class InvalidRootDir extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidRootDir';
  }
}

/**
 * Normalise a subdirectory, or throw.
 *
 * Returns `null` for "the repository root", which is what an empty value means
 * and what every project has today. Slashes are normalised to POSIX and the
 * surrounding ones trimmed, so `/apps/web/` and `apps\web` and `apps/web` are
 * one project rather than three.
 *
 * Refused, each for a reason that matters rather than for tidiness:
 *
 *   - `..` in any segment — it escapes the checkout on read and escapes the
 *     repository on write. This is the whole reason the function exists.
 *   - an absolute path, POSIX or Windows — `join(workdir, '/etc')` is `/etc`.
 *   - a NUL byte — it truncates a path at the syscall boundary, so the string
 *     checked and the path opened are different strings.
 *   - `.` as a segment — harmless but it makes two spellings of one location.
 */
export function normaliseRootDir(
  input: string | null | undefined,
): string | null {
  if (input === null || input === undefined) return null;

  const unified = input.replace(/\\/g, '/').trim();
  const trimmed = unified.replace(/^\/+/, '').replace(/\/+$/, '');
  if (trimmed === '') return null;

  if (input.includes('\0')) {
    throw new InvalidRootDir('A path cannot contain a null byte.');
  }

  // would otherwise read as relative.
  //
  // A *single* leading slash is not refused: it is how people write "from the
  // repository root", the convention `.gitignore` uses and the one GitHub's own
  // file URLs read as, and it is stripped above. Refusing it would reject the
  // most natural way to type the value. A drive letter and a UNC share are
  // genuinely absolute and stay refused.
  if (/^[A-Za-z]:/.test(input.trim()) || /^(\/\/|\\\\)/.test(input.trim())) {
    throw new InvalidRootDir(
      'Use a path relative to the repository root, not an absolute one.',
    );
  }

  const segments = trimmed.split('/');
  for (const segment of segments) {
    if (segment === '..') {
      throw new InvalidRootDir(
        'A subdirectory cannot contain "..": it would point outside the repository.',
      );
    }
    if (segment === '.' || segment === '') {
      throw new InvalidRootDir(
        `"${trimmed}" has an empty or "." segment. Write it as a plain path, like apps/web.`,
      );
    }
  }

  if (trimmed.length > 200) {
    throw new InvalidRootDir('That path is too long to be a subdirectory.');
  }

  return segments.join('/');
}

/**
 * A path inside the repository, for committing.
 *
 * The distinction this exists to keep: reading happens inside a checkout, at
 * `<workdir>/<rootDir>/<localesDir>`, while **writing happens against the
 * repository**, at `<rootDir>/<localesDir>`. Committing the first would put the
 * files under a temporary directory name, and the pull request would add a tree
 * nobody asked for instead of updating the one that exists.
 */
export function repoRelativePath(
  rootDir: string | null,
  ...rest: string[]
): string {
  return [rootDir, ...rest]
    .filter((part): part is string => Boolean(part))
    .map((part) => part.replace(/\\/g, '/').replace(/^\/+|\/+$/g, ''))
    .filter((part) => part !== '')
    .join('/');
}
