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

export interface OpenPrResult {
  prUrl: string;
  prNumber: number;
}

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

  await octokit.rest.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${headBranch}`,
    sha: baseSha,
  });

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

  return { prUrl: pr.data.html_url, prNumber: pr.data.number };
}
