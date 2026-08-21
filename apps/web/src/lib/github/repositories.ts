import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { App } from 'octokit';
import { readGitHubApp } from './config';
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

/*
 * `operatorInstallationId` was here, and it is gone.
 *
 * It was the only way to reach the deployment's shared installation, kept as a
 * named function so that using it had to be written down, and guarded — on
 * paper — by an `isOperator` allow-list that every call site was said to check
 * first. It had no call sites. Neither did `isOperator`.
 *
 * Deleting it is not a behaviour change; nothing called it. It removes a
 * described-but-absent security control, and it lets `InstallationScope` stop
 * being able to express "act as the shared installation" at all — so the
 * isolation is a property of the type rather than of a rule someone remembered
 * to follow.
 */
export async function listInstallationRepositories(
  organizationId: string | null = null,
): Promise<AvailableRepository[]> {
  const config = readGitHubApp();
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
