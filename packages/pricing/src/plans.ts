import { costPerThousandPairs, margin } from './model.js';

/**
 * The proposed MVP plans, derived from cost rather than from round numbers.
 *
 * Every allowance is in **string-locale pairs**, because that is the unit the
 * bill is made of: a string translated into 25 languages costs 25 times a
 * string translated into one, so any cap written in strings is wrong for the
 * customer who adds a language.
 *
 * Every cap is a **compute guard, not a value meter**. Invariant 3 forbids
 * billing per word, character or reviewer, and billing per pair beyond a cap
 * would be billing per string — the model this product exists to replace. At
 * the cap the run stops and offers the next tier; nothing is charged that the
 * customer did not choose.
 *
 * These are proposals. `docs/product/08-critique.md` §C1 still stands: nobody
 * has been interviewed, and the prices remain hypotheses with no
 * willingness-to-pay evidence behind them. What has changed is that they are no
 * longer *unpriced* hypotheses.
 */
export interface Plan {
  name: string;
  monthlyPrice: number;
  /** Two months free — what converts the riskiest cohort into the safest. */
  annualPrice: number;
  projects: number;
  /** `null` means no limit on locales; the pair allowance still binds. */
  locales: number | null;
  /**
   * A one-time allowance, separate from the monthly one.
   *
   * The first run is where the multiplicative cost lands, it happens once, and
   * folding it into the monthly number forces that number to be either too
   * small to onboard anybody or too large to be safe.
   */
  initialImportPairs: number;
  monthlyPairs: number;
  /**
   * Roughly a tenth of the monthly allowance, so no single day can consume a
   * month. This is what bounds the adversarial case.
   */
  dailyPairCeiling: number;
}

export const PLANS: readonly Plan[] = [
  {
    name: 'Free',
    monthlyPrice: 0,
    annualPrice: 0,
    projects: 1,
    locales: 3,
    initialImportPairs: 1_000,
    monthlyPairs: 300,
    dailyPairCeiling: 300,
  },
  {
    name: 'Starter',
    monthlyPrice: 19,
    annualPrice: 190,
    projects: 1,
    locales: 6,
    initialImportPairs: 6_000,
    monthlyPairs: 3_000,
    dailyPairCeiling: 1_000,
  },
  {
    name: 'Team',
    monthlyPrice: 99,
    annualPrice: 990,
    projects: 5,
    locales: 15,
    initialImportPairs: 40_000,
    monthlyPairs: 15_000,
    dailyPairCeiling: 5_000,
  },
  {
    name: 'Scale',
    monthlyPrice: 399,
    annualPrice: 3_990,
    projects: 20,
    locales: null,
    initialImportPairs: 150_000,
    monthlyPairs: 60_000,
    dailyPairCeiling: 20_000,
  },
] as const;

export interface PlanEconomics {
  name: string;
  monthlyPrice: number;
  /** What the plan costs to serve if the customer uses every pair allowed. */
  worstMonthlyCogs: number;
  grossMarginPercentAtCap: number;
  /** The one-time import, priced. */
  initialImportCogs: number;
  /** What a day at the ceiling costs, every day, for a month. */
  worstMonthIfDailyCeilingHitDaily: number;
  /**
   * Whether the monthly allowance actually binds before the daily ceiling
   * could outrun it. If false, the daily ceiling is decorative.
   */
  monthlyCapBinds: boolean;
}

export function planEconomics(plan: Plan): PlanEconomics {
  const perPair = costPerThousandPairs() / 1000;
  const worstMonthlyCogs = plan.monthlyPairs * perPair;

  return {
    name: plan.name,
    monthlyPrice: plan.monthlyPrice,
    worstMonthlyCogs,
    grossMarginPercentAtCap: margin(plan.monthlyPrice, worstMonthlyCogs)
      .grossMarginPercent,
    initialImportCogs: plan.initialImportPairs * perPair,
    worstMonthIfDailyCeilingHitDaily: plan.dailyPairCeiling * 30 * perPair,
    // The daily ceiling exists to stop a burst; the monthly allowance is what
    // actually bounds the bill. If 30 days at the ceiling came in under the
    // monthly allowance, the ceiling would be the only limit and it would be
    // set too high.
    monthlyCapBinds: plan.dailyPairCeiling * 30 > plan.monthlyPairs,
  };
}
