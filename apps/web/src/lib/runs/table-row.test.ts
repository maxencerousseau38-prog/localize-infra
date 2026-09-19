import type { RunRecord } from '@/lib/data/workspace';
import { describe, expect, it } from 'vitest';
import { toRunTableRow } from './table-row.js';

/**
 * The one rule worth pinning in this mapping: **a duration that has not elapsed
 * is null, never zero.**
 *
 * The sample data this table was first built against carried a duration on
 * every row, including runs still in flight. Now that two surfaces share the
 * mapping — `/runs` and `/[org]/usage` — a zero creeping back in would read as
 * "this run took no time" on both at once.
 */

const run = (over: Partial<RunRecord> = {}): RunRecord =>
  ({
    id: 'run-1',
    status: 'succeeded',
    stage: 'pull_request',
    framework: 'Vite + React',
    keys_extracted: 3,
    keys_translated: 12,
    locales_succeeded: 4,
    locales_failed: 0,
    error: null,
    pr_url: 'https://github.com/o/r/pull/9',
    pr_number: 9,
    created_at: '2026-09-18T20:00:00.000Z',
    started_at: '2026-09-18T20:00:01.000Z',
    finished_at: '2026-09-18T20:00:23.000Z',
    progress_at: '2026-09-18T20:00:20.000Z',
    source_locale: 'en',
    target_locales: ['fr', 'de'],
    ...over,
  }) as RunRecord;

describe('duration', () => {
  it('is the elapsed time when the run both started and finished', () => {
    expect(toRunTableRow(run()).durationMs).toBe(22_000);
  });

  it('is null while the run is still going', () => {
    expect(toRunTableRow(run({ finished_at: null })).durationMs).toBeNull();
  });

  it('is null for a run that never started', () => {
    expect(
      toRunTableRow(run({ started_at: null, finished_at: null })).durationMs,
    ).toBeNull();
  });

  it('is null, not zero, when only the finish is recorded', () => {
    expect(toRunTableRow(run({ started_at: null })).durationMs).toBeNull();
  });
});

describe('everything else is carried across unchanged', () => {
  it('keeps the fields the table renders', () => {
    const row = toRunTableRow(run());
    expect(row).toMatchObject({
      id: 'run-1',
      status: 'succeeded',
      stage: 'pull_request',
      framework: 'Vite + React',
      keysExtracted: 3,
      localesSucceeded: 4,
      localesFailed: 0,
      prNumber: 9,
      createdAt: '2026-09-18T20:00:00.000Z',
      progressAt: '2026-09-18T20:00:20.000Z',
    });
  });

  it('carries a failure message rather than dropping it', () => {
    const row = toRunTableRow(
      run({ status: 'failed', error: 'ceiling reached', pr_url: null }),
    );
    expect(row.error).toBe('ceiling reached');
    expect(row.prUrl).toBeNull();
  });

  it('does not invent a framework for a run that recorded none', () => {
    expect(toRunTableRow(run({ framework: null })).framework).toBeNull();
  });
});
