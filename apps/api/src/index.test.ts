import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// These tests import the REAL `app` export from ./index.js (not a
// hand-built Hono instance like auth.test.ts uses), so they exercise the
// actual route registration order in index.ts. A hypothetical future route
// registered ABOVE the `app.use('/v1/*', createAuthMiddleware(...))` line
// would bypass auth entirely, and nothing else in this codebase would catch
// that structurally — auth.test.ts only proves the middleware function
// itself is correct in isolation.
//
// index.ts throws at module load if API_AUTH_TOKEN is unset, so that env
// var must be set BEFORE the dynamic import below. A static top-level
// import would run before this file's beforeEach has a chance to set it, so
// every test here uses a dynamic `await import('./index.js')` instead, and
// `vi.resetModules()` first so each test gets a fresh module evaluation
// rather than a cached one from a previous test's env var state.

const ENV_KEYS = [
  'API_AUTH_TOKEN',
  'GITHUB_APP_ID',
  'GITHUB_APP_PRIVATE_KEY',
  'GITHUB_APP_PRIVATE_KEY_PATH',
  'GITHUB_APP_INSTALLATION_ID',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

function clearEnv(): void {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
}

beforeEach(() => {
  clearEnv();
});

afterEach(() => {
  clearEnv();
});

describe('app (real index.ts route wiring)', () => {
  async function loadApp() {
    process.env.API_AUTH_TOKEN = 'test-auth-token';
    vi.resetModules();
    const mod = await import('./index.js');
    return mod.app;
  }

  // This is the first test to call `loadApp()`, so it pays for the dynamic
  // import of the whole route tree — roughly 400ms alone, but over 8s when
  // `turbo run test --force` has every other workspace compiling on the same
  // cores. It flaked three times that way and passed on every isolated run.
  // The work is not slow; the default 5s ceiling is just too close to it under
  // load, so this one test gets room rather than the suite getting a retry.
  it(
    'returns 401 for /v1/translate with no Authorization header',
    { timeout: 30_000 },
    async () => {
      const app = await loadApp();
      const res = await app.request('/v1/translate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(401);
    },
  );

  it('returns 401 for /v1/open-pr with no Authorization header', async () => {
    const app = await loadApp();
    const res = await app.request('/v1/open-pr', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(401);
  });

  it('returns 200 for /health with no Authorization header (correctly excluded from auth)', async () => {
    const app = await loadApp();
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('returns 200 for /api/version with no Authorization header', async () => {
    const app = await loadApp();
    const res = await app.request('/api/version');

    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');

    const body = await res.json();
    expect(body).toHaveProperty('commit');
    expect(body).toHaveProperty('environment');
  });

  /*
   * The env vars are cleared in beforeEach, so this asserts the branch that
   * production is most likely to take: this project deploys by CLI archive
   * rather than from Git, so it may well carry no commit metadata at all.
   * `null` is the honest answer there; a fabricated sha would be worse than no
   * endpoint, because it would be believed.
   */
  it('reports a null commit rather than a fabricated one when Vercel sets nothing', async () => {
    const app = await loadApp();
    const res = await app.request('/api/version');

    expect(await res.json()).toEqual({ commit: null, environment: null });
  });

  /*
   * The point of this file: adding a public route must not widen the auth
   * surface. `/v1/*` is matched by the middleware and `/api/version` is not,
   * and both halves have to stay true together — asserting only the new route
   * would pass just as happily if the middleware had been removed.
   */
  it('leaves /v1/* authentication untouched', async () => {
    const app = await loadApp();

    expect((await app.request('/api/version')).status).toBe(200);

    for (const path of ['/v1/translate', '/v1/open-pr']) {
      const res = await app.request(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status, `${path} must still require a bearer`).toBe(401);
    }
  });

  it('answers /v1/whoami for the operator token', async () => {
    const app = await loadApp();
    const res = await app.request('/v1/whoami', {
      headers: { Authorization: 'Bearer test-auth-token' },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ kind: 'operator' });
  });

  it('protects /v1/whoami and /v1/open-pr/preflight like every /v1 route', async () => {
    const app = await loadApp();
    expect((await app.request('/v1/whoami')).status).toBe(401);
    const preflight = await app.request('/v1/open-pr/preflight', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ owner: 'o', repo: 'r', baseBranch: 'main' }),
    });
    expect(preflight.status).toBe(401);
  });

  /*
   * The tests run without SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY, which is
   * also the state of a deployment that has not enabled personal tokens.
   */
  it('refuses a personal token with a reason when the database is not configured', async () => {
    const app = await loadApp();
    const res = await app.request('/v1/whoami', {
      headers: { Authorization: `Bearer lit_${'A'.repeat(43)}` },
    });
    expect(res.status).toBe(401);
    expect((await res.json()).error).toMatch(/not enabled/);
  });

  it('still returns 401 for /v1/translate with a wrong bearer token', async () => {
    const app = await loadApp();
    const res = await app.request('/v1/translate', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: 'Bearer wrong-token',
      },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(401);
  });
});

describe('readGitHubAppCredentials and readDefaultInstallationId', () => {
  async function loadModule() {
    process.env.API_AUTH_TOKEN = 'test-auth-token';
    vi.resetModules();
    return import('./index.js');
  }

  it('returns null credentials when required env vars are missing', async () => {
    const { readGitHubAppCredentials } = await loadModule();
    expect(readGitHubAppCredentials()).toBeNull();
  });

  /*
   * The App is configured even with no installation, and that is the whole
   * point of the split.
   *
   * These were one function returning null unless all three were present, so a
   * deployment holding valid App credentials and no default installation
   * reported the App as unconfigured — and a request naming its own tenant
   * installation, which needs nothing from the environment beyond the key,
   * could never be served. `apps/web` hit the identical bug on the read path in
   * #24, from the identical cause.
   */
  it('reports the App as configured when only the installation id is absent', async () => {
    process.env.GITHUB_APP_ID = 'app-123';
    process.env.GITHUB_APP_PRIVATE_KEY = 'fake-pem-content';
    const { readGitHubAppCredentials, readDefaultInstallationId } =
      await loadModule();
    expect(readGitHubAppCredentials()).toEqual({
      appId: 'app-123',
      privateKey: 'fake-pem-content',
    });
    expect(readDefaultInstallationId()).toBeNull();
  });

  it('returns no default installation when GITHUB_APP_INSTALLATION_ID is not numeric (NaN guard)', async () => {
    process.env.GITHUB_APP_INSTALLATION_ID = 'not-a-number';
    const { readDefaultInstallationId } = await loadModule();
    expect(readDefaultInstallationId()).toBeNull();
  });

  it('returns a numeric default installation when GITHUB_APP_INSTALLATION_ID is valid', async () => {
    process.env.GITHUB_APP_INSTALLATION_ID = '456';
    const { readDefaultInstallationId } = await loadModule();
    expect(readDefaultInstallationId()).toBe(456);
  });

  it('reads the private key from GITHUB_APP_PRIVATE_KEY_PATH when GITHUB_APP_PRIVATE_KEY is not set', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'gh-app-key-'));
    const keyPath = join(dir, 'key.pem');
    writeFileSync(keyPath, 'fake-pem-content-from-file');
    try {
      process.env.GITHUB_APP_ID = 'app-123';
      process.env.GITHUB_APP_PRIVATE_KEY_PATH = keyPath;
      const { readGitHubAppCredentials } = await loadModule();
      expect(readGitHubAppCredentials()).toEqual({
        appId: 'app-123',
        privateKey: 'fake-pem-content-from-file',
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('prefers GITHUB_APP_PRIVATE_KEY over GITHUB_APP_PRIVATE_KEY_PATH when both are set', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'gh-app-key-'));
    const keyPath = join(dir, 'key.pem');
    writeFileSync(keyPath, 'from-file');
    try {
      process.env.GITHUB_APP_ID = 'app-123';
      process.env.GITHUB_APP_PRIVATE_KEY = 'from-inline';
      process.env.GITHUB_APP_PRIVATE_KEY_PATH = keyPath;
      const { readGitHubAppCredentials } = await loadModule();
      expect(readGitHubAppCredentials()?.privateKey).toBe('from-inline');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns null when GITHUB_APP_PRIVATE_KEY_PATH points at a file that does not exist', async () => {
    process.env.GITHUB_APP_ID = 'app-123';
    process.env.GITHUB_APP_PRIVATE_KEY_PATH = join(
      tmpdir(),
      'this-file-does-not-exist.pem',
    );
    const { readGitHubAppCredentials } = await loadModule();
    expect(readGitHubAppCredentials()).toBeNull();
  });

  it('causes /v1/open-pr to respond 501 (not configured) rather than crash, when installationId is non-numeric', async () => {
    process.env.GITHUB_APP_ID = 'app-123';
    process.env.GITHUB_APP_PRIVATE_KEY = 'fake-pem-content';
    process.env.GITHUB_APP_INSTALLATION_ID = 'not-a-number';
    const { app } = await loadModule();
    const res = await app.request('/v1/open-pr', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: 'Bearer test-auth-token',
      },
      body: JSON.stringify({
        owner: 'acme',
        repo: 'widgets',
        baseBranch: 'main',
        title: 'Add translations',
        body: 'Automated',
        files: [{ path: 'locales/de.json', content: '{}' }],
      }),
    });
    expect(res.status).toBe(501);
  });
});

/*
 * Cost protection, through the real route tree.
 *
 * quota.test.ts proves the decisions in isolation and
 * supabase/tests/api-limits.sql proves the counting in the database. What is
 * left, and what these cover, is the wiring: that the charge happens on the
 * two routes that spend money, with the right number of units, before the
 * work, and never for the operator.
 */
describe('usage guards on the routes that spend money', () => {
  const TOKEN = `lit_${'B'.repeat(43)}`;
  const WORKSPACE_ROW = {
    token_id: '11111111-1111-4111-8111-111111111111',
    user_id: '22222222-2222-4222-8222-222222222222',
    organization_id: '33333333-3333-4333-8333-333333333333',
    organization_slug: 'acme',
    installation_id: 4242,
    private_repositories: false,
  };

  /** A stand-in Supabase answering the two RPCs the API makes. */
  function stubDatabase(quota: unknown) {
    const calls: { url: string; body: unknown }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        const body = init.body ? JSON.parse(init.body as string) : null;
        calls.push({ url, body });
        const payload = url.endsWith('/rpc/resolve_cli_token')
          ? [WORKSPACE_ROW]
          : [quota];
        return {
          ok: true,
          status: 200,
          json: async () => payload,
        } as unknown as Response;
      }),
    );
    return calls;
  }

  const ALLOWED = {
    allowed: true,
    reason: null,
    retry_after_seconds: 0,
    used: 3,
    limit_value: 5000,
  };

  async function loadConfiguredApp() {
    process.env.API_AUTH_TOKEN = 'test-auth-token';
    process.env.SUPABASE_URL = 'https://db.test';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
    vi.resetModules();
    const mod = await import('./index.js');
    return mod.app;
  }

  function translateRequest(token: string, strings = 3) {
    return {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        targetLocale: 'de',
        strings: Array.from({ length: strings }, (_, i) => ({
          key: `k${i}`,
          text: 'Welcome',
          filePath: 'src/App.tsx',
          componentName: null,
          surroundingCode: '',
        })),
      }),
    };
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('charges /v1/translate for the strings the request carries', async () => {
    const calls = stubDatabase(ALLOWED);
    const app = await loadConfiguredApp();
    /*
     * Not a specific status: what happens after the guard depends on whether
     * the machine running the tests has a provider key in its environment —
     * 503 without one, 502 with one, since the stubbed fetch answers the model
     * with an RPC payload. Either way the request got past the guard, which is
     * the claim. Asserting 503 made this test fail on a developer machine and
     * pass in CI.
     */
    const res = await app.request('/v1/translate', translateRequest(TOKEN, 7));
    expect(res.status).not.toBe(429);
    const charge = calls.find((c) => c.url.endsWith('/rpc/consume_api_quota'));
    expect(charge?.body).toMatchObject({
      p_route: 'translate',
      p_units: 7,
      p_organization_id: WORKSPACE_ROW.organization_id,
      p_token_id: WORKSPACE_ROW.token_id,
    });
  });

  it('answers 429 with Retry-After, and does not run the work', async () => {
    const calls = stubDatabase({
      allowed: false,
      reason: 'rate',
      retry_after_seconds: 17,
      used: 31,
      limit_value: 30,
    });
    const app = await loadConfiguredApp();
    const res = await app.request('/v1/translate', translateRequest(TOKEN));
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('17');
    expect((await res.json()).error).toMatch(/Too many translation requests/);
    // The provider is never reached: the only calls are the two RPCs.
    expect(calls.every((c) => c.url.startsWith('https://db.test'))).toBe(true);
  });

  it('answers 429 when the daily ceiling is reached', async () => {
    stubDatabase({
      allowed: false,
      reason: 'quota',
      retry_after_seconds: 3600,
      used: 5000,
      limit_value: 5000,
    });
    const app = await loadConfiguredApp();
    const res = await app.request('/v1/translate', translateRequest(TOKEN));
    expect(res.status).toBe(429);
    expect((await res.json()).error).toMatch(/ceiling of 5000 strings/);
  });

  it('charges /v1/open-pr one unit per request', async () => {
    const calls = stubDatabase(ALLOWED);
    const app = await loadConfiguredApp();
    const res = await app.request('/v1/open-pr', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({
        owner: 'acme',
        repo: 'widgets',
        baseBranch: 'main',
        title: 'Add translations',
        body: 'Automated',
        installationId: 4242,
        files: [{ path: 'locales/de.json', content: '{}' }],
      }),
    });
    // 501: no GitHub App credentials on this deployment — again, after the
    // guard.
    expect(res.status).toBe(501);
    expect(
      calls.find((c) => c.url.endsWith('/rpc/consume_api_quota'))?.body,
    ).toMatchObject({ p_route: 'open_pr', p_units: 1 });
  });

  it('does not charge the preflight route, which exists to avoid spending', async () => {
    const calls = stubDatabase(ALLOWED);
    const app = await loadConfiguredApp();
    await app.request('/v1/open-pr/preflight', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({
        owner: 'acme',
        repo: 'widgets',
        baseBranch: 'main',
      }),
    });
    expect(calls.some((c) => c.url.endsWith('/rpc/consume_api_quota'))).toBe(
      false,
    );
  });

  it('never charges the operator token', async () => {
    const calls = stubDatabase(ALLOWED);
    const app = await loadConfiguredApp();
    const res = await app.request(
      '/v1/translate',
      translateRequest('test-auth-token'),
    );
    expect(res.status).not.toBe(429);
    expect(calls.some((c) => c.url.endsWith('/rpc/consume_api_quota'))).toBe(
      false,
    );
  });

  it('refuses with 503 when the usage check cannot run', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('/rpc/resolve_cli_token')) {
          return {
            ok: true,
            status: 200,
            json: async () => [WORKSPACE_ROW],
          } as unknown as Response;
        }
        return {
          ok: false,
          status: 500,
          json: async () => ({}),
        } as unknown as Response;
      }),
    );
    const app = await loadConfiguredApp();
    const res = await app.request('/v1/translate', translateRequest(TOKEN));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/Could not check/);
  });
});
