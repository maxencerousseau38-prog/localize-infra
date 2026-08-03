import { describe, expect, it, vi } from 'vitest';
import type { GitHubAppOperations } from './route.js';
import { openPrRouteHandler } from './route.js';

const validBody = {
  owner: 'acme',
  repo: 'widgets',
  baseBranch: 'main',
  title: 'Add translations',
  body: 'Automated',
  files: [{ path: 'locales/de.json', content: '{}' }],
};

const config = { appId: '123', privateKey: 'fake-key', installationId: 456 };

function fakeOps(
  overrides: Partial<GitHubAppOperations> = {},
): GitHubAppOperations {
  return {
    createClient: vi.fn(async () => ({}) as never),
    openPr: vi.fn(async () => ({
      prUrl: 'https://github.com/acme/widgets/pull/1',
      prNumber: 1,
    })),
    ...overrides,
  };
}

describe('openPrRouteHandler', () => {
  it('returns 501 when no GitHub App config is available', async () => {
    const result = await openPrRouteHandler(validBody, null, fakeOps());
    expect(result.status).toBe(501);
  });

  it('returns 400 for a request body that fails schema validation', async () => {
    const result = await openPrRouteHandler({ owner: 'a' }, config, fakeOps());
    expect(result.status).toBe(400);
  });

  it('returns 200 with the PR result when github-app succeeds', async () => {
    const result = await openPrRouteHandler(validBody, config, fakeOps());
    expect(result.status).toBe(200);
    expect(result.body).toEqual({
      prUrl: 'https://github.com/acme/widgets/pull/1',
      prNumber: 1,
    });
  });

  it('returns 502 when github-app throws', async () => {
    const ops = fakeOps({
      openPr: vi.fn(async () => {
        throw new Error('branch already exists');
      }),
    });
    const result = await openPrRouteHandler(validBody, config, ops);
    expect(result.status).toBe(502);
  });
});
