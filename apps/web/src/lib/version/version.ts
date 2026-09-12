/**
 * The build identity of the running deployment.
 *
 * Vercel exposes `VERCEL_GIT_COMMIT_SHA` and `VERCEL_ENV` to the function
 * runtime as System Environment Variables. Reading them at request time rather
 * than baking them in at build time is deliberate: a value baked into a bundle
 * proves what the bundle was built from, which is the same question one step
 * removed. Read at runtime, the answer comes from the deployment that is
 * actually serving.
 */
export interface Version {
  /** The commit this deployment was built from, or null off Vercel. */
  commit: string | null;
  /** `production`, `preview`, `development`, or null off Vercel. */
  environment: string | null;
}

/**
 * Present means non-empty.
 *
 * Vercel sets the Git variables to an empty string on a project with no
 * repository connected, so `?? null` alone would report `''` as a commit —
 * a value that is falsy in a template and truthy in `JSON.stringify`. The same
 * rule as `LOCALIZE_API_URL` in packages/cli (#73).
 */
function present(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function readVersion(): Version {
  return {
    commit: present(process.env.VERCEL_GIT_COMMIT_SHA),
    environment: present(process.env.VERCEL_ENV),
  };
}
