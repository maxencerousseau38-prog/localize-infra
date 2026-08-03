import { describe, expect, it, vi } from 'vitest';
import { type OpenPrRequest, openTranslationPr } from './open-pr.js';

function fakeOctokit(overrides: Record<string, unknown> = {}) {
  return {
    rest: {
      git: {
        getRef: vi.fn(async () => ({ data: { object: { sha: 'base-sha' } } })),
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
});
