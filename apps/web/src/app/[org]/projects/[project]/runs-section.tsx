'use client';

import { Badge, Button, type Tone } from '@localize-infra/ui';
import { useActionState } from 'react';
import { type RunState, startRun } from './run-actions';

const EMPTY: RunState = {};

export interface RunRow {
  id: string;
  status: 'queued' | 'running' | 'succeeded' | 'partial' | 'failed';
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
}

const STATUS: Record<RunRow['status'], { tone: Tone; label: string }> = {
  queued: { tone: 'neutral', label: 'Queued' },
  running: { tone: 'neutral', label: 'Running' },
  succeeded: { tone: 'confident', label: 'Succeeded' },
  partial: { tone: 'degraded', label: 'Partial' },
  failed: { tone: 'failed', label: 'Failed' },
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
          {runs.map((run) => {
            const status = STATUS[run.status];
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

                <span className="text-small text-secondary">
                  {run.keysExtracted} key{run.keysExtracted === 1 ? '' : 's'}
                  {run.localesSucceeded > 0
                    ? `, ${run.localesSucceeded} locale${run.localesSucceeded === 1 ? '' : 's'}`
                    : ''}
                  {run.localesFailed > 0 ? `, ${run.localesFailed} failed` : ''}
                </span>

                {run.prUrl ? (
                  <a
                    href={run.prUrl}
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
