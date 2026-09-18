import type { RunTableRow } from '@/components/runs-table';
import type { RunRecord } from '@/lib/data/workspace';

/**
 * A run row, as the shared table needs it.
 *
 * Extracted from `/runs/page.tsx`, where it lived inline, the moment a second
 * surface needed the same thing. DESIGN.md §8: a domain object rendered on two
 * surfaces uses the same component in both — and a component fed by two
 * hand-written mappings is the same object wearing two shapes as soon as one of
 * them is updated and the other is not.
 *
 * Pure, so the one rule worth pinning can be tested: **a duration that has not
 * elapsed is null, never zero.** The sample data carried a duration on every
 * row, including runs still in flight; inventing one here would be that fiction
 * in a new place.
 */
export function toRunTableRow(run: RunRecord): RunTableRow {
  return {
    id: run.id,
    status: run.status,
    stage: run.stage,
    framework: run.framework,
    keysExtracted: run.keys_extracted,
    localesSucceeded: run.locales_succeeded,
    localesFailed: run.locales_failed,
    durationMs:
      run.started_at && run.finished_at
        ? Date.parse(run.finished_at) - Date.parse(run.started_at)
        : null,
    prNumber: run.pr_number,
    prUrl: run.pr_url,
    error: run.error,
    createdAt: run.created_at,
    progressAt: run.progress_at,
  };
}
