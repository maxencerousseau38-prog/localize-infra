import { NotConnected } from '@/components/not-connected';
import { Page, PageHeader, PageMeta } from '@/components/page';
import { type RunTableRow, RunsTable } from '@/components/runs-table';
import { listRunsForViewer, requireSession } from '@/lib/data/workspace';
import { toRunTableRow } from '@/lib/runs/table-row';
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

  // Shared with /[org]/usage, which renders the same table. The mapping lived
  // here until a second surface needed it (lib/runs/table-row.ts).
  const rows: RunTableRow[] = runs.map(toRunTableRow);

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
