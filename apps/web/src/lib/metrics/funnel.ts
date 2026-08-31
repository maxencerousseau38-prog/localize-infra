/**
 * The activation funnel, derived from what the database already records.
 *
 * There is no events table here, and that is a decision rather than an
 * omission. `organizations`, `organization_github_installations`, `projects`
 * and `runs` already carry every timestamp this funnel needs, each written by
 * the code that performed the thing. An events table beside them would be a
 * second account of the same facts, free to disagree with the first — and the
 * disagreement would surface as a metric nobody could reconcile.
 *
 * What is genuinely not recorded anywhere is reported as **not measured**, not
 * as zero. A merge rate of "0%" and a merge rate of "nobody has looked" are
 * different sentences, and only one of them is true.
 *
 * Everything here is pure. The caller supplies rows; this decides what they
 * mean.
 */

/** A run, in the columns this file reads. */
export interface RunRow {
  created_at: string;
  finished_at: string | null;
  status:
    | 'queued'
    | 'running'
    | 'succeeded'
    | 'partial'
    | 'failed'
    | 'awaiting_review'
    | 'no_changes';
  pr_url: string | null;
  /** Null until something asks GitHub. See `mergeRate` below. */
  pr_merged_at?: string | null;
}

export interface FunnelInput {
  /**
   * When the workspace was created.
   *
   * Used as the origin for time-to-first-pull-request instead of the account's
   * signup, because `auth.users` is not readable under RLS and exposing it
   * would need a definer function this metric does not justify. The two are
   * close: `/onboarding` is a gate, not a destination — it is the first screen
   * after a first sign-in and it refuses to move on until a workspace exists.
   * The interval is therefore signup plus however long it takes to type a name.
   */
  workspaceCreatedAt: string;
  /** Null when GitHub has never been connected to this workspace. */
  githubConnectedAt: string | null;
  /** Projects that have a repository attached, and when it was attached. */
  repositoriesConnectedAt: readonly string[];
  runs: readonly RunRow[];
}

export interface FunnelStep {
  step: string;
  /** How many of the thing happened. */
  count: number;
  /** When it first happened, or null if it has not. */
  firstAt: string | null;
}

export interface Funnel {
  steps: FunnelStep[];
  /**
   * Milliseconds from workspace creation to the first pull request, or null
   * when no run has opened one.
   */
  timeToFirstPullRequestMs: number | null;
  /** True once a run has opened a pull request. The activation event. */
  activated: boolean;
  /**
   * Merged pull requests over created ones, or null.
   *
   * Null today, always: nothing in this repository asks GitHub whether a pull
   * request was merged. `runs.pr_merged_at` is in the shape above so the
   * function is ready for the day something writes it, and until then this
   * returns null rather than a rate computed from a column that is null for a
   * reason unrelated to merging.
   */
  mergeRatePercent: number | null;
  /** Why a rate is absent, in words, when it is. */
  notMeasured: string[];
}

function firstOf(values: readonly (string | null)[]): string | null {
  const present = values.filter((v): v is string => v !== null).sort();
  return present[0] ?? null;
}

export function buildFunnel(input: FunnelInput): Funnel {
  const withPr = input.runs.filter((run) => run.pr_url !== null);
  const finished = input.runs.filter((run) => run.finished_at !== null);

  const firstPrAt = firstOf(
    withPr.map((run) => run.finished_at ?? run.created_at),
  );

  const steps: FunnelStep[] = [
    {
      step: 'workspace_created',
      count: 1,
      firstAt: input.workspaceCreatedAt,
    },
    {
      step: 'github_connected',
      count: input.githubConnectedAt ? 1 : 0,
      firstAt: input.githubConnectedAt,
    },
    {
      step: 'repository_connected',
      count: input.repositoriesConnectedAt.length,
      firstAt: firstOf(input.repositoriesConnectedAt),
    },
    {
      step: 'run_started',
      count: input.runs.length,
      firstAt: firstOf(input.runs.map((run) => run.created_at)),
    },
    {
      step: 'run_finished',
      count: finished.length,
      firstAt: firstOf(finished.map((run) => run.finished_at)),
    },
    {
      step: 'pull_request_created',
      count: withPr.length,
      firstAt: firstPrAt,
    },
  ];

  /*
   * A run that stopped to ask a question is not a failed run and not a
   * successful one, so it is counted apart rather than folded into either.
   * Hiding it would make the drop between `run_finished` and
   * `pull_request_created` look like breakage when it is the product working.
   *
   * Read directly off `status` rather than inferred from finished-and-no-PR:
   * that predicate was exact only while `awaiting_review` was the sole status
   * able to satisfy "finished, no PR, not failed". `no_changes` now also
   * satisfies it — a run with nothing to translate finishes with no PR and no
   * failure — and the predicate cannot tell "waiting on you" from "nothing was
   * needed from you" without naming the one status that actually means the
   * former.
   */
  const awaiting = input.runs.filter(
    (run) => run.status === 'awaiting_review',
  );
  steps.push({
    step: 'awaiting_review',
    count: awaiting.length,
    firstAt: firstOf(awaiting.map((run) => run.finished_at)),
  });

  const ttfpr =
    firstPrAt === null
      ? null
      : new Date(firstPrAt).getTime() -
        new Date(input.workspaceCreatedAt).getTime();

  const merged = input.runs.filter((run) => run.pr_merged_at != null);
  const anyMergeKnown = input.runs.some(
    (run) => run.pr_merged_at !== undefined,
  );

  const notMeasured: string[] = [];
  if (!anyMergeKnown || withPr.length === 0) {
    notMeasured.push(
      'Pull request merges — nothing asks GitHub whether a pull request was merged.',
    );
  }

  return {
    steps,
    timeToFirstPullRequestMs: ttfpr,
    activated: withPr.length > 0,
    mergeRatePercent:
      anyMergeKnown && withPr.length > 0
        ? Math.round((merged.length / withPr.length) * 100)
        : null,
    notMeasured,
  };
}

/**
 * Time-to-first-pull-request, for a person rather than a chart.
 *
 * Rounded to the largest unit that still says something. "4 minutes" is the
 * answer to the question the brief's north star asks; "247913 ms" is not.
 */
export function formatDuration(ms: number | null): string | null {
  if (ms === null) return null;
  if (ms < 0) return null;

  const seconds = Math.round(ms / 1000);
  if (seconds < 90) return `${seconds}s`;

  const minutes = Math.round(seconds / 60);
  if (minutes < 90) return `${minutes} min`;

  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h`;

  return `${Math.round(hours / 24)}d`;
}
