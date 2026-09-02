import { describe, expect, it, vi } from 'vitest';
import { type OpenPrRequest, openTranslationPr } from './open-pr.js';

function fakeOctokit(overrides: Record<string, unknown> = {}) {
  return {
    rest: {
      git: {
        getRef: vi.fn(async () => ({ data: { object: { sha: 'base-sha' } } })),
        // The base commit's own tree. `createTree` below returns a different
        // sha, so the default double describes a request that changes
        // something — the case every pre-existing test here is about.
        getCommit: vi.fn(async () => ({
          data: { tree: { sha: 'base-tree-sha' } },
        })),
        createRef: vi.fn(async () => ({ data: {} })),
        createBlob: vi.fn(async ({ content }: { content: string }) => ({
          data: { sha: `blob-${content.length}` },
        })),
        createTree: vi.fn(async () => ({ data: { sha: 'tree-sha' } })),
        createCommit: vi.fn(async () => ({ data: { sha: 'commit-sha' } })),
        updateRef: vi.fn(async () => ({ data: {} })),
      },
      pulls: {
        create: vi.fn(async () => ({
          data: { html_url: 'https://github.com/o/r/pull/1', number: 1 },
        })),
      },
    },
    ...overrides,
    // biome-ignore lint/suspicious/noExplicitAny: fake Octokit test double doesn't implement the full Octokit type
  } as any;
}

const request: OpenPrRequest = {
  owner: 'acme',
  repo: 'widgets',
  baseBranch: 'main',
  headBranch: 'localize-infra/add-translations',
  title: 'Add German translations',
  body: 'Automated translation PR',
  files: [{ path: 'locales/de.json', content: '{"a":"Hallo"}' }],
};

describe('openTranslationPr', () => {
  it('creates a branch from base, commits the given files, and opens a PR', async () => {
    const octokit = fakeOctokit();
    const result = await openTranslationPr(octokit, request);

    expect(octokit.rest.git.getRef).toHaveBeenCalledWith({
      owner: 'acme',
      repo: 'widgets',
      ref: 'heads/main',
    });
    expect(octokit.rest.git.createRef).toHaveBeenCalledWith({
      owner: 'acme',
      repo: 'widgets',
      ref: 'refs/heads/localize-infra/add-translations',
      sha: 'base-sha',
    });
    expect(octokit.rest.git.createBlob).toHaveBeenCalledWith({
      owner: 'acme',
      repo: 'widgets',
      content: '{"a":"Hallo"}',
      encoding: 'utf-8',
    });
    expect(octokit.rest.pulls.create).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: 'acme',
        repo: 'widgets',
        title: 'Add German translations',
        head: 'localize-infra/add-translations',
        base: 'main',
      }),
    );
    expect(result).toEqual({
      opened: true,
      prUrl: 'https://github.com/o/r/pull/1',
      prNumber: 1,
    });
  });

  it('creates one blob per file and includes all of them in the tree', async () => {
    const octokit = fakeOctokit();
    const multiFileRequest: OpenPrRequest = {
      ...request,
      files: [
        { path: 'locales/de.json', content: '{"a":"Hallo"}' },
        { path: 'locales/ja.json', content: '{"a":"こんにちは"}' },
      ],
    };
    await openTranslationPr(octokit, multiFileRequest);
    expect(octokit.rest.git.createBlob).toHaveBeenCalledTimes(2);
    const treeCall = octokit.rest.git.createTree.mock.calls[0][0];
    expect(treeCall.tree).toHaveLength(2);
    expect(treeCall.tree.map((t: { path: string }) => t.path)).toEqual([
      'locales/de.json',
      'locales/ja.json',
    ]);
  });

  /*
   * The defect this pair of tests exists for.
   *
   * `createTree` with `base_tree` returns the base tree's own sha when every
   * blob it is given already exists at that path with that content — Git
   * deduplicates by content, so an unchanged set of files produces an
   * unchanged tree. The commit built on it was therefore empty, and GitHub
   * opened a pull request with zero changed files. Five of them appeared on
   * the fixture repository in two days.
   *
   * Comparing the two shas is Git's own answer to "did anything change",
   * which is why the check lives here rather than in a caller: `apps/web`
   * holds a checkout of the base branch and can compare content itself, but
   * `packages/cli` runs against a working directory that may already differ
   * from the remote. Only this layer knows what the base actually holds.
   */
  it('opens nothing when the tree it built matches the base tree', async () => {
    const octokit = fakeOctokit();
    // Same sha from both sides: nothing the request carries is new.
    octokit.rest.git.getCommit = vi.fn(async () => ({
      data: { tree: { sha: 'tree-sha' } },
    }));

    const result = await openTranslationPr(octokit, request);

    expect(result).toEqual({ opened: false, reason: 'no_changes' });
    expect(octokit.rest.git.createRef).not.toHaveBeenCalled();
    expect(octokit.rest.git.createCommit).not.toHaveBeenCalled();
    expect(octokit.rest.git.updateRef).not.toHaveBeenCalled();
    expect(octokit.rest.pulls.create).not.toHaveBeenCalled();
  });

  /*
   * Order is the whole reason this could not be a two-line guard. The branch
   * used to be created first, so learning there was nothing to commit would
   * already have left a ref behind to clean up. The tree is built first now,
   * and the branch is created only once it has proved there is a diff.
   */
  it('creates the branch only after the tree proves there is a diff', async () => {
    const octokit = fakeOctokit();
    const order: string[] = [];
    const record = (name: string, fn: (...a: unknown[]) => unknown) =>
      vi.fn(async (...args: unknown[]) => {
        order.push(name);
        return fn(...args);
      });

    octokit.rest.git.createTree = record('createTree', () => ({
      data: { sha: 'tree-sha' },
    }));
    octokit.rest.git.createRef = record('createRef', () => ({ data: {} }));

    await openTranslationPr(octokit, request);

    expect(order).toEqual(['createTree', 'createRef']);
  });
});
