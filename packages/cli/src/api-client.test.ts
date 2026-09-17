import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ApiUnreachableError,
  apiErrorMessage,
  preflightPullRequest,
  whoami,
} from './api-client.js';

const API = 'https://api.test';
const TOKEN = `lit_${'A'.repeat(43)}`;

function respond(status: number, body: string) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
    json: async () => JSON.parse(body),
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('an API that cannot be reached', () => {
  it('is told apart from a refusal, on both questions', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed');
      }),
    );
    await expect(whoami(API, TOKEN)).rejects.toBeInstanceOf(
      ApiUnreachableError,
    );
    await expect(
      preflightPullRequest(API, TOKEN, {
        owner: 'acme',
        repo: 'widgets',
        baseBranch: 'main',
      }),
    ).rejects.toThrow(new ApiUnreachableError(new Error('fetch failed')));
  });

  it('does not treat an HTTP refusal as unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => respond(401, '{"error":"revoked"}')),
    );
    const error = await whoami(API, TOKEN).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(ApiUnreachableError);
  });
});

describe('apiErrorMessage', () => {
  it('prints the API’s own sentence, not the JSON around it', () => {
    expect(apiErrorMessage(401, '{"error":"This CLI token is revoked."}')).toBe(
      'This CLI token is revoked. (HTTP 401)',
    );
  });

  it('falls back to the raw text, then to the status alone', () => {
    expect(apiErrorMessage(502, 'Bad Gateway')).toBe('Bad Gateway (HTTP 502)');
    expect(apiErrorMessage(500, '   ')).toBe('HTTP 500');
    expect(apiErrorMessage(400, '{"other":1}')).toBe('{"other":1} (HTTP 400)');
  });
});

describe('whoami', () => {
  it('sends the token as a bearer header only', async () => {
    const fetchMock = vi.fn(async () => respond(200, '{"kind":"operator"}'));
    vi.stubGlobal('fetch', fetchMock);
    await whoami(API, TOKEN);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      { headers: Record<string, string> },
    ];
    expect(url).toBe(`${API}/v1/whoami`);
    expect(url).not.toContain(TOKEN);
    expect(init.headers.authorization).toBe(`Bearer ${TOKEN}`);
  });

  it('reports the workspace a personal token acts for', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        respond(
          200,
          '{"kind":"workspace","workspace":"acme","githubConnected":true}',
        ),
      ),
    );
    await expect(whoami(API, TOKEN)).resolves.toEqual({
      kind: 'workspace',
      workspace: 'acme',
      githubConnected: true,
    });
  });

  it('treats an API without the route as unknown, not as a failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => respond(404, '404 Not Found')),
    );
    await expect(whoami(API, TOKEN)).resolves.toEqual({ kind: 'unknown' });
  });

  it('throws the API’s refusal for a bad token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        respond(
          401,
          '{"error":"This CLI token is invalid, expired or revoked."}',
        ),
      ),
    );
    await expect(whoami(API, TOKEN)).rejects.toThrow(
      'This CLI token is invalid, expired or revoked. (HTTP 401)',
    );
  });

  it('refuses a shape it does not understand', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => respond(200, '{"kind":"alien"}')),
    );
    await expect(whoami(API, TOKEN)).rejects.toThrow(/unexpected shape/);
  });
});

describe('preflightPullRequest', () => {
  const target = { owner: 'acme', repo: 'widgets', baseBranch: 'main' };

  it('resolves true when a pull request can be opened', async () => {
    const fetchMock = vi.fn(async () =>
      respond(200, '{"ok":true,"repository":"acme/widgets"}'),
    );
    vi.stubGlobal('fetch', fetchMock);
    await expect(preflightPullRequest(API, TOKEN, target)).resolves.toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      { body: string },
    ];
    expect(url).toBe(`${API}/v1/open-pr/preflight`);
    expect(JSON.parse(init.body)).toEqual(target);
  });

  it('returns false for an API that predates the route', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => respond(404, '404 Not Found')),
    );
    await expect(preflightPullRequest(API, TOKEN, target)).resolves.toBe(false);
  });

  it('throws when the repository is unreachable, even though that is also a 404', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        respond(
          404,
          '{"error":"acme/widgets is not reachable by the installation."}',
        ),
      ),
    );
    await expect(preflightPullRequest(API, TOKEN, target)).rejects.toThrow(
      'acme/widgets is not reachable by the installation. (HTTP 404)',
    );
  });

  it('throws the refusal for a missing branch or a private repository', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        respond(422, '{"error":"Branch \\"dev\\" does not exist."}'),
      ),
    );
    await expect(preflightPullRequest(API, TOKEN, target)).rejects.toThrow(
      /does not exist/,
    );
  });
});
