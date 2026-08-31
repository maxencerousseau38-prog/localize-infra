import { PIPELINE_STAGES } from '@localize-infra/ui';
import { describe, expect, it } from 'vitest';
import {
  type RunStage,
  STALL_AFTER_MS,
  pipelineStageId,
  runProgress,
  shouldPoll,
} from './progress';

const NOW = Date.parse('2026-08-20T12:00:00Z');
const agoMs = (ms: number) => new Date(NOW - ms).toISOString();

describe('runProgress', () => {
  it('reports a queued run as queued, whatever stage it carries', () => {
    expect(
      runProgress({
        status: 'queued',
        stage: 'detect',
        progressAt: null,
        now: NOW,
      }),
    ).toEqual({ kind: 'queued' });
  });

  it('reports the stage a running run last reached', () => {
    expect(
      runProgress({
        status: 'running',
        stage: 'translate',
        progressAt: agoMs(10_000),
        now: NOW,
      }),
    ).toEqual({ kind: 'active', stage: 'translate' });
  });

  /*
   * The case the heartbeat exists for. A serverless request killed mid-flight
   * writes no error and leaves no trace — the row keeps saying `running` at
   * `translate` forever, and every reader is told it is working. Status alone
   * cannot tell this apart from a large locale taking its time.
   */
  it('reports a run that has gone silent as stalled', () => {
    const result = runProgress({
      status: 'running',
      stage: 'translate',
      progressAt: agoMs(STALL_AFTER_MS + 1_000),
      now: NOW,
    });

    expect(result.kind).toBe('stalled');
    if (result.kind === 'stalled') {
      expect(result.stage).toBe('translate');
      expect(result.silentForMs).toBeGreaterThan(STALL_AFTER_MS);
    }
  });

  it('does not call a slow run dead just before the threshold', () => {
    expect(
      runProgress({
        status: 'running',
        stage: 'translate',
        progressAt: agoMs(STALL_AFTER_MS - 1_000),
        now: NOW,
      }).kind,
    ).toBe('active');
  });

  /*
   * Runs that predate progress reporting have no heartbeat at all. Accusing
   * them of being dead would be inventing a diagnosis from missing data.
   */
  it('treats a missing heartbeat as active rather than stalled', () => {
    expect(
      runProgress({
        status: 'running',
        stage: 'extract',
        progressAt: null,
        now: NOW,
      }),
    ).toEqual({ kind: 'active', stage: 'extract' });
  });

  it('treats an unparseable heartbeat as active rather than throwing', () => {
    expect(
      runProgress({
        status: 'running',
        stage: 'extract',
        progressAt: 'not-a-date',
        now: NOW,
      }).kind,
    ).toBe('active');
  });

  it('reports a run waiting on a person as its own state', () => {
    expect(
      runProgress({
        status: 'awaiting_review',
        stage: 'escalate',
        progressAt: agoMs(60 * 60 * 1000),
        now: NOW,
      }),
    ).toEqual({ kind: 'awaiting-review' });
  });

  /*
   * A run waiting for a human is silent by definition, often for days. It must
   * never be reported as stalled — that is the one state where doing nothing is
   * the product working correctly.
   */
  it('never calls a run awaiting review stalled, however long it waits', () => {
    expect(
      runProgress({
        status: 'awaiting_review',
        stage: 'escalate',
        progressAt: agoMs(30 * 24 * 60 * 60 * 1000),
        now: NOW,
      }).kind,
    ).toBe('awaiting-review');
  });

  for (const status of ['succeeded', 'partial', 'failed'] as const) {
    it(`reports a ${status} run as finished, not as its stage`, () => {
      expect(
        runProgress({
          status,
          stage: 'pull_request',
          progressAt: agoMs(10_000),
          now: NOW,
        }),
      ).toEqual({ kind: 'finished', status });
    });
  }
});

describe('shouldPoll', () => {
  it('keeps watching work that is still moving', () => {
    expect(shouldPoll({ kind: 'queued' })).toBe(true);
    expect(shouldPoll({ kind: 'active', stage: 'translate' })).toBe(true);
  });

  /*
   * Stalled is deliberately not polled. Nothing is going to change it, and a
   * page that keeps re-reading a dead row is a spinner that never resolves.
   */
  it('stops watching what will not change on its own', () => {
    expect(
      shouldPoll({ kind: 'stalled', stage: 'translate', silentForMs: 1 }),
    ).toBe(false);
    expect(shouldPoll({ kind: 'awaiting-review' })).toBe(false);
    expect(shouldPoll({ kind: 'finished', status: 'succeeded' })).toBe(false);
  });
});

/**
 * The one place the database and the design vocabulary disagree.
 *
 * Written against `PIPELINE_STAGES` rather than against a copied list, so it
 * fails if either side is renamed: the point is that every stored stage lands
 * on a real stage, not that this particular pair of strings exists.
 */
describe('pipelineStageId', () => {
  const STORED: RunStage[] = [
    'detect',
    'extract',
    'translate',
    'escalate',
    'pull_request',
  ];

  it('maps every stored stage onto a stage the pipeline draws', () => {
    for (const stage of STORED) {
      const id = pipelineStageId(stage);
      expect(
        PIPELINE_STAGES.findIndex((s) => s.id === id),
        `stored stage "${stage}" matches no pipeline stage`,
      ).toBeGreaterThanOrEqual(0);
    }
  });

  it('translates the last stage rather than passing the enum through', () => {
    // The regression itself: `pull_request` matched nothing, so a run that
    // failed at the final stage reported that it had reached none of them.
    expect(pipelineStageId('pull_request')).toBe('pull-request');
  });

  it('leaves an unrecognised stage alone instead of guessing', () => {
    expect(pipelineStageId('something-new')).toBe('something-new');
  });
});

describe('no_changes', () => {
  it('is a finished state, not an active one', () => {
    expect(
      runProgress({
        status: 'no_changes',
        stage: 'translate',
        progressAt: null,
      }),
    ).toEqual({ kind: 'finished', status: 'no_changes' });
  });

  it('is not polled, because nothing will change', () => {
    expect(
      shouldPoll(
        runProgress({
          status: 'no_changes',
          stage: 'translate',
          progressAt: null,
        }),
      ),
    ).toBe(false);
  });

  // A run that stopped for lack of work is not stalled, however long ago it
  // stopped. Without the finished branch it would fall through to the
  // heartbeat check and be reported as dead.
  it('is not reported as stalled when it is old', () => {
    expect(
      runProgress({
        status: 'no_changes',
        stage: 'translate',
        progressAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      }),
    ).toEqual({ kind: 'finished', status: 'no_changes' });
  });
});
