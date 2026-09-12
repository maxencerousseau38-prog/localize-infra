/**
 * The build identity of the running deployment.
 *
 * Deliberately a copy of `apps/web/src/lib/version/version.ts` rather than a
 * shared module. The two apps deploy independently — and this one is not even
 * connected to Git — so the only thing they share is a six-line contract over
 * two environment variables. Extracting it would put a workspace dependency in
 * this service's build command (`vercel.json` names each package it builds) to
 * save nothing, and would couple two deployment units that have no other
 * reason to move together. The contract is identical on purpose: a caller
 * should not have to remember which service shapes the answer differently.
 */
export interface Version {
  /** The commit this deployment was built from, or null when unknown. */
  commit: string | null;
  /** `production`, `preview`, `development`, or null off Vercel. */
  environment: string | null;
}

/**
 * Present means non-empty.
 *
 * Vercel sets the Git variables to an empty string on a project with no
 * repository connected. That is this project's actual situation — `apps/api`
 * deploys by CLI archive, not from Git — so `?? null` alone would report `''`
 * as a commit here rather than hypothetically. The same rule as
 * `LOCALIZE_API_URL` in packages/cli (#73).
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
