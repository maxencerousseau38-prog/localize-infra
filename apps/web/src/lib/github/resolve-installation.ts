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
 * touching GitHub was gated to an operator allow-list; the moment that gate
 * comes off — which is what self-serve *is* — every customer without their own
 * installation would have been handed a token reaching the operator's
 * repositories, with permission to open pull requests against them.
 *
 * So the customer path fails closed: no installation of your own, no GitHub.
 * The shared installation remains reachable, but only when a caller asks for it
 * explicitly and has been checked as an operator, which keeps the internal
 * administration path working without leaving it as the default.
 */

export type InstallationScope =
  /** A customer acting for their own workspace. Never the shared installation. */
  | { kind: 'tenant'; organizationInstallationId: number | null }
  /**
   * An operator using the deployment's shared installation on purpose.
   * `isOperator` must already have been checked by the caller; this type only
   * records that the decision was deliberate.
   */
  | { kind: 'operator'; sharedInstallationId: number | null };

export type InstallationResolution =
  | { ok: true; installationId: number; source: 'tenant' | 'shared' }
  | { ok: false; reason: 'no-installation' | 'not-configured' };

export function resolveInstallation(
  scope: InstallationScope,
): InstallationResolution {
  if (scope.kind === 'tenant') {
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
    // Deliberately not falling through to the shared installation. A workspace
    // that has not installed the App has no GitHub access, and saying so is the
    // only answer that is true for every tenant.
    return { ok: false, reason: 'no-installation' };
  }

  if (scope.sharedInstallationId && scope.sharedInstallationId > 0) {
    return {
      ok: true,
      installationId: scope.sharedInstallationId,
      source: 'shared',
    };
  }
  return { ok: false, reason: 'not-configured' };
}
