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
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const result = await openPrRouteHandler(validBody, config, ops);
    consoleErrorSpy.mockRestore();

    expect(result.status).toBe(502);
  });

  // Regression test for a stale-dist class of bug: apps/api resolves
  // `@localize-infra/schemas` through that package's `"main": "./dist/index.js"`
  // (real npm/node package resolution), NOT through a relative source import.
  // packages/schemas' own vitest suite imports `./open-pr-api.js` as a
  // *relative sibling file*, which resolves to source regardless of whether
  // dist/ is built or stale — so it can never catch dist/ going stale. This
  // test calls `openPrRouteHandler` exactly as the running server does, which
  // pulls `OpenPrApiRequestSchema` in via the real package resolution path.
  // It only passes if `packages/schemas/dist/open-pr-api.js` actually
  // contains the path-validation logic; if dist/ is ever rebuilt from an
  // older commit (or not rebuilt at all), this test fails with a 200 instead
  // of the expected 400, pinning the cross-package contract.
  it('rejects a path-traversal file path via the real @localize-infra/schemas package resolution (not a relative source import)', async () => {
    const result = await openPrRouteHandler(
      {
        ...validBody,
        files: [{ path: '../../evil.yml', content: 'x' }],
      },
      config,
      fakeOps(),
    );
    expect(result.status).toBe(400);
  });

  it('does not leak the underlying error message to the caller on failure', async () => {
    const distinctiveMessage =
      'installation token abc123 lacks permission on repo xyz-internal';
    const ops = fakeOps({
      openPr: vi.fn(async () => {
        throw new Error(distinctiveMessage);
      }),
    });
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const result = await openPrRouteHandler(validBody, config, ops);
    consoleErrorSpy.mockRestore();

    expect(result.status).toBe(502);
    const responseText = JSON.stringify(result.body);
    expect(responseText).not.toContain(distinctiveMessage);
    expect(responseText).not.toContain('abc123');
    expect(result.body).toHaveProperty('error');
    expect((result.body as { error: string }).error.length).toBeGreaterThan(0);
  });
});
