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
  | 'failed'
  /** Finished with nothing to do: every key was already translated. */
  | 'no_changes';

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
  | {
      kind: 'finished';
      status: 'succeeded' | 'partial' | 'failed' | 'no_changes';
    };

export function runProgress(input: RunProgressInput): RunProgress {
  const { status, stage, progressAt } = input;
  const now = input.now ?? Date.now();

  if (
    status === 'succeeded' ||
    status === 'partial' ||
    status === 'failed' ||
    status === 'no_changes'
  ) {
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

/**
 * The stored stage, as the shared pipeline vocabulary spells it.
 *
 * Postgres and `PIPELINE_STAGES` disagree on exactly one label: the enum is
 * `pull_request` and the stage id is `pull-request`. Everything downstream
 * matched them with `===`, so a run that reached the last stage matched nothing
 * and `findIndex` returned -1 — which the run detail then read as "reached
 * nothing", drawing all five stages as *Not yet*.
 *
 * It never showed, because the one shape that hits it is narrow: a run at
 * `pull_request` that did *not* finish cleanly. A succeeded run takes an earlier
 * branch that marks every stage done regardless of the index, so the bug was
 * covered by the only case anyone had looked at. A run that failed while opening
 * its pull request — the case where a reader most needs to see how far it
 * got — would have reported that it never started.
 *
 * Translating in one place rather than renaming either side: the enum spelling
 * is what the database has stored since #14, and the hyphen is the id the
 * marketing site already renders from.
 */
export function pipelineStageId(stage: RunStage | string): string {
  return stage === 'pull_request' ? 'pull-request' : stage;
}

/**
 * A stage as the run detail draws it.
 *
 * Replaces `SampleRunStage`, which lived in the fixtures module and required a
 * `detail` string per stage — a sentence the fixture author wrote and no run
 * produces. It also had no way to say "not yet": its states were done, partial,
 * failed and skipped, which describe a finished run only. A run in flight needs
 * `active` and `pending`, and skipped is not the same fact as pending.
 */
export type RunStageState =
  | 'done'
  | 'active'
  | 'pending'
  | 'failed'
  | 'partial';

export interface RunStageView {
  id: string;
  state: RunStageState;
  /** Optional: shown when the run recorded something for this stage. */
  detail?: string;
}
