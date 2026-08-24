import 'server-only';
import { readGitHubApp } from '@/lib/github/config';
import { installationIdFor } from '@/lib/github/repositories';
import {
  type CommitRecord,
  type PainEvidence,
  type ScoreComponent,
  detectPain,
  painScore,
} from '@localize-infra/closer-core';
import { App } from 'octokit';

/**
 * Reading a repository's history for evidence that localisation costs time.
 *
 * Discovery answers "do they localise". This answers "is anybody still doing
 * it, and does it look like work" — the distinction the brief's section 7 is
 * built on, and the one that separates a prospect from a repository that merely
 * contains locale files.
 *
 * Three or four requests per company: the tree once to find where translations
 * live, the commit list once for the denominator, and one commit list per
 * localisation directory. Cheap enough to run on demand and far inside the
 * 5,000-an-hour budget the installation token carries.
 */

const WINDOW_DAYS = 90;
const MAX_COMMITS = 100;

/** Directory names worth asking GitHub about, in the order they are usual. */
const LOCALE_DIRS = [
  'locales',
  'locale',
  'i18n',
  'messages',
  'translations',
  'lang',
];

export interface ResearchResult {
  windowDays: number;
  commitsInWindow: number;
  localeCommits: CommitRecord[];
  pain: PainEvidence[];
  painValue: number;
  painConfidence: number;
  /**
   * The arithmetic behind `painValue`, as `closer_record_score` requires it.
   *
   * Returned rather than re-derived by the caller: that function refuses a
   * breakdown that does not sum to the value claimed, and two pieces of code
   * computing the same cap from the same severities is a divergence waiting to
   * be discovered by a rejected write.
   */
  painBreakdown: ScoreComponent[];
  /** The paths actually queried, so a null result can be told from a missing one. */
  searchedPaths: string[];
}

async function octokitFor(organizationId: string) {
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

function toRecords(
  commits: {
    commit?: { message?: string; author?: { date?: string } | null };
  }[],
): CommitRecord[] {
  return commits
    .map((entry) => ({
      date: entry.commit?.author?.date ?? '',
      message: (entry.commit?.message ?? '').split('\n')[0] ?? '',
    }))
    .filter((record) => record.date !== '');
}

export async function researchRepository(
  organizationId: string,
  fullName: string,
  defaultBranch = 'main',
): Promise<ResearchResult> {
  const [owner, repo] = fullName.split('/');
  if (!owner || !repo) throw new Error(`Not a repository name: ${fullName}`);

  const octokit = await octokitFor(organizationId);
  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();

  /*
   * Which localisation directories exist, asked once.
   *
   * Querying commits for a path that is not there is a wasted request per
   * directory per company, and GitHub answers it with an empty list rather than
   * an error — so without this the result would be indistinguishable from
   * "nobody has touched translations", which is the conclusion this is trying
   * to reach honestly.
   */
  let presentDirs: string[] = [];
  try {
    const { data } = await octokit.request(
      'GET /repos/{owner}/{repo}/git/trees/{tree_sha}',
      { owner, repo, tree_sha: defaultBranch, recursive: '1' },
    );

    /*
     * The real paths, at whatever depth they sit.
     *
     * The first version looked only at the first two segments, which found
     * nothing in `amannn/next-intl` — a repository discovery had already found
     * five locales in, because its translations live under
     * `examples/<app>/messages`. Pain detection was therefore blind on exactly
     * the repositories discovery is good at finding, and it failed silently:
     * asking GitHub for commits on a path that does not exist returns an empty
     * list, which is indistinguishable from "nobody touched translations".
     *
     * Shallowest first, because a monorepo with twenty example apps would
     * otherwise spend the whole budget on examples.
     */
    const roots = new Map<string, number>();
    for (const entry of data.tree ?? []) {
      const path = entry.path;
      if (typeof path !== 'string') continue;
      const parts = path.split('/');
      const index = parts.findIndex((part) =>
        LOCALE_DIRS.includes(part.toLowerCase()),
      );
      if (index === -1) continue;
      const root = parts.slice(0, index + 1).join('/');
      roots.set(root, (roots.get(root) ?? 0) + 1);
    }

    presentDirs = [...roots.entries()]
      .sort(
        (a, b) =>
          a[0].split('/').length - b[0].split('/').length || b[1] - a[1],
      )
      .slice(0, 3)
      .map(([root]) => root);
  } catch {
    presentDirs = [];
  }

  let all: CommitRecord[] = [];
  try {
    const { data } = await octokit.request(
      'GET /repos/{owner}/{repo}/commits',
      { owner, repo, since, per_page: MAX_COMMITS },
    );
    all = toRecords(data);
  } catch {
    // An empty or moved repository yields nothing to research. Reported as zero
    // activity rather than as a failure, because zero activity is a finding.
    all = [];
  }

  const localeCommits: CommitRecord[] = [];
  const searchedPaths: string[] = [];
  for (const dir of presentDirs) {
    searchedPaths.push(dir);
    try {
      const { data } = await octokit.request(
        'GET /repos/{owner}/{repo}/commits',
        { owner, repo, path: dir, since, per_page: MAX_COMMITS },
      );
      localeCommits.push(...toRecords(data));
    } catch {
      // One unreadable path does not invalidate the others.
    }
  }

  // The same commit can touch two localisation directories; counting it twice
  // would inflate every frequency this feeds.
  const deduped = [
    ...new Map(
      localeCommits.map((c) => [`${c.date}:${c.message}`, c]),
    ).values(),
  ].sort((a, b) => (a.date < b.date ? 1 : -1));

  const pain = detectPain({
    localeCommits: deduped,
    allCommits: all,
    windowDays: WINDOW_DAYS,
    lastPushedAt: all[0]?.date ?? null,
  });
  const score = painScore(pain);

  return {
    windowDays: WINDOW_DAYS,
    commitsInWindow: all.length,
    localeCommits: deduped,
    pain,
    painValue: score.value,
    painConfidence: score.confidence,
    painBreakdown: score.breakdown,
    searchedPaths,
  };
}
