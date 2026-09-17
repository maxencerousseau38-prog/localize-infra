import { describe, expect, it } from 'vitest';
import type { InitResult } from './commands/init.js';
import { exitCodeFor } from './outcome.js';

const ok = (
  locales: { error: string | null }[],
  extra: Partial<Extract<InitResult, { ok: true }>> = {},
): InitResult => ({
  ok: true,
  framework: 'Vite + React',
  keysWritten: 3,
  locales: locales.map((l, i) => ({
    locale: `l${i}`,
    keysWritten: l.error ? 0 : 3,
    missingKeys: [],
    error: l.error,
  })),
  ...extra,
});

describe('exitCodeFor', () => {
  it('is 1 when init refused to start', () => {
    expect(exitCodeFor({ ok: false, reason: 'No API token configured.' })).toBe(
      1,
    );
  });

  /*
   * The case that used to exit 0: a revoked token, or the API unreachable,
   * printed FAILED for every locale and told CI the run had succeeded.
   */
  it('is 1 when no locale was translated', () => {
    expect(exitCodeFor(ok([{ error: '401' }, { error: 'fetch failed' }]))).toBe(
      1,
    );
  });

  it('is 0 when every locale was translated', () => {
    expect(exitCodeFor(ok([{ error: null }, { error: null }]))).toBe(0);
  });

  it('is 0 for a partial run, whose lines say which locale failed', () => {
    expect(exitCodeFor(ok([{ error: null }, { error: 'timeout' }]))).toBe(0);
  });

  it('is 1 when a pull request was asked for and could not be opened', () => {
    expect(
      exitCodeFor(ok([{ error: null }], { prError: 'GitHub refused (403)' })),
    ).toBe(1);
  });

  it('is 0 when the pull request was opened, or there was nothing to open', () => {
    expect(
      exitCodeFor(
        ok([{ error: null }], {
          pr: { prUrl: 'https://github.com/o/r/pull/1', prNumber: 1 },
        }),
      ),
    ).toBe(0);
    expect(exitCodeFor(ok([{ error: null }]))).toBe(0);
  });
});
