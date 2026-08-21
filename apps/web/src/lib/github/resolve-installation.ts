/**
 * Which installation a request may act as.
 *
 * Pure, and separate from the database, because this is the decision that
 * keeps one customer out of another's repositories — and it was previously a
 * fallback expression buried in a query helper, reachable only through
 * Supabase and Octokit, with no test.
 *
 * The rule it replaces read:
 *
 *     if (organizationId) { ...look up per-org installation... }
 *     return readGitHubConfig()?.installationId ?? null;
 *
 * An organization with no installation of its own silently inherited the
 * deployment's shared one. That was survivable only because every surface
 * touching GitHub was said to be gated to an operator allow-list; the moment
 * that gate comes off — which is what self-serve *is* — every customer without
 * their own installation would have been handed a token reaching the operator's
 * repositories, with permission to open pull requests against them.
 *
 * The first fix kept an `operator` scope beside the tenant one, so the shared
 * installation stayed reachable when a caller asked for it by name and had been
 * checked against the allow-list. Neither half of that was true: the allow-list
 * (`isOperator`) had no call sites, and neither did the function that read this
 * scope (`operatorInstallationId`). A described-but-unenforced control is worse
 * than none, because it is believed.
 *
 * So the scope is now tenant-only. The shared installation is not something
 * this module can express, which makes the isolation a property of the type
 * rather than of a rule a future caller has to remember. Acting as some other
 * workspace's installation is not a case that fails closed here — it is a case
 * that cannot be written.
 */

export type InstallationScope = {
  kind: 'tenant';
  organizationInstallationId: number | null;
};

export type InstallationResolution =
  | { ok: true; installationId: number; source: 'tenant' }
  | { ok: false; reason: 'no-installation' };

export function resolveInstallation(
  scope: InstallationScope,
): InstallationResolution {
  if (
    scope.organizationInstallationId &&
    scope.organizationInstallationId > 0
  ) {
    return {
      ok: true,
      installationId: scope.organizationInstallationId,
      source: 'tenant',
    };
  }

  // A workspace that has not installed the App has no GitHub access, and
  // saying so is the only answer that is true for every tenant.
  return { ok: false, reason: 'no-installation' };
}
