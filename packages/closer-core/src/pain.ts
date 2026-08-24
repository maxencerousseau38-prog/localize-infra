/**
 * Turning repository history into evidence that localisation is costing
 * somebody time.
 *
 * This is the file the brief's section 7 is about. `signals.ts` finds that a
 * team localises; it cannot find that localising hurts, and treating the two as
 * one is how a prospecting system ends up telling a company about a problem it
 * does not have. The difference is history: a repository with nine locales and
 * no translation commit in two years is finished, not suffering.
 *
 * Every detector here returns what it counted and over what window, so the
 * claim reduces to arithmetic somebody can check against the commit list. None
 * of them says "they have a problem"; they say "this many commits touched
 * translations in thirty days", and the reader draws the conclusion.
 */

export interface CommitRecord {
  /** ISO date the commit was authored. */
  date: string;
  /** First line of the message. */
  message: string;
}

export interface PainInput {
  /** Commits that touched a localisation path, newest first. */
  localeCommits: readonly CommitRecord[];
  /** Commits anywhere in the repository, newest first. Used for the ratio. */
  allCommits: readonly CommitRecord[];
  /** Window the two lists cover, in days. */
  windowDays: number;
  /** When the repository was last pushed to at all. */
  lastPushedAt: string | null;
  /** Evaluated against this instant, so tests are not time-dependent. */
  now?: Date;
}

export type PainSeverity = 'low' | 'medium' | 'high';

export interface PainEvidence {
  label: string;
  summary: string;
  severity: PainSeverity;
  /**
   * How sure the detector is that what it counted means what it says. Always a
   * number here, unlike a localisation signal: every one of these is an
   * inference from activity, never a fact read from a manifest.
   */
  confidence: number;
}

/**
 * Messages that describe translation work rather than a feature that happens
 * to touch a locale file.
 *
 * Matched on the message and not only on the path, because the path already
 * told us the file changed. What this adds is intent: "add Spanish" and
 * "sync translations" are somebody doing localisation as a task.
 */
const TRANSLATION_WORK =
  /\b(translat\w*|i18n|l10n|locale[sd]?|localis\w*|localiz\w*|lang(uage)?s?)\b/i;

/** Messages that say the work was manual rather than generated. */
const BY_HAND =
  /\b(manual\w*|by hand|fix(ed|es)? typo|correct\w* (the )?translation)\b/i;

function daysBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / 86_400_000;
}

/**
 * How stale a repository's translations are relative to the repository itself.
 *
 * A team that ships every week and last touched a locale nine months ago is
 * either done translating or has stopped keeping up, and the second is the
 * interesting one. Reported as an observation rather than a diagnosis, because
 * this cannot tell the two apart.
 */
function stalenessEvidence(input: PainInput, now: Date): PainEvidence | null {
  const newestLocale = input.localeCommits[0];
  if (!newestLocale || !input.lastPushedAt) return null;

  const localeAge = daysBetween(now, new Date(newestLocale.date));
  const repoAge = daysBetween(now, new Date(input.lastPushedAt));
  const gap = localeAge - repoAge;

  // Under two months is ordinary release rhythm rather than drift.
  if (gap < 60) return null;

  return {
    label: 'stale_translations',
    summary: `Last translation change ${Math.round(localeAge)} days ago; the repository was pushed to ${Math.round(repoAge)} days ago`,
    severity: gap >= 180 ? 'high' : 'medium',
    // The gap is a fact; that it means neglect rather than completion is not.
    confidence: gap >= 180 ? 0.7 : 0.55,
  };
}

export function detectPain(input: PainInput): PainEvidence[] {
  const now = input.now ?? new Date();
  const evidence: PainEvidence[] = [];

  const localeCount = input.localeCommits.length;

  /*
   * Repeated translation commits — the brief's own example.
   *
   * Thresholds rather than a curve, because a curve would imply a precision
   * this does not have. Three in a month is somebody doing it as a chore; ten
   * is a chore that has become a habit.
   */
  if (localeCount >= 3) {
    const severity: PainSeverity =
      localeCount >= 10 ? 'high' : localeCount >= 6 ? 'medium' : 'low';
    evidence.push({
      label: 'translation_commit_frequency',
      summary: `${localeCount} commits touched translations in ${input.windowDays} days`,
      severity,
      // Counting is exact; that the count means friction is the inference.
      confidence: localeCount >= 10 ? 0.85 : 0.7,
    });
  }

  /*
   * Translation work as a share of everything.
   *
   * Twelve translation commits in a repository with twelve hundred is noise;
   * twelve out of forty is a team spending a third of its commits on it. Only
   * computed when there is enough total activity for a ratio to mean anything.
   */
  if (input.allCommits.length >= 20 && localeCount >= 3) {
    const share = localeCount / input.allCommits.length;
    if (share >= 0.1) {
      evidence.push({
        label: 'translation_share_of_commits',
        summary: `${Math.round(share * 100)}% of commits in ${input.windowDays} days touched translations (${localeCount} of ${input.allCommits.length})`,
        severity: share >= 0.25 ? 'high' : 'medium',
        confidence: 0.75,
      });
    }
  }

  // Messages that name the work explicitly, rather than a feature that happened
  // to change a string.
  const deliberate = input.localeCommits.filter((c) =>
    TRANSLATION_WORK.test(c.message),
  );
  if (deliberate.length >= 2) {
    evidence.push({
      label: 'deliberate_translation_work',
      summary: `${deliberate.length} commits describe translation work: ${deliberate
        .slice(0, 3)
        .map((c) => `"${c.message.slice(0, 60)}"`)
        .join(', ')}`,
      severity: deliberate.length >= 5 ? 'high' : 'medium',
      confidence: 0.8,
    });
  }

  const manual = input.localeCommits.filter((c) => BY_HAND.test(c.message));
  if (manual.length >= 1) {
    evidence.push({
      label: 'manual_translation_work',
      summary: `${manual.length} commit(s) describe manual translation edits: "${manual[0]?.message.slice(0, 80)}"`,
      severity: manual.length >= 3 ? 'high' : 'medium',
      // A message is what somebody typed, not what they did. Lower than the
      // counts above for that reason.
      confidence: 0.6,
    });
  }

  const stale = stalenessEvidence(input, now);
  if (stale) evidence.push(stale);

  return evidence;
}

/**
 * One number for how much this looks like it hurts, 0–100, with its arithmetic.
 *
 * Returned with the per-item points so `closer_record_score` accepts it: that
 * function refuses a score whose breakdown does not sum to the value claimed,
 * which is the check a non-empty-array constraint cannot make.
 */
export interface ScoreComponent {
  component: string;
  points: number;
  max: number;
  why: string;
}

const SEVERITY_POINTS: Record<PainSeverity, number> = {
  low: 8,
  medium: 16,
  high: 25,
};

export function painScore(evidence: readonly PainEvidence[]): {
  value: number;
  confidence: number;
  breakdown: ScoreComponent[];
} {
  const breakdown: ScoreComponent[] = evidence.map((item) => ({
    component: item.label,
    points: SEVERITY_POINTS[item.severity],
    max: SEVERITY_POINTS.high,
    why: item.summary,
  }));

  /*
   * Capped at 100 by trimming the last component rather than by scaling every
   * one of them. Scaling would leave a breakdown whose numbers no longer match
   * the rule that produced them, and a reader comparing two companies would
   * find the same evidence worth different points in each.
   */
  let total = 0;
  const kept: ScoreComponent[] = [];
  for (const component of breakdown) {
    if (total + component.points > 100) {
      const room = 100 - total;
      if (room > 0) kept.push({ ...component, points: room });
      total = 100;
      break;
    }
    kept.push(component);
    total += component.points;
  }

  const confidence =
    evidence.length === 0
      ? 0
      : evidence.reduce((sum, e) => sum + e.confidence, 0) / evidence.length;

  return {
    value: total,
    confidence: Number(confidence.toFixed(3)),
    breakdown: kept,
  };
}
