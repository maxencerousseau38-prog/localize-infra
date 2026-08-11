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

describe('readGitHubAppConfig', () => {
  async function loadModule() {
    process.env.API_AUTH_TOKEN = 'test-auth-token';
    vi.resetModules();
    return import('./index.js');
  }

  it('returns null when required env vars are missing', async () => {
    const { readGitHubAppConfig } = await loadModule();
    expect(readGitHubAppConfig()).toBeNull();
  });

  it('returns null when GITHUB_APP_INSTALLATION_ID is not numeric (NaN guard)', async () => {
    process.env.GITHUB_APP_ID = 'app-123';
    process.env.GITHUB_APP_PRIVATE_KEY = 'fake-pem-content';
    process.env.GITHUB_APP_INSTALLATION_ID = 'not-a-number';
    const { readGitHubAppConfig } = await loadModule();
    expect(readGitHubAppConfig()).toBeNull();
  });

  it('returns a config object with a numeric installationId when all env vars are valid', async () => {
    process.env.GITHUB_APP_ID = 'app-123';
    process.env.GITHUB_APP_PRIVATE_KEY = 'fake-pem-content';
    process.env.GITHUB_APP_INSTALLATION_ID = '456';
    const { readGitHubAppConfig } = await loadModule();
    expect(readGitHubAppConfig()).toEqual({
      appId: 'app-123',
      privateKey: 'fake-pem-content',
      installationId: 456,
    });
  });

  it('reads the private key from GITHUB_APP_PRIVATE_KEY_PATH when GITHUB_APP_PRIVATE_KEY is not set', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'gh-app-key-'));
    const keyPath = join(dir, 'key.pem');
    writeFileSync(keyPath, 'fake-pem-content-from-file');
    try {
      process.env.GITHUB_APP_ID = 'app-123';
      process.env.GITHUB_APP_PRIVATE_KEY_PATH = keyPath;
      process.env.GITHUB_APP_INSTALLATION_ID = '456';
      const { readGitHubAppConfig } = await loadModule();
      expect(readGitHubAppConfig()).toEqual({
        appId: 'app-123',
        privateKey: 'fake-pem-content-from-file',
        installationId: 456,
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
      process.env.GITHUB_APP_INSTALLATION_ID = '456';
      const { readGitHubAppConfig } = await loadModule();
      expect(readGitHubAppConfig()?.privateKey).toBe('from-inline');
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
    process.env.GITHUB_APP_INSTALLATION_ID = '456';
    const { readGitHubAppConfig } = await loadModule();
    expect(readGitHubAppConfig()).toBeNull();
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
