import { z } from 'zod';

// Reject `..`/`.` path segments, absolute POSIX paths, and absolute Windows
// paths (drive letters like `C:\` or `C:/`) so a malicious or buggy caller
// can't steer this path outside the intended locale-file directory in the
// target repo's tree (e.g. `../../.github/workflows/malicious.yml` or
// `/etc/passwd`). Backslashes are rejected outright rather than treated as a
// separator: git tree paths are always forward-slash-separated regardless of
// OS, so no legitimate path needs one, and a backslash could otherwise be
// used to smuggle a traversal segment past the `/`-based split below (e.g.
// `locales\..\..\secret.json`).
function isSafeRelativePath(path: string): boolean {
  if (path.length === 0 || path.trim().length === 0) return false;
  if (path.includes('\0')) return false;
  if (path.includes('\\')) return false;
  if (path.split('/').some((segment) => segment === '..' || segment === '.'))
    return false;
  if (path.startsWith('/')) return false;
  if (/^[a-zA-Z]:/.test(path)) return false;
  return true;
}

export const OpenPrFileSchema = z.object({
  path: z.string().min(1).refine(isSafeRelativePath, {
    message:
      'path must be a relative, forward-slash-separated path with no ".." segments and no leading "/" or drive letter',
  }),
  content: z.string(),
});

export const OpenPrApiRequestSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  baseBranch: z.string().min(1),
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
