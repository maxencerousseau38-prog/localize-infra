import { z } from 'zod';

// This service's only legitimate purpose is writing locale JSON files, so
// path validation is a positive allowlist rather than a denylist: every path
// segment must match a restrictive safe-character set, and the path must end
// in `.json`. This is stricter than (and subsumes) simply rejecting `..`/`.`
// segments, absolute POSIX paths, and absolute Windows paths (drive letters
// like `C:\` or `C:/`) — a pure traversal denylist still lets a caller steer
// the PR at arbitrary in-repo files like `.github/workflows/malicious.yml`,
// which don't traverse outside the repo but are still far outside the
// intended locale directory. The traversal-specific checks are kept below
// for defense-in-depth/clarity even though the segment allowlist and the
// `.json` suffix requirement already rule them out. Backslashes are rejected
// outright rather than treated as a separator: git tree paths are always
// forward-slash-separated regardless of OS, so no legitimate path needs one,
// and a backslash could otherwise be used to smuggle a traversal segment
// past the `/`-based split below (e.g. `locales\..\..\secret.json`).
const SAFE_PATH_SEGMENT = /^[A-Za-z0-9._-]+$/;

function isSafeRelativePath(path: string): boolean {
  if (path.length === 0 || path.trim().length === 0) return false;
  if (path.includes('\0')) return false;
  if (path.includes('\\')) return false;
  if (path.startsWith('/')) return false;
  if (/^[a-zA-Z]:/.test(path)) return false;
  if (!path.endsWith('.json')) return false;
  const segments = path.split('/');
  return segments.every(
    (segment) =>
      segment !== '.' && segment !== '..' && SAFE_PATH_SEGMENT.test(segment),
  );
}

export const OpenPrFileSchema = z.object({
  path: z.string().min(1).refine(isSafeRelativePath, {
    message:
      'path must be a relative, forward-slash-separated path ending in ".json", with every segment restricted to [A-Za-z0-9._-] and no "." or ".." segments, leading "/", or drive letter',
  }),
  content: z.string(),
});

// `owner`/`repo` flow directly into Octokit URL templates (e.g.
// `GET /repos/{owner}/{repo}`), so they're restricted to the character set
// GitHub actually allows in those slugs. `baseBranch` is a git ref name,
// which is otherwise fairly permissive (slashes are common, e.g.
// `release/1.0`), so it's only blocked from whitespace and null bytes rather
// than constrained to a narrow allowlist.
const OWNER_REPO_PATTERN = /^[A-Za-z0-9._-]+$/;
const NO_WHITESPACE_OR_NULL_PATTERN = /^[^\s\0]+$/;

export const OpenPrApiRequestSchema = z.object({
  owner: z.string().min(1).regex(OWNER_REPO_PATTERN),
  repo: z.string().min(1).regex(OWNER_REPO_PATTERN),
  baseBranch: z.string().min(1).regex(NO_WHITESPACE_OR_NULL_PATTERN),
  title: z.string().min(1),
  body: z.string(),
  files: z.array(OpenPrFileSchema).min(1),
});
export type OpenPrApiRequest = z.infer<typeof OpenPrApiRequestSchema>;

export const OpenPrApiResponseSchema = z.object({
  prUrl: z.string().url(),
  prNumber: z.number().int().positive(),
});
export type OpenPrApiResponse = z.infer<typeof OpenPrApiResponseSchema>;
