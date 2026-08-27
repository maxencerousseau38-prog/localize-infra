import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The two checks that stand between a query string and somebody else's
 * repositories.
 *
 * `state` proves the callback belongs to a flow this server started, for this
 * workspace, recently. It proves nothing about the installation. Ownership is
 * established separately, by asking GitHub — with the user's own token — which
 * installations they can reach. Both are exercised here, including the ways
 * each is meant to fail.
 */

const PRIVATE_KEY = 'test-private-key-not-a-real-one';

beforeEach(() => {
  vi.resetModules();
  process.env.GITHUB_APP_ID = '1234';
  process.env.GITHUB_APP_INSTALLATION_ID = '999';
  process.env.GITHUB_APP_PRIVATE_KEY = PRIVATE_KEY;
  process.env.GITHUB_OAUTH_CLIENT_ID = 'client-id';
  process.env.GITHUB_OAUTH_CLIENT_SECRET = 'client-secret';
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function load() {
  return await import('./install');
}

describe('state', () => {
  it('round-trips the organization it was issued for', async () => {
    const { signState, verifyState } = await load();
    const state = signState('org-a');
    expect(state).not.toBeNull();
    expect(verifyState(state)).toBe('org-a');
  });

  /*
   * The forgery this exists to stop. Without a valid signature, anyone could
   * name any workspace in a callback and have an installation bound to it.
   */
  it('rejects a state whose signature does not match', async () => {
    const { signState, verifyState } = await load();
    const state = signState('org-a') as string;
    const [org, issued] = state.split('.');
    const forged = `${org}.${issued}.${'0'.repeat(64)}`;
    expect(verifyState(forged)).toBeNull();
  });

  /*
   * Swapping the organization while keeping a signature that was valid for a
   * different one. This is the cross-tenant attempt in its most direct form:
   * complete your own install, then rewrite whose workspace it lands in.
   */
  it('rejects a signature lifted from another workspace', async () => {
    const { signState, verifyState } = await load();
    const mine = signState('org-mine') as string;
    const [, issued, signature] = mine.split('.');
    expect(verifyState(`org-theirs.${issued}.${signature}`)).toBeNull();
  });

  it('rejects a malformed state rather than throwing', async () => {
    const { verifyState } = await load();
    for (const bad of [null, '', 'a', 'a.b', 'a.b.c.d']) {
      expect(verifyState(bad)).toBeNull();
    }
  });

  it('expires after its ten-minute window', async () => {
    const { signState, verifyState } = await load();
    const state = signState('org-a') as string;

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 11 * 60 * 1000);
    expect(verifyState(state)).toBeNull();
    vi.useRealTimers();
  });

  it('is unavailable when the deployment has no App key', async () => {
    process.env.GITHUB_APP_PRIVATE_KEY = '';
    process.env.GITHUB_APP_PRIVATE_KEY_PATH = '';
    vi.resetModules();
    const { signState } = await import('./install');
    expect(signState('org-a')).toBeNull();
  });
});

describe('installation ownership', () => {
  const okToken = {
    ok: true,
    json: async () => ({ access_token: 'user-token' }),
  };

  it('accepts an installation the user can actually reach', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.includes('access_token')
          ? okToken
          : {
              ok: true,
              json: async () => ({
                installations: [
                  { id: 42, account: { login: 'acme', type: 'Organization' } },
                ],
              }),
            },
      ),
    );

    const { verifyInstallationOwnership } = await load();
    expect(await verifyInstallationOwnership('code', 42)).toEqual({
      installationId: 42,
      accountLogin: 'acme',
      accountType: 'Organization',
    });
  });

  /*
   * The account takeover this check exists to prevent: a real code, a real
   * session, and an installation id belonging to somebody else. GitHub says it
   * is not in the caller's list, so it is refused.
   */
  it('refuses an installation the user cannot reach', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.includes('access_token')
          ? okToken
          : {
              ok: true,
              json: async () => ({
                installations: [
                  { id: 7, account: { login: 'mine', type: 'User' } },
                ],
              }),
            },
      ),
    );

    const { verifyInstallationOwnership } = await load();
    expect(await verifyInstallationOwnership('code', 42)).toBeNull();
  });

  it('refuses when the user has no installations at all', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.includes('access_token')
          ? okToken
          : { ok: true, json: async () => ({ installations: [] }) },
      ),
    );

    const { verifyInstallationOwnership } = await load();
    expect(await verifyInstallationOwnership('code', 42)).toBeNull();
  });

  it('refuses when the code cannot be exchanged', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, json: async () => ({}) })),
    );
    const { verifyInstallationOwnership } = await load();
    expect(await verifyInstallationOwnership('bad-code', 42)).toBeNull();
  });

  /* An expired or revoked token: GitHub answers 401 on the installations call. */
  it('refuses when the GitHub API rejects the token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.includes('access_token')
          ? okToken
          : { ok: false, json: async () => ({}) },
      ),
    );

    const { verifyInstallationOwnership } = await load();
    expect(await verifyInstallationOwnership('code', 42)).toBeNull();
  });

  it('refuses when the deployment has no OAuth secret', async () => {
    process.env.GITHUB_OAUTH_CLIENT_SECRET = '';
    vi.resetModules();
    const { verifyInstallationOwnership } = await import('./install');
    expect(await verifyInstallationOwnership('code', 42)).toBeNull();
  });
});

describe('installBlockers', () => {
  /*
   * The connection panel used to end its explanation with "The CLI still works
   * against a local clone". That was the only exit it offered and it is not a
   * door: `packages/cli` is not published, so a developer outside this
   * repository cannot take it. What replaced it is this list, so it is worth
   * asserting that the list is right.
   */
  it('is empty when everything the flow needs is present', async () => {
    // The shared beforeEach sets every variable the OAuth tests need; the slug
    // is only read by this function, so it is set here.
    process.env.GITHUB_APP_SLUG = 'localize-infra';
    process.env.GITHUB_OAUTH_CLIENT_SECRET = 'secret';
    const { installBlockers } = await import('./install');
    expect(installBlockers()).toEqual([]);
  });

  it('names the client secret, the one thing production is actually missing', async () => {
    process.env.GITHUB_APP_SLUG = 'localize-infra';
    // biome-ignore lint/performance/noDelete: the code reads absence, not ''
    delete process.env.GITHUB_OAUTH_CLIENT_SECRET;
    const { installBlockers } = await import('./install');
    expect(installBlockers()).toEqual(['GITHUB_OAUTH_CLIENT_SECRET']);
  });

  /*
   * The state signature reuses the App private key rather than carrying one of
   * its own, so an unconfigured App shows up here as the key — the variable
   * somebody would actually have to set — rather than as a separate name for
   * something that does not exist.
   */
  it('reports the private key when the app itself is unconfigured', async () => {
    process.env.GITHUB_APP_SLUG = 'localize-infra';
    process.env.GITHUB_OAUTH_CLIENT_SECRET = 'secret';
    // biome-ignore lint/performance/noDelete: the code reads absence, not ''
    delete process.env.GITHUB_APP_PRIVATE_KEY;
    const { installBlockers } = await import('./install');
    expect(installBlockers()).toContain('GITHUB_APP_PRIVATE_KEY');
  });

  it('names every missing variable rather than stopping at the first', async () => {
    for (const name of [
      'GITHUB_APP_SLUG',
      'GITHUB_OAUTH_CLIENT_ID',
      'GITHUB_OAUTH_CLIENT_SECRET',
    ]) {
      // biome-ignore lint/performance/noDelete: the code reads absence, not ''
      delete process.env[name];
    }
    const { installBlockers } = await import('./install');
    expect(installBlockers()).toEqual(
      expect.arrayContaining([
        'GITHUB_APP_SLUG',
        'GITHUB_OAUTH_CLIENT_ID',
        'GITHUB_OAUTH_CLIENT_SECRET',
      ]),
    );
  });
});
