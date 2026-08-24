import 'server-only';
import { readGitHubApp } from '@/lib/github/config';
import { installationIdFor } from '@/lib/github/repositories';
import {
  type DetectedSignal,
  detectLocales,
  detectLocalizationSignals,
  looksLocalized,
} from '@localize-infra/closer-core';
export { companyDomain } from '@localize-infra/closer-core';
import { App } from 'octokit';

/**
 * Finding public repositories that localise, through GitHub's own API.
 *
 * Search is a candidate generator and nothing more. Asking GitHub for
 * repositories whose description mentions a localisation library returns
 * awesome-lists, tutorials and unrelated projects — verified against the real
 * API before this was written. What makes a candidate a prospect is the second
 * step: reading its tree and finding the files. The search is allowed to be
 * noisy because the filter is not.
 *
 * Only public repositories, only official endpoints, and only what an anonymous
 * visitor could read from a browser. Nothing here works around a rate limit, a
 * login or a robots rule.
 *
 * Budgets, because they are the difference between research and scraping:
 * search is capped at 30 requests a minute by GitHub and inspection at 5,000 an
 * hour, and one candidate costs two of the latter. `MAX_CANDIDATES` keeps a
 * single run far inside both.
 */

const MAX_CANDIDATES = 10;

/** Manifests worth opening for a dependency list. */
const MANIFEST = 'package.json';

export interface Candidate {
  fullName: string;
  owner: string;
  repo: string;
  description: string | null;
  homepage: string | null;
  stars: number;
  pushedAt: string | null;
  defaultBranch: string;
}

export interface Inspected extends Candidate {
  signals: DetectedSignal[];
  locales: string[];
  /** False when the tree carries no real localisation, whatever search thought. */
  qualifies: boolean;
}

async function installationOctokit(organizationId: string) {
  const app = readGitHubApp();
  if (!app) throw new Error('GitHub App is not configured on this deployment');

  const installationId = await installationIdFor(organizationId);
  if (!installationId)
    throw new Error('This workspace has no GitHub installation');

  return new App({
    appId: app.appId,
    privateKey: app.privateKey,
  }).getInstallationOctokit(installationId);
}

/**
 * Ask GitHub for candidates.
 *
 * `sort: updated` on purpose. A repository last touched in 2019 may still carry
 * every signal this looks for and is not a prospect — nobody is doing the work
 * that hurts. Recency is the cheapest proxy for "somebody is still shipping",
 * and it costs nothing here because the API sorts.
 */
export async function searchCandidates(
  organizationId: string,
  query: string,
  limit = MAX_CANDIDATES,
): Promise<Candidate[]> {
  const octokit = await installationOctokit(organizationId);

  const { data } = await octokit.request('GET /search/repositories', {
    q: query,
    per_page: Math.min(limit, MAX_CANDIDATES),
    sort: 'updated',
    order: 'desc',
  });

  return (data.items ?? []).map((item) => ({
    fullName: item.full_name,
    owner: item.owner?.login ?? item.full_name.split('/')[0] ?? '',
    repo: item.name,
    description: item.description ?? null,
    homepage: item.homepage || null,
    stars: item.stargazers_count ?? 0,
    pushedAt: item.pushed_at ?? null,
    defaultBranch: item.default_branch ?? 'main',
  }));
}

/**
 * Read one repository and decide whether it actually localises.
 *
 * Two requests: the whole tree in one recursive call, and the manifest if there
 * is one. Reading blobs per locale file would multiply the cost by the thing
 * being measured — a repository with forty locales would cost forty requests to
 * learn what one listing already said.
 */
export async function inspectRepository(
  organizationId: string,
  candidate: Candidate,
): Promise<Inspected> {
  const octokit = await installationOctokit(organizationId);

  let paths: string[] = [];
  try {
    const { data } = await octokit.request(
      'GET /repos/{owner}/{repo}/git/trees/{tree_sha}',
      {
        owner: candidate.owner,
        repo: candidate.repo,
        tree_sha: candidate.defaultBranch,
        recursive: '1',
      },
    );
    paths = (data.tree ?? [])
      .map((entry) => entry.path)
      .filter((p): p is string => typeof p === 'string');
  } catch {
    // An empty, moved or archived repository is an ordinary outcome of
    // searching, not a failure of the run. It qualifies as nothing and is
    // dropped by the caller.
    return { ...candidate, signals: [], locales: [], qualifies: false };
  }

  let dependencies: string[] = [];
  if (paths.includes(MANIFEST)) {
    try {
      const { data } = await octokit.request(
        'GET /repos/{owner}/{repo}/contents/{path}',
        { owner: candidate.owner, repo: candidate.repo, path: MANIFEST },
      );
      if (!Array.isArray(data) && 'content' in data && data.content) {
        const parsed = JSON.parse(
          Buffer.from(data.content, 'base64').toString('utf-8'),
        ) as {
          dependencies?: Record<string, string>;
          devDependencies?: Record<string, string>;
        };
        dependencies = [
          ...Object.keys(parsed.dependencies ?? {}),
          ...Object.keys(parsed.devDependencies ?? {}),
        ];
      }
    } catch {
      // A manifest that will not parse is one signal source missing, not a
      // reason to discard a tree that may carry every other one.
    }
  }

  const signals = detectLocalizationSignals({ paths, dependencies });

  return {
    ...candidate,
    signals,
    locales: detectLocales(paths),
    qualifies: looksLocalized(signals),
  };
}
