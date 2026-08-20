/**
 * What a run's stored state means to somebody watching it.
 *
 * Pure, so it can be tested: the interesting cases are a run that is legitimately
 * slow and a run whose request died, and those are indistinguishable from the
 * status alone. Both sit at `running`, at whatever stage they reached, and only
 * the heartbeat separates them.
 *
 * Stages are not renamed here. The product's vocabulary is fixed in
 * `PIPELINE_STAGES` (DESIGN.md §1.4) and a second set of words for the same
 * five steps is how a reader learns one name on the landing page and meets
 * another in the product.
 */

export type RunStage =
  | 'detect'
  | 'extract'
  | 'translate'
  | 'escalate'
  | 'pull_request';

export type RunStatus =
  | 'queued'
  | 'running'
  | 'awaiting_review'
  | 'succeeded'
  | 'partial'
  | 'failed';

/**
 * How long a run may be silent before it is reported as stalled.
 *
 * Generous on purpose. A single model call over a large locale can legitimately
 * take minutes, and calling a working run dead is worse than being slow to
 * notice a dead one — the first sends somebody chasing a problem that is not
 * there, the second costs them a wait they were already having.
 */
export const STALL_AFTER_MS = 5 * 60 * 1000;

export interface RunProgressInput {
  status: RunStatus;
  stage: RunStage | string;
  progressAt: string | null;
  now?: number;
}

export type RunProgress =
  | { kind: 'queued' }
  | { kind: 'active'; stage: RunStage | string }
  | { kind: 'stalled'; stage: RunStage | string; silentForMs: number }
  | { kind: 'awaiting-review' }
  | { kind: 'finished'; status: 'succeeded' | 'partial' | 'failed' };

export function runProgress(input: RunProgressInput): RunProgress {
  const { status, stage, progressAt } = input;
  const now = input.now ?? Date.now();

  if (status === 'succeeded' || status === 'partial' || status === 'failed') {
    return { kind: 'finished', status };
  }
  if (status === 'awaiting_review') return { kind: 'awaiting-review' };
  if (status === 'queued') return { kind: 'queued' };

  // Running. Without a heartbeat there is nothing to judge staleness against —
  // which is the case for every run started before progress was recorded — so
  // it is reported as active rather than accused of being dead.
  if (!progressAt) return { kind: 'active', stage };

  const last = Date.parse(progressAt);
  if (!Number.isFinite(last)) return { kind: 'active', stage };

  const silentForMs = now - last;
  if (silentForMs > STALL_AFTER_MS) {
    return { kind: 'stalled', stage, silentForMs };
  }
  return { kind: 'active', stage };
}

/** Whether a row should keep being re-read. Finished work is not polled. */
export function shouldPoll(progress: RunProgress): boolean {
  return progress.kind === 'queued' || progress.kind === 'active';
}
