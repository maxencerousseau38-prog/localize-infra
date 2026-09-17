import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { createCallerMiddleware } from './auth.js';
import {
  type Caller,
  type TokenResolver,
  type WorkspaceCaller,
  createPostgrestResolver,
  hashCliToken,
  readTokenResolverConfig,
} from './callers.js';

const OPERATOR_TOKEN = 'operator-token-of-sufficient-length';
const CLI_TOKEN = `lit_${'A'.repeat(43)}`;
/*
 * Checked against `sha256sum`, not against this module: the web app computes
 * the same digest when it issues a token, and apps/web pins the same vector.
 */
const CLI_TOKEN_HASH =
  '23d2277efa2313281dea86c0ed4138c527fb050434fdd59d18ea82dd60d5bfe4';

const WORKSPACE: WorkspaceCaller = {
  kind: 'workspace',
  tokenId: 'tok-1',
  userId: 'user-1',
  organizationId: 'org-1',
  organizationSlug: 'acme',
  installationId: 789,
  privateRepositories: false,
};

describe('hashCliToken', () => {
  it('is SHA-256 hex of the whole token', () => {
    expect(hashCliToken(CLI_TOKEN)).toBe(CLI_TOKEN_HASH);
  });
});

describe('readTokenResolverConfig', () => {
  it('needs both the URL and the service-role key', () => {
    expect(readTokenResolverConfig({})).toBeNull();
    expect(readTokenResolverConfig({ SUPABASE_URL: 'https://x' })).toBeNull();
    expect(
      readTokenResolverConfig({ SUPABASE_SERVICE_ROLE_KEY: 'k' }),
    ).toBeNull();
    expect(
      readTokenResolverConfig({
        SUPABASE_URL: '  https://x.supabase.co/ ',
        SUPABASE_SERVICE_ROLE_KEY: ' k ',
      }),
    ).toEqual({ supabaseUrl: 'https://x.supabase.co', serviceRoleKey: 'k' });
  });
});

describe('createPostgrestResolver', () => {
  const config = { supabaseUrl: 'https://db.test', serviceRoleKey: 'srk' };

  it('asks for the hash only, with the service-role key', async () => {
    const fetchMock = vi.fn(async () => new Response('[]', { status: 200 }));
    await createPostgrestResolver(config, fetchMock).resolve(CLI_TOKEN_HASH);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe('https://db.test/rest/v1/rpc/resolve_cli_token');
    expect(JSON.parse(String(init.body))).toEqual({
      p_token_hash: CLI_TOKEN_HASH,
    });
    expect(String(init.body)).not.toContain('lit_');
    expect(init.headers).toMatchObject({
      apikey: 'srk',
      authorization: 'Bearer srk',
    });
  });

  it('maps a row to a workspace caller', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify([
            {
              token_id: 'tok-1',
              user_id: 'user-1',
              organization_id: 'org-1',
              organization_slug: 'acme',
              installation_id: '789',
              private_repositories: null,
            },
          ]),
          { status: 200 },
        ),
    );
    await expect(
      createPostgrestResolver(config, fetchMock).resolve(CLI_TOKEN_HASH),
    ).resolves.toEqual(WORKSPACE);
  });

  it('keeps a workspace with no GitHub connection as such', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify([
            {
              token_id: 't',
              user_id: 'u',
              organization_id: 'o',
              organization_slug: 's',
              installation_id: null,
              private_repositories: true,
            },
          ]),
          { status: 200 },
        ),
    );
    const caller = await createPostgrestResolver(config, fetchMock).resolve(
      CLI_TOKEN_HASH,
    );
    expect(caller?.installationId).toBeNull();
    expect(caller?.privateRepositories).toBe(true);
  });

  it('resolves an unknown, revoked or expired token to nothing', async () => {
    const fetchMock = vi.fn(async () => new Response('[]', { status: 200 }));
    await expect(
      createPostgrestResolver(config, fetchMock).resolve(CLI_TOKEN_HASH),
    ).resolves.toBeNull();
  });

  it('throws when the database cannot answer, so the caller is told to retry', async () => {
    const fetchMock = vi.fn(async () => new Response('nope', { status: 500 }));
    await expect(
      createPostgrestResolver(config, fetchMock).resolve(CLI_TOKEN_HASH),
    ).rejects.toThrow('token resolution failed (500)');
  });
});

describe('createCallerMiddleware', () => {
  function appWith(resolver: TokenResolver | null) {
    const app = new Hono<{ Variables: { caller: Caller } }>();
    app.use(
      '/v1/*',
      createCallerMiddleware({ operatorToken: OPERATOR_TOKEN, resolver }),
    );
    app.get('/v1/who', (c) => c.json(c.get('caller')));
    return app;
  }
  const call = (app: ReturnType<typeof appWith>, token?: string) =>
    app.request('/v1/who', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

  it('accepts the operator token as the operator', async () => {
    const res = await call(appWith(null), OPERATOR_TOKEN);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ kind: 'operator' });
  });

  it('refuses a missing token and a token of no known shape', async () => {
    expect((await call(appWith(null))).status).toBe(401);
    expect((await call(appWith(null), 'something-else')).status).toBe(401);
  });

  it('refuses a personal token, with the reason, when the database is not configured', async () => {
    const res = await call(appWith(null), CLI_TOKEN);
    expect(res.status).toBe(401);
    expect((await res.json()).error).toMatch(/not enabled on this API/);
  });

  it('resolves a personal token by its hash and acts as its workspace', async () => {
    const resolve = vi.fn(async () => WORKSPACE);
    const res = await call(appWith({ resolve }), CLI_TOKEN);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(WORKSPACE);
    expect(resolve).toHaveBeenCalledWith(CLI_TOKEN_HASH);
  });

  it('refuses an invalid, expired or revoked token and says where to get one', async () => {
    const res = await call(appWith({ resolve: async () => null }), CLI_TOKEN);
    expect(res.status).toBe(401);
    const text = await res.text();
    expect(text).toMatch(/invalid, expired or revoked/);
    expect(text).toMatch(/CLI tokens/);
    expect(text).not.toContain(CLI_TOKEN);
  });

  it('answers 503 rather than 401 when the token cannot be checked', async () => {
    const res = await call(
      appWith({
        resolve: async () => {
          throw new Error('db down');
        },
      }),
      CLI_TOKEN,
    );
    expect(res.status).toBe(503);
    expect(await res.text()).not.toContain('db down');
  });

  it('treats any other personal token as a workspace, never as the operator', async () => {
    // The operator path is an exact match on one secret; every other lit_
    // token goes through the resolver.
    const resolve = vi.fn(async () => WORKSPACE);
    const res = await call(appWith({ resolve }), `lit_${'B'.repeat(43)}`);
    expect(res.status).toBe(200);
    expect((await res.json()).kind).toBe('workspace');
  });
});
