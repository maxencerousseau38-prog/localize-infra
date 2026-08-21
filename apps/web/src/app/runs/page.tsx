import { NotConnected } from '@/components/not-connected';
import { Page, PageHeader, PageMeta } from '@/components/page';
import { type RunTableRow, RunsTable } from '@/components/runs-table';
import { listRunsForViewer, requireSession } from '@/lib/data/workspace';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { EmptyState } from '@localize-infra/ui';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Runs' };

/**
 * Every run this person can see, across their workspaces.
 *
 * This rendered three invented runs — a clean one, a partial one and a failure
 * — behind a banner saying so, because nothing recorded a real one. The `runs`
 * table has existed since #14 and the pipeline has been writing to it since;
 * RLS confines reads to workspaces the caller belongs to.
 *
 * The header carried "Last run: 2 hours ago" and "Succeeded: 1 of 3" as literal
 * text. Both are computed now, and both are absent when there is nothing to
 * count rather than reading zero — a zero implies a measurement was taken.
 */
export default async function RunsPage() {
  // Before the session check: without a database there is no session to
  // require, and `requireSession` would throw where a sentence belongs.
  if (!isSupabaseConfigured()) {
    return (
      <Page>
        {/* The header stays. A page whose only content is an empty state
            still needs its one h1 — dropping it made this route headingless,
            which is an accessibility failure and not a test artefact. */}
        <PageHeader
          title="Runs"
          purpose="Every extraction and translation, what it produced, and what it cost you in time."
        />
        <NotConnected noun="runs" />
      </Page>
    );
  }

  await requireSession();
  const runs = await listRunsForViewer();

  const succeeded = runs.filter((r) => r.status === 'succeeded').length;
  const newest = runs[0];

  const rows: RunTableRow[] = runs.map((run) => ({
    id: run.id,
    status: run.status,
    stage: run.stage,
    framework: run.framework,
    keysExtracted: run.keys_extracted,
    localesSucceeded: run.locales_succeeded,
    localesFailed: run.locales_failed,
    // Real elapsed time, or null. The sample carried a duration for every row;
    // a run still going has not taken any yet, and inventing one would be the
    // same fiction in a new place.
    durationMs:
      run.started_at && run.finished_at
        ? Date.parse(run.finished_at) - Date.parse(run.started_at)
        : null,
    prNumber: run.pr_number,
    prUrl: run.pr_url,
    error: run.error,
    createdAt: run.created_at,
    progressAt: run.progress_at,
  }));

  return (
    <Page>
      <PageHeader
        title="Runs"
        purpose="Every extraction and translation, what it produced, and what it cost you in time."
        meta={
          runs.length > 0 ? (
            <>
              <PageMeta label="Last run">
                {newest
                  ? new Date(newest.created_at).toISOString().slice(0, 10)
                  : '—'}
              </PageMeta>
              <PageMeta label="Succeeded">
                {succeeded} of {runs.length}
              </PageMeta>
            </>
          ) : null
        }
      />

      {runs.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No runs yet"
            description="Connect a repository to a project and start a run. Everything it extracts, translates and opens appears here."
          />
        </div>
      ) : (
        <div className="mt-6">
          <RunsTable runs={rows} />
        </div>
      )}
    </Page>
  );
}
