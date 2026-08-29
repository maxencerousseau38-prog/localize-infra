import { pendingKeys } from '@localize-infra/core';

/**
 * What a repository would need translating, counted before anything is.
 *
 * The brief's first-value screen wants real numbers — keys, locales, what is
 * missing — shown before a developer commits to a run. The pipeline already
 * computes all of it, but only *during* a run, interleaved with model calls
 * that cost money. This is the same arithmetic without them.
 *
 * The one property that matters: **the number shown here must be the number
 * the run will act on.** It is computed with `pendingKeys`, the same function
 * the run uses to decide what to send, rather than with a second rule that
 * happens to agree today. A scan that promised 37 and a run that translated 41
 * would be worse than no scan at all.
 */

export interface LocaleCoverage {
  locale: string;
  /** Keys in the source catalog. The denominator. */
  total: number;
  /** Keys this locale already has. */
  translated: number;
  /** Keys a run would send to the model. */
  missing: number;
  /** Rounded down, so 99.6% never reads as complete. */
  percent: number;
}

export interface Coverage {
  /** Distinct keys extracted from the source. */
  keys: number;
  locales: LocaleCoverage[];
  /** Across every target locale. What a run would cost. */
  totalMissing: number;
  /** True when every target locale has every key. */
  complete: boolean;
}

export function buildCoverage(
  source: Record<string, string>,
  existing: Readonly<Record<string, Record<string, string>>>,
  targetLocales: readonly string[],
): Coverage {
  const keys = Object.keys(source).length;

  const locales = targetLocales.map((locale) => {
    const have = existing[locale] ?? {};
    const missing = pendingKeys(source, have).length;
    const translated = keys - missing;
    return {
      locale,
      total: keys,
      translated,
      missing,
      /*
       * Floored rather than rounded. A repository at 99.6% is not finished, and
       * a screen that says 100% while a run still has work to do is the kind of
       * confident wrong number this codebase has had to remove before.
       */
      percent: keys === 0 ? 100 : Math.floor((translated / keys) * 100),
    };
  });

  const totalMissing = locales.reduce((sum, l) => sum + l.missing, 0);

  return {
    keys,
    locales,
    totalMissing,
    /*
     * A project with no target locales is not complete, it is unconfigured.
     * `totalMissing === 0` alone said complete for an empty list — the sum of
     * nothing is zero — so a scan of a project that could not translate
     * anything reported that everything was translated.
     */
    complete: targetLocales.length > 0 && totalMissing === 0,
  };
}
