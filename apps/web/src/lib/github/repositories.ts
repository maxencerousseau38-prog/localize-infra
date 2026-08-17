import 'server-only';
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
export async function listInstallationRepositories(): Promise<
  AvailableRepository[]
> {
  const config = readGitHubConfig();
  if (!config) return [];

  const app = new App({ appId: config.appId, privateKey: config.privateKey });
  const octokit = await app.getInstallationOctokit(config.installationId);

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
): Promise<AvailableRepository | null> {
  const repositories = await listInstallationRepositories();
  return (
    repositories.find(
      (repo) =>
        repo.owner.toLowerCase() === owner.toLowerCase() &&
        repo.name.toLowerCase() === name.toLowerCase(),
    ) ?? null
  );
}
