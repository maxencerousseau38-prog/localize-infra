import { describe, expect, it, vi } from 'vitest';
import { checkRepositoryAccess, statusOf } from './access.js';

function httpError(status: number) {
  return Object.assign(new Error(`HTTP ${status}`), { status });
}

type GrantedRepository = {
  full_name: string;
  private: boolean;
  default_branch: string;
};

const WIDGETS: GrantedRepository = {
  full_name: 'acme/widgets',
  private: false,
  default_branch: 'main',
};

function fakeOctokit({
  granted = async (): Promise<GrantedRepository[]> => [WIDGETS],
  ref = async () => ({ data: { object: { sha: 'x' } } }),
}: {
  granted?: () => Promise<GrantedRepository[]>;
  ref?: () => Promise<unknown>;
} = {}) {
  const listReposAccessibleToInstallation = vi.fn();
  return {
    paginate: vi.fn(async (method: unknown) => {
      if (method !== listReposAccessibleToInstallation) {
        throw new Error('paginated something other than the installation list');
      }
      return granted();
    }),
    rest: {
      apps: { listReposAccessibleToInstallation },
      // Readable for any public repository, so it must not decide access.
      repos: { get: vi.fn(async () => ({ data: WIDGETS })) },
      git: {
        getRef: vi.fn(ref),
        // Present so a test can prove nothing was written.
        createRef: vi.fn(),
        createBlob: vi.fn(),
      },
    },
    // biome-ignore lint/suspicious/noExplicitAny: partial Octokit test double
  } as any;
}

const target = { owner: 'acme', repo: 'widgets', baseBranch: 'main' };

describe('checkRepositoryAccess', () => {
  it('reports a reachable repository, its visibility and default branch', async () => {
    const octokit = fakeOctokit({
      granted: async () => [
        { full_name: 'acme/widgets', private: true, default_branch: 'trunk' },
      ],
    });
    await expect(checkRepositoryAccess(octokit, target)).resolves.toEqual({
      ok: true,
      private: true,
      defaultBranch: 'trunk',
    });
    expect(octokit.rest.git.getRef).toHaveBeenCalledWith({
      owner: 'acme',
      repo: 'widgets',
      ref: 'heads/main',
    });
  });

  it('matches owner and name without regard to case, as GitHub does', async () => {
    const octokit = fakeOctokit();
    await expect(
      checkRepositoryAccess(octokit, { ...target, owner: 'ACME' }),
    ).resolves.toMatchObject({ ok: true });
  });

  it('reports a repository the installation was not granted', async () => {
    const octokit = fakeOctokit({ granted: async () => [] });
    await expect(checkRepositoryAccess(octokit, target)).resolves.toEqual({
      ok: false,
      reason: 'repository_unreachable',
    });
    expect(octokit.rest.git.getRef).not.toHaveBeenCalled();
  });

  /*
   * The case the first version got wrong: an installation token can read any
   * public repository, so a `repos.get` that answers 200 says nothing about
   * whether a pull request can be opened there.
   */
  it('refuses a public repository outside the installation even though it is readable', async () => {
    const octokit = fakeOctokit();
    await expect(
      checkRepositoryAccess(octokit, {
        owner: 'octocat',
        repo: 'Hello-World',
        baseBranch: 'master',
      }),
    ).resolves.toEqual({ ok: false, reason: 'repository_unreachable' });
    expect(octokit.rest.git.getRef).not.toHaveBeenCalled();
  });

  it('does not take a repository whose name merely starts the same', async () => {
    const octokit = fakeOctokit({
      granted: async () => [{ ...WIDGETS, full_name: 'acme/widgets-legacy' }],
    });
    await expect(checkRepositoryAccess(octokit, target)).resolves.toEqual({
      ok: false,
      reason: 'repository_unreachable',
    });
  });

  it('reports a missing base branch and names the default one', async () => {
    const octokit = fakeOctokit({
      ref: async () => {
        throw httpError(404);
      },
    });
    await expect(checkRepositoryAccess(octokit, target)).resolves.toEqual({
      ok: false,
      reason: 'branch_not_found',
      defaultBranch: 'main',
    });
  });

  it('writes nothing', async () => {
    const octokit = fakeOctokit();
    await checkRepositoryAccess(octokit, target);
    expect(octokit.rest.git.createRef).not.toHaveBeenCalled();
    expect(octokit.rest.git.createBlob).not.toHaveBeenCalled();
  });

  it('rethrows a failure to list the installation, rather than calling it unreachable', async () => {
    const octokit = fakeOctokit({
      granted: async () => {
        throw httpError(500);
      },
    });
    await expect(checkRepositoryAccess(octokit, target)).rejects.toThrow(
      'HTTP 500',
    );
  });

  it('rethrows a branch lookup that is not a 404', async () => {
    const octokit = fakeOctokit({
      ref: async () => {
        throw httpError(502);
      },
    });
    await expect(checkRepositoryAccess(octokit, target)).rejects.toThrow(
      'HTTP 502',
    );
  });
});

describe('statusOf', () => {
  it('reads a numeric status and nothing else', () => {
    expect(statusOf(httpError(403))).toBe(403);
    expect(statusOf(new Error('plain'))).toBeNull();
    expect(statusOf({ status: '404' })).toBeNull();
    expect(statusOf(null)).toBeNull();
  });
});
