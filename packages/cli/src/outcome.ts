import type { InitResult } from './commands/init.js';

/**
 * The process exit code for a run.
 *
 * `init` used to exit 0 whenever it got as far as trying to translate — so a
 * run with a revoked token, or with the API unreachable, printed FAILED for
 * every locale and still told a CI job it had succeeded.
 *
 * Non-zero when:
 * - `init` refused to start;
 * - no locale was translated (a partial run, some locales failing and some
 *   succeeding, still exits 0 — its per-locale lines say which);
 * - a pull request was asked for and could not be opened.
 */
export function exitCodeFor(result: InitResult): 0 | 1 {
  if (!result.ok) return 1;
  const attempted = result.locales.length;
  const succeeded = result.locales.filter((l) => l.error === null).length;
  if (attempted > 0 && succeeded === 0) return 1;
  if (result.prError) return 1;
  return 0;
}
