import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runInit } from './init.js';

/*
 * runInit asks /v1/whoami — and, with --open-pr, /v1/open-pr/preflight —
 * before it writes or spends anything. Each test describes the translate and
 * open-pr responses it cares about; this answers the two preliminary questions
 * as an operator-token API would, and hands every other request on.
 */
// biome-ignore lint/suspicious/noExplicitAny: test doubles for fetch
function stubApi(handler: (...args: any[]) => unknown) {
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    if (url.endsWith('/v1/whoami')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ kind: 'operator' }),
      };
    }
    if (url.endsWith('/v1/open-pr/preflight')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
        text: async () => '{}',
      };
    }
    return handler(url, init);
  });
}

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cli-init-'));
  mkdirSync(join(dir, 'src'), { recursive: true });
  // Default fetch stub so the original (pre-translation) tests below stay
  // hermetic now that runInit always calls the translation API after
  // writing locales/en.json. Tests that care about translation behavior
  // override this with their own stubApi(...).
  stubApi(
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ translations: [], missingKeys: [] }),
    })),
  );
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.unstubAllGlobals();
});

function writeViteReactProject(): void {
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({ dependencies: { react: '^18.0.0', vite: '^5.0.0' } }),
  );
  writeFileSync(
    join(dir, 'src', 'App.tsx'),
    'export function App() {\n  return <h1>Welcome</h1>\n}\n',
  );
}

describe('runInit', () => {
  it('detects the framework, extracts strings, and writes locales/en.json', async () => {
    writeViteReactProject();
    const result = await runInit(dir, { apiToken: 'test-token' });
    expect(result).toEqual({
      ok: true,
      framework: 'Vite + React',
      keysWritten: 1,
      locales: [
        { locale: 'de', keysWritten: 0, missingKeys: [], error: null },
        { locale: 'ja', keysWritten: 0, missingKeys: [], error: null },
        { locale: 'es', keysWritten: 0, missingKeys: [], error: null },
        { locale: 'ar', keysWritten: 0, missingKeys: [], error: null },
        { locale: 'pt-BR', keysWritten: 0, missingKeys: [], error: null },
      ],
    });
    const catalog = JSON.parse(
      readFileSync(join(dir, 'locales', 'en.json'), 'utf-8'),
    );
    expect(Object.values(catalog)).toContain('Welcome');
  });

  it('returns ok:false with a clear reason when no framework is detected', async () => {
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ dependencies: { express: '^4.0.0' } }),
    );
    const result = await runInit(dir);
    expect(result).toEqual({
      ok: false,
      reason:
        'No supported framework detected. Supported: Next.js, Vite + React, React Native.',
    });
  });

  it('re-running init on the same project does not duplicate or change existing keys', async () => {
    writeViteReactProject();
    await runInit(dir, { apiToken: 'test-token' });
    const firstRun = JSON.parse(
      readFileSync(join(dir, 'locales', 'en.json'), 'utf-8'),
    );
    const result = await runInit(dir, { apiToken: 'test-token' });
    const secondRun = JSON.parse(
      readFileSync(join(dir, 'locales', 'en.json'), 'utf-8'),
    );
    expect(result.ok).toBe(true);
    expect(secondRun).toEqual(firstRun);
  });

  it('refuses to overwrite locales/en.json when the merge would drop existing keys, and leaves the file unchanged', async () => {
    writeViteReactProject();
    mkdirSync(join(dir, 'locales'), { recursive: true });
    const original = {
      'src.App.welcome': 'Welcome',
      'src.App.stale_key': 'This key no longer matches any extracted string',
    };
    writeFileSync(
      join(dir, 'locales', 'en.json'),
      JSON.stringify(original, null, 2),
    );

    const result = await runInit(dir);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('1 existing key(s) would be removed');
      expect(result.reason).toContain('--force');
    }
    const onDisk = JSON.parse(
      readFileSync(join(dir, 'locales', 'en.json'), 'utf-8'),
    );
    expect(onDisk).toEqual(original);
  });

  it('overwrites and drops stale keys when force is passed', async () => {
    writeViteReactProject();
    mkdirSync(join(dir, 'locales'), { recursive: true });
    const original = {
      'src.App.welcome': 'Welcome',
      'src.App.stale_key': 'This key no longer matches any extracted string',
    };
    writeFileSync(
      join(dir, 'locales', 'en.json'),
      JSON.stringify(original, null, 2),
    );

    const result = await runInit(dir, { force: true, apiToken: 'test-token' });

    expect(result.ok).toBe(true);
    const onDisk = JSON.parse(
      readFileSync(join(dir, 'locales', 'en.json'), 'utf-8'),
    );
    expect(onDisk).toEqual({ 'src.App.welcome': 'Welcome' });
    expect(onDisk).not.toHaveProperty('src.App.stale_key');
  });

  it('fails clearly when no API token is configured', async () => {
    writeViteReactProject();
    const fetchMock = vi.fn();
    stubApi(fetchMock);
    const result = await runInit(dir);
    expect(result).toEqual({
      ok: false,
      reason:
        'No API token configured. Pass --api-token or set the LOCALIZE_API_TOKEN environment variable.',
    });
    // No locale files should have been written, and no network call made.
    //
    // The second half was stated here and never checked. It matters more now
    // that the default API is the production deployment: a run without a
    // token must not send source-derived context anywhere, not even to be
    // refused.
    expect(() =>
      readFileSync(join(dir, 'locales', 'en.json'), 'utf-8'),
    ).toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('runInit API address', () => {
  function stubOkFetch() {
    const fetchMock = vi.fn(async (_url: string) => ({
      ok: true,
      json: async () => ({ translations: [], missingKeys: [] }),
    }));
    stubApi(fetchMock);
    return fetchMock;
  }

  it('sends translation requests to the production API by default', async () => {
    writeViteReactProject();
    const fetchMock = stubOkFetch();

    const result = await runInit(dir, {
      apiToken: 'test-token',
      locales: ['de'],
    });

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalled();
    for (const [url] of fetchMock.mock.calls) {
      expect(url).toBe('https://localize-infra-api.vercel.app/v1/translate');
    }
    vi.unstubAllGlobals();
  });

  it('sends them to an override instead, without doubling the slash', async () => {
    writeViteReactProject();
    const fetchMock = stubOkFetch();

    await runInit(dir, {
      apiUrl: 'http://localhost:8787/',
      apiToken: 'test-token',
      locales: ['de'],
    });

    expect(fetchMock).toHaveBeenCalled();
    for (const [url] of fetchMock.mock.calls) {
      expect(url).toBe('http://localhost:8787/v1/translate');
    }
    vi.unstubAllGlobals();
  });

  it('sends the token only as a bearer header, never in the URL', async () => {
    writeViteReactProject();
    const fetchMock = vi.fn(
      async (_url: string, _init: { headers: Record<string, string> }) => ({
        ok: true,
        json: async () => ({ translations: [], missingKeys: [] }),
      }),
    );
    stubApi(fetchMock);

    await runInit(dir, { apiToken: 'secret-token', locales: ['de'] });

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).not.toContain('secret-token');
    expect(init?.headers.authorization).toBe('Bearer secret-token');
    vi.unstubAllGlobals();
  });
});

describe('runInit with translation', () => {
  it('translates extracted strings into each requested locale and writes locales/<locale>.json', async () => {
    writeViteReactProject();
    // writeViteReactProject()'s fixture is `<h1>Welcome</h1>` in src/App.tsx, so keyFor()
    // deterministically produces this exact key (file-path stem + slugified text) — see
    // Task 2/keyFor in the M1 Phase 1 plan if this ever needs re-deriving.
    const extractedKey = 'src.App.welcome';
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        translations: [{ key: extractedKey, text: 'Willkommen' }],
        missingKeys: [],
      }),
    }));
    stubApi(fetchMock);

    const result = await runInit(dir, {
      apiUrl: 'http://localhost:8787',
      apiToken: 'test-token',
      locales: ['de'],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.locales).toEqual([
        { locale: 'de', keysWritten: 1, missingKeys: [], error: null },
      ]);
    }
    const deCatalog = JSON.parse(
      readFileSync(join(dir, 'locales', 'de.json'), 'utf-8'),
    );
    expect(Object.values(deCatalog)).toContain('Willkommen');

    vi.unstubAllGlobals();
  });

  it('surfaces missingKeys per locale without failing the whole run', async () => {
    writeViteReactProject();
    stubApi(
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          translations: [],
          missingKeys: ['src.App.welcome'],
        }),
      })),
    );

    const result = await runInit(dir, {
      apiUrl: 'http://localhost:8787',
      apiToken: 'test-token',
      locales: ['de'],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.locales[0]?.missingKeys).toEqual(['src.App.welcome']);
    }

    vi.unstubAllGlobals();
  });

  it('defaults to the 5 target locales (de, ja, es, ar, pt-BR) when none are specified', async () => {
    writeViteReactProject();
    const calledLocales: string[] = [];
    stubApi(
      vi.fn(async (_url: string, init: RequestInit) => {
        calledLocales.push(JSON.parse(init.body as string).targetLocale);
        return {
          ok: true,
          json: async () => ({ translations: [], missingKeys: [] }),
        };
      }),
    );

    await runInit(dir, {
      apiUrl: 'http://localhost:8787',
      apiToken: 'test-token',
    });

    expect(calledLocales).toEqual(['de', 'ja', 'es', 'ar', 'pt-BR']);
    vi.unstubAllGlobals();
  });

  it('isolates a failure on one locale so other locales still succeed and are written to disk', async () => {
    writeViteReactProject();
    const extractedKey = 'src.App.welcome';
    stubApi(
      vi.fn(async (_url: string, init: RequestInit) => {
        const { targetLocale } = JSON.parse(init.body as string) as {
          targetLocale: string;
        };
        if (targetLocale === 'ja') {
          return {
            ok: false,
            status: 500,
            text: async () => 'Internal Server Error',
          };
        }
        return {
          ok: true,
          json: async () => ({
            translations: [{ key: extractedKey, text: 'Willkommen' }],
            missingKeys: [],
          }),
        };
      }),
    );

    const result = await runInit(dir, {
      apiUrl: 'http://localhost:8787',
      apiToken: 'test-token',
      locales: ['de', 'ja'],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const de = result.locales.find((l) => l.locale === 'de');
      const ja = result.locales.find((l) => l.locale === 'ja');
      expect(de?.keysWritten).toBeGreaterThan(0);
      expect(de?.error).toBeNull();
      expect(ja?.error).toEqual(expect.any(String));
      expect(ja?.error).toContain('500');
    }

    const deCatalog = JSON.parse(
      readFileSync(join(dir, 'locales', 'de.json'), 'utf-8'),
    );
    expect(Object.values(deCatalog)).toContain('Willkommen');

    vi.unstubAllGlobals();
  });
});

describe('runInit with openPr', () => {
  it('opens a PR with the actually-written locale file contents when openPr is true', async () => {
    writeViteReactProject();
    const extractedKey = 'src.App.welcome';
    const openPrCalls: { url: string; body: unknown }[] = [];
    stubApi(
      vi.fn(async (url: string, init: RequestInit) => {
        const body = JSON.parse(init.body as string) as {
          targetLocale?: string;
        };
        if (url.endsWith('/v1/translate')) {
          return {
            ok: true,
            json: async () => ({
              translations: [{ key: extractedKey, text: 'Willkommen' }],
              missingKeys: [],
            }),
          };
        }
        if (url.endsWith('/v1/open-pr')) {
          openPrCalls.push({ url, body });
          return {
            ok: true,
            json: async () => ({
              prUrl: 'https://github.com/acme/widgets/pull/1',
              prNumber: 1,
            }),
          };
        }
        throw new Error(`Unexpected fetch call to ${url}`);
      }),
    );

    const result = await runInit(dir, {
      apiUrl: 'http://localhost:8787',
      apiToken: 'test-token',
      locales: ['de'],
      openPr: true,
      owner: 'acme',
      repo: 'widgets',
      baseBranch: 'main',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.pr).toEqual({
        prUrl: 'https://github.com/acme/widgets/pull/1',
        prNumber: 1,
      });
    }

    expect(openPrCalls).toHaveLength(1);
    const openPrBody = openPrCalls[0]?.body as {
      owner: string;
      repo: string;
      files: { path: string; content: string }[];
    };
    expect(openPrBody.owner).toBe('acme');
    expect(openPrBody.repo).toBe('widgets');
    expect(openPrBody.files).toHaveLength(1);
    const deFile = openPrBody.files[0];
    expect(deFile?.path).toBe('locales/de.json');
    const deFileContent = JSON.parse(deFile?.content ?? '{}');
    expect(Object.values(deFileContent)).toContain('Willkommen');
    const deCatalogOnDisk = JSON.parse(
      readFileSync(join(dir, 'locales', 'de.json'), 'utf-8'),
    );
    expect(deFileContent).toEqual(deCatalogOnDisk);

    vi.unstubAllGlobals();
  });

  it('excludes a locale whose translation failed from the PR files instead of including it with empty content', async () => {
    writeViteReactProject();
    const extractedKey = 'src.App.welcome';
    const openPrCalls: { url: string; body: unknown }[] = [];
    stubApi(
      vi.fn(async (url: string, init: RequestInit) => {
        if (url.endsWith('/v1/translate')) {
          const { targetLocale } = JSON.parse(init.body as string) as {
            targetLocale: string;
          };
          if (targetLocale === 'ja') {
            return {
              ok: false,
              status: 500,
              text: async () => 'Internal Server Error',
            };
          }
          return {
            ok: true,
            json: async () => ({
              translations: [{ key: extractedKey, text: 'Willkommen' }],
              missingKeys: [],
            }),
          };
        }
        if (url.endsWith('/v1/open-pr')) {
          const body = JSON.parse(init.body as string) as unknown;
          openPrCalls.push({ url, body });
          return {
            ok: true,
            json: async () => ({
              prUrl: 'https://github.com/acme/widgets/pull/1',
              prNumber: 1,
            }),
          };
        }
        throw new Error(`Unexpected fetch call to ${url}`);
      }),
    );

    const result = await runInit(dir, {
      apiUrl: 'http://localhost:8787',
      apiToken: 'test-token',
      locales: ['de', 'ja'],
      openPr: true,
      owner: 'acme',
      repo: 'widgets',
      baseBranch: 'main',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const ja = result.locales.find((l) => l.locale === 'ja');
      expect(ja?.error).toEqual(expect.any(String));
    }

    const openPrBody = openPrCalls[0]?.body as {
      files: { path: string; content: string }[];
    };
    expect(openPrBody.files).toHaveLength(1);
    expect(openPrBody.files[0]?.path).toBe('locales/de.json');
    expect(openPrBody.files.some((f) => f.path === 'locales/ja.json')).toBe(
      false,
    );

    vi.unstubAllGlobals();
  });

  it('returns cleanly without a pr and without throwing when every locale translation fails', async () => {
    writeViteReactProject();
    const openPrCalls: { url: string; body: unknown }[] = [];
    stubApi(
      vi.fn(async (url: string, init: RequestInit) => {
        if (url.endsWith('/v1/translate')) {
          return {
            ok: false,
            status: 500,
            text: async () => 'Internal Server Error',
          };
        }
        if (url.endsWith('/v1/open-pr')) {
          const body = JSON.parse(init.body as string) as unknown;
          openPrCalls.push({ url, body });
          return {
            ok: true,
            json: async () => ({
              prUrl: 'https://github.com/acme/widgets/pull/1',
              prNumber: 1,
            }),
          };
        }
        throw new Error(`Unexpected fetch call to ${url}`);
      }),
    );

    const result = await runInit(dir, {
      apiUrl: 'http://localhost:8787',
      apiToken: 'test-token',
      locales: ['de', 'ja'],
      openPr: true,
      owner: 'acme',
      repo: 'widgets',
      baseBranch: 'main',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.pr).toBeUndefined();
      expect(result.locales).toHaveLength(2);
      for (const localeResult of result.locales) {
        expect(localeResult.error).toEqual(expect.any(String));
      }
    }
    expect(openPrCalls).toHaveLength(0);

    vi.unstubAllGlobals();
  });

  it('fails fast with owner/repo missing before any translation API calls are made', async () => {
    writeViteReactProject();
    let translateCalls = 0;
    stubApi(
      vi.fn(async (url: string) => {
        if (url.endsWith('/v1/translate')) translateCalls++;
        return {
          ok: true,
          json: async () => ({ translations: [], missingKeys: [] }),
        };
      }),
    );

    const result = await runInit(dir, {
      apiUrl: 'http://localhost:8787',
      apiToken: 'test-token',
      openPr: true,
      owner: '',
      repo: '',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('--owner');
      expect(result.reason).toContain('--repo');
    }
    // Zero billed translation calls: the failure must happen before the
    // per-locale translation loop, not just before the /v1/open-pr call.
    expect(translateCalls).toBe(0);
    // No locale files should have been written either.
    expect(() =>
      readFileSync(join(dir, 'locales', 'de.json'), 'utf-8'),
    ).toThrow();

    vi.unstubAllGlobals();
  });

  it('never calls /v1/open-pr when openPr is not set', async () => {
    writeViteReactProject();
    const calledUrls: string[] = [];
    stubApi(
      vi.fn(async (url: string) => {
        calledUrls.push(url);
        return {
          ok: true,
          json: async () => ({ translations: [], missingKeys: [] }),
        };
      }),
    );

    const result = await runInit(dir, {
      apiUrl: 'http://localhost:8787',
      apiToken: 'test-token',
      locales: ['de'],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.pr).toBeUndefined();
    }
    expect(calledUrls.some((url) => url.endsWith('/v1/open-pr'))).toBe(false);

    vi.unstubAllGlobals();
  });
});

/*
 * What happens before anything is written or paid for, and what happens when
 * the pull request fails after the translations are done.
 */
describe('runInit with a personal token', () => {
  type Route = { status: number; body: unknown };
  function api(routes: Record<string, Route>) {
    const calls: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => {
      calls.push(url);
      const path = new URL(url).pathname;
      const route = routes[path] ?? { status: 404, body: '404 Not Found' };
      const text =
        typeof route.body === 'string'
          ? route.body
          : JSON.stringify(route.body);
      return {
        ok: route.status >= 200 && route.status < 300,
        status: route.status,
        text: async () => text,
        json: async () => JSON.parse(text),
      };
    });
    return calls;
  }
  const translated: Route = {
    status: 200,
    body: {
      translations: [{ key: 'src.App.welcome', text: 'Willkommen' }],
      missingKeys: [],
    },
  };
  const workspace = (githubConnected: boolean): Route => ({
    status: 200,
    body: { kind: 'workspace', workspace: 'acme', githubConnected },
  });
  const prOptions = {
    apiUrl: 'https://api.test',
    apiToken: `lit_${'A'.repeat(43)}`,
    locales: ['de'],
    openPr: true,
    owner: 'acme',
    repo: 'widgets',
  };
  const enJson = () => join(dir, 'locales', 'en.json');

  it('refuses a revoked token before writing or translating anything', async () => {
    writeViteReactProject();
    const calls = api({
      '/v1/whoami': {
        status: 401,
        body: { error: 'This CLI token is invalid, expired or revoked.' },
      },
      '/v1/translate': translated,
    });

    const result = await runInit(dir, { ...prOptions, openPr: false });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('invalid, expired or revoked');
      expect(result.reason).not.toContain(prOptions.apiToken);
    }
    expect(calls.some((u) => u.endsWith('/v1/translate'))).toBe(false);
    expect(() => readFileSync(enJson(), 'utf-8')).toThrow();
    vi.unstubAllGlobals();
  });

  it('reports the workspace the token acts for', async () => {
    writeViteReactProject();
    api({ '/v1/whoami': workspace(true), '/v1/translate': translated });

    const result = await runInit(dir, { ...prOptions, openPr: false });

    expect(result.ok && result.workspace).toBe('acme');
    vi.unstubAllGlobals();
  });

  it('refuses --open-pr for a workspace with no GitHub connection, before translating', async () => {
    writeViteReactProject();
    const calls = api({
      '/v1/whoami': workspace(false),
      '/v1/translate': translated,
    });

    const result = await runInit(dir, prOptions);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/no GitHub connection/);
    expect(calls.some((u) => u.endsWith('/v1/translate'))).toBe(false);
    vi.unstubAllGlobals();
  });

  it('refuses an unreachable repository before translating, with the API’s sentence', async () => {
    writeViteReactProject();
    const calls = api({
      '/v1/whoami': workspace(true),
      '/v1/open-pr/preflight': {
        status: 404,
        body: {
          error:
            'acme/widgets is not reachable by the GitHub installation connected to workspace "acme".',
        },
      },
      '/v1/translate': translated,
    });

    const result = await runInit(dir, prOptions);

    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.reason).toContain('acme/widgets is not reachable');
    expect(calls.some((u) => u.endsWith('/v1/translate'))).toBe(false);
    expect(() => readFileSync(enJson(), 'utf-8')).toThrow();
    vi.unstubAllGlobals();
  });

  it('says the API could not be reached, rather than that it refused', async () => {
    writeViteReactProject();
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        calls.push(url);
        throw new TypeError('fetch failed');
      }),
    );

    const result = await runInit(dir, { ...prOptions, openPr: false });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/^Could not reach the API at /);
      expect(result.reason).toContain('fetch failed');
      expect(result.reason).not.toMatch(/Refused/);
    }
    // One question, then nothing: no translation attempted, nothing written.
    expect(calls).toHaveLength(1);
    expect(() => readFileSync(enJson(), 'utf-8')).toThrow();
    vi.unstubAllGlobals();
  });

  it('keeps the translation result when the pull request fails afterwards', async () => {
    writeViteReactProject();
    api({
      '/v1/whoami': workspace(true),
      '/v1/open-pr/preflight': { status: 200, body: { ok: true } },
      '/v1/translate': translated,
      '/v1/open-pr': {
        status: 403,
        body: { error: 'GitHub refused to write to acme/widgets (403).' },
      },
    });

    const result = await runInit(dir, prOptions);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.locales).toEqual([
        { locale: 'de', keysWritten: 1, missingKeys: [], error: null },
      ]);
      expect(result.prError).toContain('GitHub refused to write');
      expect(result.pr).toBeUndefined();
    }
    const de = JSON.parse(
      readFileSync(join(dir, 'locales', 'de.json'), 'utf-8'),
    );
    expect(Object.values(de)).toContain('Willkommen');
    vi.unstubAllGlobals();
  });

  it('still works against an API that predates whoami and preflight', async () => {
    writeViteReactProject();
    api({
      '/v1/translate': translated,
      '/v1/open-pr': {
        status: 200,
        body: { prUrl: 'https://github.com/acme/widgets/pull/3', prNumber: 3 },
      },
    });

    const result = await runInit(dir, prOptions);

    expect(result.ok && result.pr?.prNumber).toBe(3);
    vi.unstubAllGlobals();
  });
});
