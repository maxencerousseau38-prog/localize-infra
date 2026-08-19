import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { App } from 'octokit';
import { readGitHubConfig } from './config';
import { resolveInstallation } from './resolve-installation';

export interface AvailableRepository {
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  private: boolean;
}

/**
 * The installation to act as for a given workspace.
 *
 * A workspace reaches its own repositories and nobody else's. There is no
 * fallback: see the body, and `resolve-installation.ts` for the rule and its
 * tests.
 *
 * The connection flow picks repositories from this installation's list rather
 * than accepting a typed owner/name. A free-text field would let a caller name
 * any repository on GitHub and get a confusing failure at push time — and,
 * worse, would make the set of reachable repositories a matter of what someone
 * guessed rather than what the installation was granted.
 */
export async function installationIdFor(
  organizationId: string | null,
): Promise<number | null> {
  /*
   * No fallback to the shared installation. This used to end with
   *
   *     return readGitHubConfig()?.installationId ?? null;
   *
   * so an organization that had never installed the App inherited the
   * deployment's own — a token reaching the operator's repositories, with
   * permission to open pull requests against them. It was survivable only
   * while every GitHub surface was gated to an operator allow-list, and
   * removing that gate is what self-serve means: the fallback and the feature
   * could not both ship. `resolveInstallation` states the rule and is tested.
   */
  if (!organizationId) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from('organization_github_installations')
    .select('installation_id')
    .eq('organization_id', organizationId)
    .maybeSingle();

  const resolved = resolveInstallation({
    kind: 'tenant',
    organizationInstallationId: data?.installation_id
      ? Number(data.installation_id)
      : null,
  });

  return resolved.ok ? resolved.installationId : null;
}

/**
 * The deployment's shared installation, for internal administration only.
 *
 * Separate function rather than a parameter, so that reaching the shared
 * installation is something a caller has to write down. Every call site is
 * expected to have checked `isOperator` first; this does not check it, because
 * a security decision made in two places is made in neither.
 */
export function operatorInstallationId(): number | null {
  const resolved = resolveInstallation({
    kind: 'operator',
    sharedInstallationId: readGitHubConfig()?.installationId ?? null,
  });
  return resolved.ok ? resolved.installationId : null;
}

export async function listInstallationRepositories(
  organizationId: string | null = null,
): Promise<AvailableRepository[]> {
  const config = readGitHubConfig();
  if (!config) return [];

  const installationId = await installationIdFor(organizationId);
  if (!installationId) return [];

  const app = new App({ appId: config.appId, privateKey: config.privateKey });
  const octokit = await app.getInstallationOctokit(installationId);

  // Paginated: an installation with more than 30 repositories would otherwise
  // silently show the first page and look like a complete list.
  const repositories = await octokit.paginate(
    'GET /installation/repositories',
    { per_page: 100 },
  );

  return repositories
    .map((repo) => ({
      owner: repo.owner?.login ?? '',
      name: repo.name,
      fullName: repo.full_name,
      defaultBranch: repo.default_branch ?? 'main',
      private: repo.private,
    }))
    .filter((repo) => repo.owner)
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}

/**
 * Whether the installation can reach a specific repository.
 *
 * Checked server-side before a pointer is stored, so a crafted form post
 * cannot record a repository the installation was never granted. The list
 * above is a convenience for the interface; this is the authorization.
 */
export async function canReachRepository(
  owner: string,
  name: string,
  organizationId: string | null = null,
): Promise<AvailableRepository | null> {
  const repositories = await listInstallationRepositories(organizationId);
  return (
    repositories.find(
      (repo) =>
        repo.owner.toLowerCase() === owner.toLowerCase() &&
        repo.name.toLowerCase() === name.toLowerCase(),
    ) ?? null
  );
}
