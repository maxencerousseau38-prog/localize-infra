import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Pins the Settings surface to the CLI it describes.
 *
 * `apps/web/src/lib/cli-config.ts` reports the CLI's real defaults read-only —
 * target locales, API URL, base branch, locale directory. That is only honest
 * while the two agree. A default changed in `packages/cli` and not here would
 * turn the one surface that claims to be real into the most confidently wrong
 * page in the product.
 *
 * The web app cannot import these directly: they are module-private constants
 * in a Node CLI whose dependency tree has no business in a browser bundle. So
 * the values are duplicated and this test makes the duplication safe, the same
 * way the benchmark artifact is pinned to its generator.
 */
const REPO_ROOT = join(import.meta.dirname, '../../..');

const cliSource = readFileSync(
  join(REPO_ROOT, 'packages/cli/src/commands/init.ts'),
  'utf8',
);
// The API URL default moved here from init.ts on 2026-09-16, so that `init`
// and the usage text read one constant.
const cliConfigSource = readFileSync(
  join(REPO_ROOT, 'packages/cli/src/config.ts'),
  'utf8',
);
const coreSource = readFileSync(
  join(REPO_ROOT, 'packages/core/src/detect/index.ts'),
  'utf8',
);
const settingsSource = readFileSync(
  join(REPO_ROOT, 'apps/web/src/lib/cli-config.ts'),
  'utf8',
);

describe('settings reports the CLI it describes', () => {
  it('reads the sources it is meant to compare', () => {
    expect(cliSource).toContain('DEFAULT_LOCALES');
    expect(settingsSource).toContain('TRANSLATION_CONFIG');
  });

  it('lists the same target locales the CLI defaults to', () => {
    const declared = cliSource.match(/const DEFAULT_LOCALES = \[(.*?)\]/s)?.[1];
    expect(declared).toBeTruthy();

    const locales = [...(declared ?? '').matchAll(/'([^']+)'/g)].map(
      (m) => m[1] as string,
    );
    expect(locales.length).toBeGreaterThan(0);

    // Displayed as a comma-separated list, so each code must appear.
    for (const locale of locales) {
      expect(settingsSource, `locale ${locale}`).toContain(locale);
    }
  });

  it('reports the API URL the CLI actually defaults to', () => {
    const url = cliConfigSource.match(
      /export const DEFAULT_API_URL = '([^']+)'/,
    )?.[1];
    expect(url).toBeTruthy();
    expect(settingsSource).toContain(`'${url}'`);
    // init must use that constant rather than a literal of its own, or the
    // comparison above would pin a value nothing reads.
    expect(cliSource).toContain('resolveApiUrl(options?.apiUrl)');
    expect(cliSource).not.toMatch(/https?:\/\/[^'"\s]+:\d+/);
  });

  it('reports the base branch the CLI actually defaults to', () => {
    const branch = cliSource.match(
      /baseBranch: options\.baseBranch \?\? '([^']+)'/,
    )?.[1];
    expect(branch).toBeTruthy();
    expect(settingsSource).toContain(`'${branch}'`);
  });

  it('reports the locale directory core actually writes to', () => {
    const dirs = [...coreSource.matchAll(/localesDir: '([^']+)'/g)].map(
      (m) => m[1] as string,
    );
    expect(dirs.length).toBeGreaterThan(0);

    // Settings claims this is the same for every framework; if core ever
    // disagrees, that sentence becomes false.
    expect(
      new Set(dirs).size,
      `core uses ${[...new Set(dirs)].join(', ')}`,
    ).toBe(1);
    expect(settingsSource).toContain(`${dirs[0]}/`);
  });

  it('names the environment variable the CLI actually reads', () => {
    expect(cliSource + settingsSource).toContain('LOCALIZE_API_TOKEN');
  });

  it('lists every framework core can detect', () => {
    const names = [...coreSource.matchAll(/name: '([^']+)'/g)].map(
      (m) => m[1] as string,
    );
    expect(names.length).toBeGreaterThan(0);

    for (const name of names) {
      expect(settingsSource, `framework ${name}`).toContain(name);
    }
  });
});
