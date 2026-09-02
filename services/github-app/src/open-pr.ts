import type { Octokit } from 'octokit';

export interface OpenPrRequest {
  owner: string;
  repo: string;
  baseBranch: string;
  headBranch: string;
  title: string;
  body: string;
  files: { path: string; content: string }[];
}

/**
 * What opening a pull request produced.
 *
 * Discriminated rather than nullable, because "opened" and "there was nothing
 * to open" are two outcomes and not one outcome with a missing field. A caller
 * that forgets the second gets a type error instead of `undefined` where a URL
 * was expected.
 */
export type OpenPrResult =
  | { opened: true; prUrl: string; prNumber: number }
  | { opened: false; reason: 'no_changes' };

export async function openTranslationPr(
  octokit: Octokit,
  request: OpenPrRequest,
): Promise<OpenPrResult> {
  const { owner, repo, baseBranch, headBranch, title, body, files } = request;

  const baseRef = await octokit.rest.git.getRef({
    owner,
    repo,
    ref: `heads/${baseBranch}`,
  });
  const baseSha = baseRef.data.object.sha;

  // The tree the base commit already points at. Compared against the one built
  // below, this is Git's own answer to "does this request change anything".
  const baseCommit = await octokit.rest.git.getCommit({
    owner,
    repo,
    commit_sha: baseSha,
  });
  const baseTreeSha = baseCommit.data.tree.sha;

  const blobs = await Promise.all(
    files.map(async (file) => {
      const blob = await octokit.rest.git.createBlob({
        owner,
        repo,
        content: file.content,
        encoding: 'utf-8',
      });
      return { path: file.path, sha: blob.data.sha };
    }),
  );

  const tree = await octokit.rest.git.createTree({
    owner,
    repo,
    base_tree: baseSha,
    tree: blobs.map((blob) => ({
      path: blob.path,
      mode: '100644' as const,
      type: 'blob' as const,
      sha: blob.sha,
    })),
  });

  /*
   * Nothing to open, so nothing is opened.
   *
   * `createTree` with `base_tree` returns the base tree's own sha when every
   * blob it is handed already exists at that path with that content — Git
   * deduplicates by content. The commit built on such a tree is empty, and
   * GitHub opens a pull request with zero changed files. Five appeared on the
   * fixture repository in two days before this check existed.
   *
   * Checked here rather than in a caller because only this layer knows what the
   * base branch holds. `apps/web` materialises a checkout of it and can compare
   * content itself, and does; `packages/cli` runs against a working directory
   * that may already differ from the remote, so its own comparison would answer
   * a different question.
   *
   * Before `createRef`, which is why the branch creation moved down. Learning
   * there is nothing to commit after creating the ref would leave a branch
   * behind for every no-op run — trading empty pull requests for orphan
   * branches.
   */
  if (tree.data.sha === baseTreeSha) {
    return { opened: false, reason: 'no_changes' };
  }

  await octokit.rest.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${headBranch}`,
    sha: baseSha,
  });

  const commit = await octokit.rest.git.createCommit({
    owner,
    repo,
    message: title,
    tree: tree.data.sha,
    parents: [baseSha],
  });

  await octokit.rest.git.updateRef({
    owner,
    repo,
    ref: `heads/${headBranch}`,
    sha: commit.data.sha,
  });

  const pr = await octokit.rest.pulls.create({
    owner,
    repo,
    title,
    body,
    head: headBranch,
    base: baseBranch,
  });

  return {
    opened: true,
    prUrl: pr.data.html_url,
    prNumber: pr.data.number,
  };
}
