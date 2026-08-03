import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestPr } from './open-pr-client.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

const request = {
  owner: 'acme',
  repo: 'widgets',
  baseBranch: 'main',
  title: 'Add translations',
  body: 'Automated',
  files: [{ path: 'locales/de.json', content: '{}' }],
};

describe('requestPr', () => {
  it('POSTs to <apiUrl>/v1/open-pr and returns the PR result', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          prUrl: 'https://github.com/acme/widgets/pull/1',
          prNumber: 1,
        }),
      })),
    );
    const result = await requestPr('http://localhost:8787', request);
    expect(result).toEqual({
      prUrl: 'https://github.com/acme/widgets/pull/1',
      prNumber: 1,
    });
  });

  it('throws a clear error (including a hint about GITHUB_APP_* env vars) on a 501 response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 501,
        text: async () => 'GitHub App is not configured',
      })),
    );
    await expect(requestPr('http://localhost:8787', request)).rejects.toThrow(
      'GitHub App is not configured',
    );
  });
});
