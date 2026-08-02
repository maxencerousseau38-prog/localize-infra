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
    const result = await runInit(dir);
    expect(result).toEqual({
      ok: true,
      framework: 'Vite + React',
      keysWritten: 1,
      locales: [
        { locale: 'de', keysWritten: 0, missingKeys: [] },
        { locale: 'ja', keysWritten: 0, missingKeys: [] },
        { locale: 'es', keysWritten: 0, missingKeys: [] },
        { locale: 'ar', keysWritten: 0, missingKeys: [] },
        { locale: 'pt-BR', keysWritten: 0, missingKeys: [] },
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
    await runInit(dir);
    const firstRun = JSON.parse(
      readFileSync(join(dir, 'locales', 'en.json'), 'utf-8'),
    );
    const result = await runInit(dir);
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

    const result = await runInit(dir, { force: true });

    expect(result.ok).toBe(true);
    const onDisk = JSON.parse(
      readFileSync(join(dir, 'locales', 'en.json'), 'utf-8'),
    );
    expect(onDisk).toEqual({ 'src.App.welcome': 'Welcome' });
    expect(onDisk).not.toHaveProperty('src.App.stale_key');
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
      locales: ['de'],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.locales).toEqual([
        { locale: 'de', keysWritten: 1, missingKeys: [] },
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

    await runInit(dir, { apiUrl: 'http://localhost:8787' });

    expect(calledLocales).toEqual(['de', 'ja', 'es', 'ar', 'pt-BR']);
    vi.unstubAllGlobals();
  });
});
