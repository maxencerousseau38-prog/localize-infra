import type { RunRecord } from '@/lib/data/workspace';
import { describe, expect, it } from 'vitest';
import { RUN_COLUMNS, RUN_SELECT } from './run-columns';

/*
 * `import type` is erased before this file runs, so naming `RunRecord` here
 * does not pull `workspace.ts` — and its `server-only` import — into the test.
 * The type still does its work at compile time, which is where this guard
 * matters most.
 */

/**
 * A complete row, written out rather than generated.
 *
 * This is the half of the guard TypeScript enforces: adding a field to
 * `RunRecord` without adding it here fails the typecheck, and the test below
 * then fails if the column list was not updated too. The values are irrelevant;
 * only the keys are under test.
 */
const COMPLETE_ROW: RunRecord = {
  id: 'r',
  status: 'succeeded',
  stage: 'pull_request',
  framework: null,
  keys_extracted: 0,
  keys_translated: 0,
  locales_succeeded: 0,
  locales_failed: 0,
  error: null,
  pr_url: null,
  pr_number: null,
  created_at: '',
  started_at: null,
  finished_at: null,
  progress_at: null,
  source_locale: null,
  target_locales: [],
};

describe('RUN_COLUMNS', () => {
  /*
   * The regression this file exists for.
   *
   * `findRun` selected fifteen columns and `RunRecord` declared seventeen, in
   * both directions: three fields the query never fetched, two columns the type
   * never declared. The cast hid it, and the run detail page silently lost its
   * duration and its stalled banner while the list pages kept both.
   */
  it('names exactly the fields RunRecord declares', () => {
    expect([...RUN_COLUMNS].sort()).toEqual(Object.keys(COMPLETE_ROW).sort());
  });

  it('carries the three columns whose absence broke the run detail', () => {
    for (const column of [
      'started_at',
      'finished_at',
      'progress_at',
    ] as const) {
      expect(RUN_COLUMNS).toContain(column);
    }
  });

  it('renders a select string PostgREST accepts', () => {
    expect(RUN_SELECT).toBe(RUN_COLUMNS.join(','));
    expect(RUN_SELECT).not.toMatch(/\s/);
  });

  /*
   * `branch` is a column on the table and is always null: `run-actions.ts`
   * never sets it, because the API returns only the pull request URL and
   * number. Selecting it would put a field on the page that is empty for every
   * run ever recorded.
   */
  it('leaves out the column that is null on every row', () => {
    expect(RUN_COLUMNS).not.toContain('branch');
  });
});
