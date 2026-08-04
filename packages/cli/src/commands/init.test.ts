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

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cli-init-'));
  mkdirSync(join(dir, 'src'), { recursive: true });
  // Default fetch stub so the original (pre-translation) tests below stay
  // hermetic now that runInit always calls the translation API after
  // writing locales/en.json. Tests that care about translation behavior
  // override this with their own vi.stubGlobal('fetch', ...).
  vi.stubGlobal(
    'fetch',
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
    const result = await runInit(dir);
    expect(result).toEqual({
      ok: false,
      reason:
        'No API token configured. Pass --api-token or set the LOCALIZE_API_TOKEN environment variable.',
    });
    // No locale files should have been written, and no network call made.
    expect(() =>
      readFileSync(join(dir, 'locales', 'en.json'), 'utf-8'),
    ).toThrow();
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
    vi.stubGlobal('fetch', fetchMock);

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
    vi.stubGlobal(
      'fetch',
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
    vi.stubGlobal(
      'fetch',
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
    vi.stubGlobal(
      'fetch',
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
    vi.stubGlobal(
      'fetch',
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
    vi.stubGlobal(
      'fetch',
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
    vi.stubGlobal(
      'fetch',
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

  it('never calls /v1/open-pr when openPr is not set', async () => {
    writeViteReactProject();
    const calledUrls: string[] = [];
    vi.stubGlobal(
      'fetch',
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
