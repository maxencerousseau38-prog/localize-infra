'use client';

import { runProgress, shouldPoll } from '@/lib/runs/progress';
import { PIPELINE_STAGE_NAMES, type PipelineStageId } from '@localize-infra/ui';
import { Badge, Button, type Tone } from '@localize-infra/ui';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect } from 'react';
import { type RunState, startRun } from './run-actions';

const EMPTY: RunState = {};

export interface RunRow {
  id: string;
  status:
    | 'queued'
    | 'running'
    | 'succeeded'
    | 'partial'
    | 'failed'
    | 'awaiting_review'
    | 'no_changes';
  stage: string;
  framework: string | null;
  keysExtracted: number;
  keysTranslated: number;
  localesSucceeded: number;
  localesFailed: number;
  error: string | null;
  prUrl: string | null;
  prNumber: number | null;
  createdAt: string;
  /** Last time this run reported progress. Null before it moved, or on old runs. */
  progressAt: string | null;
}

/**
 * The stage a reader sees, named from `PIPELINE_STAGES`.
 *
 * Not re-worded locally. The five stage names are fixed once (DESIGN.md §1.4)
 * so the word somebody learns on the landing page is the word they meet here;
 * a private mapping is how those drift apart.
 */
function stageLabel(stage: string): string {
  return (
    PIPELINE_STAGE_NAMES[stage as PipelineStageId] ?? stage.replace('_', ' ')
  );
}

/**
 * Whether a stored value may become a live link.
 *
 * The database now constrains pr_url to a github.com pull request URL, so this
 * is the second lock rather than the only one. It exists because the first
 * version rendered `href={run.prUrl}` directly, and finish_run is callable by
 * any member of the organization — a stored `javascript:` URL was one click
 * away from running in a colleague's session.
 *
 * Parsed rather than pattern-matched: `new URL` resolves the scheme the way
 * the browser will, which is the only opinion that matters here.
 */
function asGitHubPullRequest(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return null;
    if (url.hostname !== 'github.com') return null;
    if (!/^\/[^/]+\/[^/]+\/pull\/\d+$/.test(url.pathname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

const STATUS: Record<RunRow['status'], { tone: Tone; label: string }> = {
  queued: { tone: 'neutral', label: 'Queued' },
  running: { tone: 'neutral', label: 'Running' },
  succeeded: { tone: 'confident', label: 'Succeeded' },
  partial: { tone: 'degraded', label: 'Partial' },
  failed: { tone: 'failed', label: 'Failed' },
  // Iris, and only here. DESIGN.md §1.4 reserves it for "your judgement is
  // required", which is exactly and only what this state means: the run did
  // not fail and did not finish — it found something it will not guess at and
  // stopped to ask. Painting it amber would read as degraded, and it is not.
  awaiting_review: { tone: 'ambiguous', label: 'Needs your call' },
  // Neutral, not confident — see runs-table.tsx for why the two successes are
  // not the same colour.
  no_changes: { tone: 'neutral', label: 'No changes needed' },
};

export function RunsSection({
  orgSlug,
  projectSlug,
  runs,
  canRun,
  reason,
}: {
  orgSlug: string;
  projectSlug: string;
  runs: RunRow[];
  canRun: boolean;
  reason: string | null;
}) {
  const [state, action, pending] = useActionState(
    startRun.bind(null, orgSlug, projectSlug),
    EMPTY,
  );

  const progressByRun = runs.map((run) =>
    runProgress({
      status: run.status,
      stage: run.stage,
      progressAt: run.progressAt,
    }),
  );
  const watching = progressByRun.some(shouldPoll);

  /*
   * Near-real-time by re-reading the server component, not by a socket.
   *
   * The run writes its stage to Postgres as it goes; this asks the server for
   * the row again while anything is still moving, and stops as soon as nothing
   * is. Polling a finished list forever is a spinner that never resolves, and
   * `shouldPoll` deliberately excludes `stalled` and `awaiting-review` — the
   * first will not change on its own, the second is waiting for a person.
   */
  const router = useRouter();
  useEffect(() => {
    if (!watching) return;
    const timer = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(timer);
  }, [watching, router]);

  return (
    <section
      aria-labelledby="runs"
      className="mt-8 rounded-lg border border-line bg-surface/40 px-5 py-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="runs" className="text-subtitle font-semibold text-primary">
          Runs
        </h2>
        {canRun ? (
          <form action={action}>
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? 'Running…' : 'Run pipeline'}
            </Button>
          </form>
        ) : null}
      </div>

      {reason ? (
        <p className="mt-3 max-w-[64ch] text-small leading-6 text-secondary">
          {reason}
        </p>
      ) : (
        <p className="mt-3 max-w-[64ch] text-small leading-6 text-secondary">
          Extract, translate and open a pull request. The run happens inside
          this request, so a large repository can outlive the timeout — a run
          that dies is recorded as failed rather than left pending.
        </p>
      )}

      <output aria-live="polite" className="contents">
        {state.error ? (
          <p className="mt-4 rounded-md border border-failed bg-failed-bg px-3 py-2 text-small text-failed-text">
            {state.error}
          </p>
        ) : null}
      </output>

      {runs.length === 0 ? (
        <p className="mt-4 text-small text-tertiary">
          No runs yet. Nothing is recorded until one happens.
        </p>
      ) : (
        <ul className="mt-4 border-t border-subtle">
          {runs.map((run, index) => {
            const status = STATUS[run.status];
            const progress = progressByRun[index] as ReturnType<
              typeof runProgress
            >;
            const prHref = asGitHubPullRequest(run.prUrl);
            return (
              <li
                key={run.id}
                className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-subtle py-3"
              >
                <Badge tone={status.tone}>{status.label}</Badge>

                <span className="font-mono text-caption text-tertiary">
                  {new Date(run.createdAt)
                    .toISOString()
                    .slice(0, 16)
                    .replace('T', ' ')}
                </span>

                {/* Where it is, while it is still somewhere. A finished run
                    says so with its badge and does not need a stage. */}
                {progress.kind === 'active' ? (
                  <span className="text-small text-secondary">
                    {stageLabel(progress.stage)}…
                  </span>
                ) : progress.kind === 'stalled' ? (
                  <span className="text-small text-degraded-text">
                    Stopped reporting at {stageLabel(progress.stage)} —{' '}
                    {Math.round(progress.silentForMs / 60000)} min ago. The
                    request probably died; start another run.
                  </span>
                ) : null}

                <span className="text-small text-secondary">
                  {run.keysExtracted} key{run.keysExtracted === 1 ? '' : 's'}
                  {run.localesSucceeded > 0
                    ? `, ${run.localesSucceeded} locale${run.localesSucceeded === 1 ? '' : 's'}`
                    : ''}
                  {run.localesFailed > 0 ? `, ${run.localesFailed} failed` : ''}
                </span>

                {prHref ? (
                  <a
                    href={prHref}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="rounded-sm font-mono text-caption text-link underline underline-offset-2 hover:text-link-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                  >
                    #{run.prNumber}
                  </a>
                ) : null}

                {/* Verbatim, and not truncated to a tidy width: the provider's
                    own wording is what a customer will search for. */}
                {run.error ? (
                  <span className="w-full font-mono text-micro leading-5 text-failed-text">
                    {run.error}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
