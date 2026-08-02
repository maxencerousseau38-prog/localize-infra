import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runInit } from './init.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cli-init-'));
  mkdirSync(join(dir, 'src'), { recursive: true });
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
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
});
