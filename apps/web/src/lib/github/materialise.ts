import 'server-only';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, sep } from 'node:path';
import { App } from 'octokit';
import { readGitHubConfig } from './config';

/**
 * Copies a repository into a temporary directory so packages/core can read it.
 *
 * `packages/core` walks a filesystem — it detects a framework by looking for a
 * config file and extracts strings by parsing source with ts-morph. Rewriting
 * it to read from an API would fork the one piece of this product that is
 * already proven, so the repository is brought to it instead.
 *
 * The tree is fetched recursively in one request and only source-shaped files
 * are downloaded. A repository with a large binary in it would otherwise cost
 * a blob request per file and a great deal of memory for data no parser reads.
 */
export interface Materialised {
  dir: string;
  fileCount: number;
  truncated: boolean;
}

/** Extensions the extractor can do something with, plus the config files detection needs. */
const WANTED = /\.(tsx?|jsx?|json|mjs|cjs)$/i;

/** Directories that never contain source worth parsing. */
const SKIP =
  /(^|\/)(node_modules|\.git|\.next|dist|build|coverage|\.turbo)(\/|$)/;

/** A blob larger than this is not hand-written source. */
const MAX_BLOB_BYTES = 512 * 1024;

export async function materialiseRepository(
  owner: string,
  repo: string,
  ref: string,
): Promise<Materialised> {
  const config = readGitHubConfig();
  if (!config) throw new Error('No GitHub App configured');

  const app = new App({ appId: config.appId, privateKey: config.privateKey });
  const octokit = await app.getInstallationOctokit(config.installationId);

  const { data: tree } = await octokit.request(
    'GET /repos/{owner}/{repo}/git/trees/{tree_sha}',
    { owner, repo, tree_sha: ref, recursive: '1' },
  );

  const wanted = (tree.tree ?? []).filter(
    (entry) =>
      entry.type === 'blob' &&
      typeof entry.path === 'string' &&
      WANTED.test(entry.path) &&
      !SKIP.test(entry.path) &&
      (entry.size ?? 0) <= MAX_BLOB_BYTES,
  );

  const dir = await mkdtemp(join(tmpdir(), 'localize-run-'));

  // Sequential rather than parallel: the installation token is rate-limited per
  // hour, and a burst of a hundred blob requests is the fastest way to spend
  // that budget on a repository nobody is waiting on.
  let written = 0;
  for (const entry of wanted) {
    if (!entry.path || !entry.sha) continue;

    const { data: blob } = await octokit.request(
      'GET /repos/{owner}/{repo}/git/blobs/{file_sha}',
      { owner, repo, file_sha: entry.sha },
    );

    const contents = Buffer.from(blob.content, 'base64');
    // Normalise the separator so a POSIX path from the API is written correctly
    // on Windows, where this is developed.
    const target = join(dir, entry.path.split('/').join(sep));
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, contents);
    written += 1;
  }

  return {
    dir,
    fileCount: written,
    // GitHub truncates very large trees. Saying so beats silently extracting
    // from half a repository and reporting a confident key count.
    truncated: Boolean(tree.truncated),
  };
}
