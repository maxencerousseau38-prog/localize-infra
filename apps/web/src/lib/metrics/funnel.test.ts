import { describe, expect, it } from 'vitest';
import {
  type FunnelInput,
  type RunRow,
  buildFunnel,
  formatDuration,
} from './funnel.js';

/**
 * What the funnel is allowed to claim.
 *
 * The rule most of these assert is the one the repository keeps having to
 * relearn: a number nobody measured must not be reported as zero. A merge rate
 * of 0% and "nobody has looked" are different sentences and only one is true.
 */

const T0 = '2026-08-01T10:00:00.000Z';

const run = (over: Partial<RunRow> = {}): RunRow => ({
  created_at: '2026-08-01T10:02:00.000Z',
  finished_at: '2026-08-01T10:04:00.000Z',
  status: 'succeeded',
  pr_url: 'https://github.com/o/r/pull/1',
  ...over,
});

const input = (over: Partial<FunnelInput> = {}): FunnelInput => ({
  workspaceCreatedAt: T0,
  githubConnectedAt: '2026-08-01T10:01:00.000Z',
  repositoriesConnectedAt: ['2026-08-01T10:01:30.000Z'],
  runs: [run()],
  ...over,
});

describe('buildFunnel', () => {
  it('reports each step in order, with when it first happened', () => {
    const funnel = buildFunnel(input());
    expect(funnel.steps.map((s) => s.step)).toEqual([
      'workspace_created',
      'github_connected',
      'repository_connected',
      'run_started',
      'run_finished',
      'pull_request_created',
      'awaiting_review',
    ]);
    expect(funnel.steps.find((s) => s.step === 'github_connected')?.count).toBe(
      1,
    );
  });

  it('counts a workspace that has connected nothing as zero, not as missing', () => {
    const funnel = buildFunnel(
      input({ githubConnectedAt: null, repositoriesConnectedAt: [], runs: [] }),
    );
    const github = funnel.steps.find((s) => s.step === 'github_connected');
    expect(github?.count).toBe(0);
    expect(github?.firstAt).toBeNull();
  });

  describe('activation', () => {
    it('is a pull request existing, and nothing else', () => {
      expect(buildFunnel(input()).activated).toBe(true);
      expect(
        buildFunnel(input({ runs: [run({ pr_url: null })] })).activated,
      ).toBe(false);
    });

    it('is false when runs exist but none opened a pull request', () => {
      const funnel = buildFunnel(
        input({ runs: [run({ pr_url: null, status: 'failed' })] }),
      );
      expect(funnel.activated).toBe(false);
      expect(funnel.timeToFirstPullRequestMs).toBeNull();
    });
  });

  describe('time to first pull request', () => {
    it('measures from workspace creation to the first pull request', () => {
      // 10:00 → 10:04 is four minutes.
      expect(buildFunnel(input()).timeToFirstPullRequestMs).toBe(4 * 60 * 1000);
    });

    it('uses the earliest pull request, not the most recent', () => {
      const funnel = buildFunnel(
        input({
          runs: [
            run({ finished_at: '2026-08-05T10:00:00.000Z' }),
            run({ finished_at: '2026-08-01T10:03:00.000Z' }),
          ],
        }),
      );
      expect(funnel.timeToFirstPullRequestMs).toBe(3 * 60 * 1000);
    });

    it('is null rather than zero when there is no pull request', () => {
      expect(
        buildFunnel(input({ runs: [] })).timeToFirstPullRequestMs,
      ).toBeNull();
    });
  });

  /*
   * The rule this file exists for. Nothing in this repository asks GitHub
   * whether a pull request was merged, so a merge rate is not a small number —
   * it is an unanswered question, and reporting 0% would answer it wrongly.
   */
  describe('merge rate', () => {
    it('is null, and says why, when nothing records merges', () => {
      const funnel = buildFunnel(input());
      expect(funnel.mergeRatePercent).toBeNull();
      expect(funnel.notMeasured.join(' ')).toContain('merge');
    });

    it('is computed once merges are actually recorded', () => {
      const funnel = buildFunnel(
        input({
          runs: [
            run({ pr_merged_at: '2026-08-02T09:00:00.000Z' }),
            run({ pr_merged_at: null }),
          ],
        }),
      );
      expect(funnel.mergeRatePercent).toBe(50);
      expect(funnel.notMeasured).toEqual([]);
    });
  });

  /*
   * A run that stopped to ask a question is the product working, not breaking.
   * Folding it into the failures would make the drop before
   * `pull_request_created` look like a defect.
   */
  it('counts runs awaiting review apart from failures', () => {
    const funnel = buildFunnel(
      input({
        runs: [
          run({ pr_url: null, status: 'awaiting_review' }),
          run({ pr_url: null, status: 'failed' }),
        ],
      }),
    );
    expect(funnel.steps.find((s) => s.step === 'awaiting_review')?.count).toBe(
      1,
    );
  });

  /*
   * The regression this finding exists for. Before the status was read
   * directly, "finished, no PR, not failed" was true of `awaiting_review`
   * *and* `no_changes` — a run with nothing to translate finishes with no PR
   * and no failure, same as one genuinely waiting on a person. Reporting it
   * as "Awaiting your answer" would tell a workspace it owes an answer to a
   * run that already finished cleanly.
   */
  it('does not count a no_changes run as awaiting review', () => {
    const funnel = buildFunnel(
      input({
        runs: [run({ pr_url: null, status: 'no_changes' })],
      }),
    );
    expect(funnel.steps.find((s) => s.step === 'awaiting_review')?.count).toBe(
      0,
    );
  });

  it('does not count an unfinished run as awaiting review', () => {
    const funnel = buildFunnel(
      input({
        runs: [run({ finished_at: null, pr_url: null, status: 'running' })],
      }),
    );
    expect(funnel.steps.find((s) => s.step === 'awaiting_review')?.count).toBe(
      0,
    );
    expect(funnel.steps.find((s) => s.step === 'run_finished')?.count).toBe(0);
  });
});

describe('formatDuration', () => {
  it('says nothing when there is nothing to say', () => {
    expect(formatDuration(null)).toBeNull();
  });

  it.each([
    [45_000, '45s'],
    [4 * 60_000, '4 min'],
    [3 * 3_600_000, '3h'],
    [5 * 86_400_000, '5d'],
  ])('renders %ims as %s', (ms, expected) => {
    expect(formatDuration(ms)).toBe(expected);
  });

  /*
   * The north star asks "under five minutes?". A duration in milliseconds does
   * not answer it, which is the whole reason this function exists.
   */
  it('answers the question the north star asks', () => {
    expect(formatDuration(247_913)).toBe('4 min');
  });

  it('refuses a negative interval rather than rendering one', () => {
    expect(formatDuration(-1000)).toBeNull();
  });
});
