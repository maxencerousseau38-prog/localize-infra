import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { App } from 'octokit';
import { readGitHubConfig } from './config';

export interface AvailableRepository {
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  private: boolean;
}

/**
 * Repositories the shared installation can actually reach.
 *
 * The connection flow picks from this list rather than accepting a typed
 * owner/name. A free-text field would let a caller name any repository on
 * GitHub and get a confusing failure at push time — and, worse, would make the
 * set of reachable repositories a matter of what someone guessed rather than
 * what the installation was granted.
 */
/**
 * The installation to act as for a given workspace.
 *
 * A workspace that has installed the App itself gets its own installation, and
 * therefore reaches its own repositories and nobody else's. Falling back to the
 * shared environment installation is what the operator path uses, and is the
 * reason that path is gated: the shared token reaches whatever it was ever
 * granted, regardless of who is asking.
 */
export async function installationIdFor(
  organizationId: string | null,
): Promise<number | null> {
  if (organizationId) {
    const supabase = await createClient();
    const { data } = await supabase
      .from('organization_github_installations')
      .select('installation_id')
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (data?.installation_id) return Number(data.installation_id);
  }

  return readGitHubConfig()?.installationId ?? null;
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
