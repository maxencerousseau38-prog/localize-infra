import type { Octokit } from 'octokit';

/**
 * Can this installation open a pull request against `owner/repo` on
 * `baseBranch`? Answered with reads only — the installation's repository
 * list, then the branch — and no writes.
 *
 * It exists so a caller can find out **before** paying for translation. The
 * CLI used to translate every locale, then learn at the last step that the
 * installation could not reach the repository — and be told only "Failed to
 * open pull request. Check server logs for details", logs it cannot read.
 *
 * Two distinct refusals, because they have two distinct fixes: grant the
 * GitHub App access to the repository, or name a branch that exists.
 */
export type RepositoryAccess =
  | { ok: true; private: boolean; defaultBranch: string }
  | { ok: false; reason: 'repository_unreachable' }
  | { ok: false; reason: 'branch_not_found'; defaultBranch: string };

export async function checkRepositoryAccess(
  octokit: Octokit,
  target: { owner: string; repo: string; baseBranch: string },
): Promise<RepositoryAccess> {
  /*
   * Membership is read from the installation's own list, not from
   * `repos.get`. An installation token can *read* any public repository, so
   * `repos.get` answered 200 for `octocat/Hello-World` — found by running the
   * packed CLI against it — and the refusal only came after every locale had
   * been translated, when the first write was rejected.
   *
   * A repository that does not exist and one the installation was not granted
   * both come out as "unreachable". The fix is the same.
   */
  const wanted = `${target.owner}/${target.repo}`.toLowerCase();
  const granted = await octokit.paginate(
    octokit.rest.apps.listReposAccessibleToInstallation,
    { per_page: 100 },
  );
  const repository = granted.find(
    (candidate) => candidate.full_name.toLowerCase() === wanted,
  );
  if (!repository) return { ok: false, reason: 'repository_unreachable' };

  try {
    await octokit.rest.git.getRef({
      owner: target.owner,
      repo: target.repo,
      ref: `heads/${target.baseBranch}`,
    });
  } catch (error) {
    if (statusOf(error) === 404) {
      return {
        ok: false,
        reason: 'branch_not_found',
        defaultBranch: repository.default_branch,
      };
    }
    throw error;
  }

  return {
    ok: true,
    private: repository.private,
    defaultBranch: repository.default_branch,
  };
}

/** The HTTP status an Octokit error carries, if any. */
export function statusOf(error: unknown): number | null {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = (error as { status: unknown }).status;
    return typeof status === 'number' ? status : null;
  }
  return null;
}
