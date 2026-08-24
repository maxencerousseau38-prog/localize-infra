import type { ScoreComponent } from './pain.js';

/**
 * How well a company fits, as arithmetic somebody can argue with.
 *
 * Two rules shape everything here. First, no component may award points
 * without naming the observation that earned them — `closer_record_score`
 * refuses a breakdown that does not sum to the value claimed, so an
 * unexplainable score is not storable. Second, **a component with no evidence
 * scores zero and says so**, rather than being dropped from the list.
 *
 * That second rule is the important one. The brief's example weights seven
 * components to a hundred, and discovery gathers evidence for four of them.
 * Silently omitting the other three would produce a number out of seventy
 * presented as a number out of a hundred, and every company would look worse
 * than it is by exactly the amount nobody measured. Listing them at zero with
 * "not assessed" keeps the arithmetic honest and names the gap.
 */

export interface IcpWeights {
  localizationComplexity: number;
  localeCount: number;
  engineeringActivity: number;
  localizationPain: number;
  teamFit: number;
  internationalSignals: number;
  buyingIntent: number;
}

/**
 * The weights in force, and configurable rather than compiled in.
 *
 * Stored alongside every score in `closer_scores.weights`, so a score computed
 * last month stays readable after these change. Changing them silently would
 * make two scores incomparable while both still looked like numbers out of a
 * hundred.
 */
export const DEFAULT_ICP_WEIGHTS: IcpWeights = {
  localizationComplexity: 25,
  localeCount: 15,
  engineeringActivity: 15,
  localizationPain: 15,
  teamFit: 10,
  internationalSignals: 10,
  buyingIntent: 10,
};

export interface IcpInputs {
  /** Distinct locales the repository ships. */
  localeCount: number;
  /** Localisation signals found, from `detectLocalizationSignals`. */
  signalLabels: readonly string[];
  /** Commits anywhere in the repository over `windowDays`. */
  commitsInWindow: number;
  windowDays: number;
  /** 0–100, from `painScore`. */
  painValue: number;
  /** Mean confidence of the pain evidence, 0–1. */
  painConfidence: number;
}

export interface IcpScore {
  /** Points earned, 0–100. Sums the breakdown exactly. */
  value: number;
  /** Points that could be assessed at all, given what discovery collects. */
  assessable: number;
  confidence: number;
  breakdown: ScoreComponent[];
  /** Components with no evidence source yet, named rather than hidden. */
  notAssessed: string[];
}

/** Points on a scale, rounded, never above the maximum. */
function scale(fraction: number, max: number): number {
  return Math.min(max, Math.round(Math.max(0, fraction) * max));
}

export function scoreIcp(
  inputs: IcpInputs,
  weights: IcpWeights = DEFAULT_ICP_WEIGHTS,
): IcpScore {
  const breakdown: ScoreComponent[] = [];
  const notAssessed: string[] = [];

  /*
   * Complexity: how many *kinds* of localisation machinery are in play.
   *
   * Counted as distinct signal labels rather than as files. A repository with
   * four hundred locale files and one library is one decision repeated; one
   * with a library, gettext files and a message directory has a pipeline, and
   * a pipeline is what breaks.
   */
  const distinct = new Set(inputs.signalLabels).size;
  breakdown.push({
    component: 'localization_complexity',
    points: scale(distinct / 4, weights.localizationComplexity),
    max: weights.localizationComplexity,
    why: `${distinct} distinct localisation signal(s)`,
  });

  /*
   * Locales: full marks at eight.
   *
   * Not linear to fifty. The difference between two locales and eight is the
   * difference between an experiment and a commitment; the difference between
   * eight and forty is mostly the same problem, larger.
   */
  breakdown.push({
    component: 'locale_count',
    points: scale(inputs.localeCount / 8, weights.localeCount),
    max: weights.localeCount,
    why: `${inputs.localeCount} locale(s)`,
  });

  /*
   * Activity: is anybody still shipping?
   *
   * Full marks at thirty commits in the window. A repository nobody touches has
   * no localisation problem worth solving, whatever else it carries.
   */
  breakdown.push({
    component: 'engineering_activity',
    points: scale(inputs.commitsInWindow / 30, weights.engineeringActivity),
    max: weights.engineeringActivity,
    why: `${inputs.commitsInWindow} commit(s) in ${inputs.windowDays} days`,
  });

  breakdown.push({
    component: 'localization_pain',
    points: scale(inputs.painValue / 100, weights.localizationPain),
    max: weights.localizationPain,
    why:
      inputs.painValue > 0
        ? `pain score ${inputs.painValue}/100`
        : 'no evidence of translation friction',
  });

  /*
   * The three nobody measured.
   *
   * Team size needs a company page or a job board; international signals need a
   * website; buying intent needs a conversation. Discovery reads repositories,
   * so all three are zero and say why. A score that quietly omitted them would
   * be out of seventy while looking like it was out of a hundred.
   */
  const unmeasured: [keyof IcpWeights, string, string][] = [
    [
      'teamFit',
      'team_fit',
      'no team-size source: discovery reads repositories',
    ],
    [
      'internationalSignals',
      'international_signals',
      'no website or market research collected yet',
    ],
    [
      'buyingIntent',
      'buying_intent',
      'no conversation has happened; intent is scored separately once one has',
    ],
  ];

  for (const [weightKey, component, why] of unmeasured) {
    breakdown.push({
      component,
      points: 0,
      max: weights[weightKey],
      why: `Not assessed — ${why}`,
    });
    notAssessed.push(component);
  }

  const value = breakdown.reduce((total, c) => total + c.points, 0);
  const assessable =
    weights.localizationComplexity +
    weights.localeCount +
    weights.engineeringActivity +
    weights.localizationPain;

  /*
   * Confidence is about the inputs, not about the arithmetic.
   *
   * Locale counts and commit counts are read directly and are certain; the pain
   * component carries whatever confidence its evidence had. The result is
   * weighted by how much of the score each contributed, so a company scored
   * mostly on counting is more confident than one scored mostly on inference.
   */
  const painPoints =
    breakdown.find((c) => c.component === 'localization_pain')?.points ?? 0;
  const certainPoints = value - painPoints;
  const confidence =
    value === 0
      ? 0
      : (certainPoints * 1 + painPoints * (inputs.painConfidence || 0)) / value;

  return {
    value,
    assessable,
    confidence: Number(confidence.toFixed(3)),
    breakdown,
    notAssessed,
  };
}
