/**
 * The columns every run query selects, in one place.
 *
 * This existed as three hand-written strings — one in `listRuns`, one in
 * `listRunsForViewer`, one in `findRun` — and they disagreed. `findRun`, the
 * one behind the run detail page, omitted `started_at`, `finished_at` and
 * `progress_at`. The `as RunRecord` cast on the result silenced TypeScript, so
 * the page read three fields that were never fetched and got `undefined` from
 * all three.
 *
 * The symptom was not an error. `duration()` returned "—" for every run that
 * had ever finished, and `runProgress` takes `!progressAt` as "no heartbeat to
 * judge against" and reports the run active — so the stalled banner, on the one
 * page whose whole job is explaining a single run, could not appear at all. The
 * list pages fetched the columns and behaved correctly, which is what kept it
 * invisible: the same run looked fine in the list and blank in the detail.
 *
 * A shared constant rather than three corrected strings, because three strings
 * that must agree will drift again. `run-columns.test.ts` pins the other half:
 * a `RunRecord` literal fails to compile if a field is added without a column,
 * and the key comparison fails if a column is added without a field.
 */
export const RUN_SELECT =
  'id,status,stage,framework,keys_extracted,keys_translated,locales_succeeded,locales_failed,error,pr_url,pr_number,created_at,started_at,finished_at,progress_at,source_locale,target_locales' as const;

/**
 * The same list, as an array, for the guard in `run-columns.test.ts`.
 *
 * Derived from the string rather than the other way round, and that direction
 * is forced rather than chosen: PostgREST's generated types resolve the shape
 * of a result from the *literal* passed to `.select()`. Building the string
 * with `join()` widens it to `string`, at which point Supabase can infer
 * nothing and every `as RunRecord[]` becomes a cast from `GenericStringError`.
 * The literal is the thing the compiler needs; the array is for the test.
 *
 * `source_locale` and `target_locales` are here for the same reason the others
 * were missing: `findRun` already fetched them and `RunRecord` never declared
 * them, so the detail page could not use what it had been given. The list
 * queries now carry them too — two small columns on at most fifty rows, against
 * a shape that is true everywhere.
 *
 * `branch` is deliberately absent. The column exists and is always null:
 * `run-actions.ts` does not set it, because the API generates a timestamped
 * branch name and returns only the pull request URL and number. Selecting it
 * would invite a field that renders empty on every run.
 */
export const RUN_COLUMNS = RUN_SELECT.split(',');
