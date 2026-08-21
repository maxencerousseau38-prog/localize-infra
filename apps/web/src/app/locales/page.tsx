import { NotConnected } from '@/components/not-connected';
import { Page, PageHeader, PageMeta } from '@/components/page';
import {
  listLocaleCoverageForViewer,
  requireSession,
} from '@/lib/data/workspace';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { EmptyState } from '@localize-infra/ui';
import type { Metadata } from 'next';
import { LocaleCoverageList } from './locale-coverage-list';

export const metadata: Metadata = { title: 'Locales' };

/**
 * Coverage, computed rather than stored.
 *
 * This rendered five invented languages with invented percentages. There is
 * still no coverage table and deliberately no new one: invariant 1 says git is
 * the source of truth and Postgres is an index. So the honest answer to "how
 * much of this language is done" is derived from the most recent run that
 * produced anything — how many keys it proposed for a locale against how many
 * it extracted.
 *
 * That makes the number as fresh as the last run and no fresher, which is the
 * truth. A stored percentage would go stale silently the moment somebody edited
 * a locale file by hand, and this product's whole claim is that they can.
 */
export default async function LocalesPage() {
  // Before the session check: without a database there is no session to
  // require, and `requireSession` would throw where a sentence belongs.
  if (!isSupabaseConfigured()) {
    return (
      <Page>
        {/* The header stays. A page whose only content is an empty state
            still needs its one h1 — dropping it made this route headingless,
            which is an accessibility failure and not a test artefact. */}
        <PageHeader
          title="Locales"
          purpose="Which languages are current, which are behind, and which are waiting on a human."
        />
        <NotConnected noun="coverage" />
      </Page>
    );
  }

  await requireSession();
  const coverage = await listLocaleCoverageForViewer();

  const behind = coverage.filter((l) => l.translated < l.total).length;
  const sourceStrings = coverage[0]?.total ?? 0;

  return (
    <Page>
      <PageHeader
        title="Locales"
        purpose="Which languages are current, which are behind, and which are waiting on a human."
        meta={
          coverage.length > 0 ? (
            <>
              <PageMeta label="Languages">{coverage.length}</PageMeta>
              <PageMeta label="Source strings">{sourceStrings}</PageMeta>
              <PageMeta label="Behind">{behind}</PageMeta>
            </>
          ) : null
        }
      />

      {coverage.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No coverage to report yet"
            description="Coverage is computed from the last run that extracted something. Run the pipeline against a connected repository and the languages it wrote appear here."
          />
        </div>
      ) : (
        <div className="mt-6">
          <LocaleCoverageList items={coverage} />
        </div>
      )}
    </Page>
  );
}
