import type { CustomerShape } from './model.js';

/**
 * Four customers, spanning what this product will actually meet.
 *
 * Shapes rather than forecasts: none of these is a prediction about demand.
 * Each exists to answer one question — is there a usage pattern at this price
 * that loses money — and the honest answer needs the tails, not the middle.
 *
 * String counts are sized from what a real repository holds rather than from a
 * round number. The corpus in `packages/eval` was drawn from Excalidraw and
 * peers; an application of that kind carries low thousands of UI strings, and
 * `localize-infra-fixture-vite`, the repository behind the pull request on the
 * landing page, carries a handful.
 */
export const SCENARIOS: CustomerShape[] = [
  {
    /**
     * Someone evaluating the product on a side project. This is what the free
     * tier has to survive, because most signups will be this and will never
     * become anything else.
     */
    name: 'low',
    projectStrings: 120,
    locales: 2,
    projects: 1,
    newStringsPerMonth: 15,
    emptyRunsPerMonth: 4,
  },
  {
    /**
     * The customer the pricing is designed around: one real application, a
     * handful of languages, a normal release cadence.
     */
    name: 'normal',
    projectStrings: 800,
    locales: 5,
    projects: 1,
    newStringsPerMonth: 60,
    emptyRunsPerMonth: 20,
  },
  {
    /**
     * A team shipping several products in many languages, running on every
     * merge. Within what a subscription should cover — this is a good customer,
     * not an abusive one, and the plan has to hold at this shape.
     */
    name: 'heavy',
    projectStrings: 2500,
    locales: 12,
    projects: 4,
    newStringsPerMonth: 250,
    emptyRunsPerMonth: 120,
  },
  {
    /**
     * Not the adversarial case — the *realistic worst* one: a large monorepo,
     * every language the company ships, CI wired to run the pipeline on every
     * merge to main. Nobody here is trying to abuse anything, which is exactly
     * what makes it the dangerous shape. It arrives as an ordinary enterprise
     * trial.
     *
     * The unbounded adversarial case (§C3's "1M strings × 10 locales") is not
     * modelled as a customer because it is not a customer; it is what the daily
     * cap exists to make impossible, and it is priced separately.
     */
    name: 'worst-realistic',
    projectStrings: 12000,
    locales: 25,
    projects: 10,
    newStringsPerMonth: 900,
    emptyRunsPerMonth: 400,
  },
];

/**
 * Candidate prices, in US dollars per month.
 *
 * These are the figures §C3 recorded as "hypotheses with no willingness-to-pay
 * evidence". They are still hypotheses — this model can say whether a price
 * survives its own costs, which is necessary and nowhere near sufficient. It
 * cannot say whether anybody will pay it.
 */
export const CANDIDATE_PRICES = [19, 99, 399] as const;
