import { NotConnected } from '@/components/not-connected';
import { Page, PageHeader, PageMeta } from '@/components/page';
import {
  listLocaleCoverageForViewer,
  requireSession,
} from '@/lib/data/workspace';
import { summariseCoverage } from '@/lib/locales/summary';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { EmptyState, StateRule } from '@localize-infra/ui';
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

  const summary = summariseCoverage(coverage);
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
        <>
          {/*
            The answer, before the arithmetic.
            ──────────────────────────────────
            The page opened with `Languages · Source strings · Behind` — three
            numbers at one weight — and then a list. A reader arrives asking
            whether their product is current everywhere, and was handed the
            operands. §3.5: the surface had no dominant element.

            Derived from the same rows the list renders, so the band and the
            list cannot disagree; there is nothing stored to drift.
          */}
          {summary ? (
            <StateRule
              tone={summary.tone}
              className="mt-6 rounded-e-lg bg-surface/40 py-5 pe-5"
            >
              <p className="text-title font-semibold text-primary">
                {summary.headline}
              </p>
              <p className="mt-1.5 max-w-[68ch] text-small leading-6 text-secondary">
                {summary.detail}
              </p>
            </StateRule>
          ) : null}

          {/*
            Said once, not once per language.
            `listLocaleCoverageForViewer` takes `limit(1)`: every row on this
            page comes from the same run, and each row used to repeat its date.
          */}
          {coverage[0]?.lastRunAt ? (
            <p className="mt-6 text-caption text-tertiary">
              Coverage from the run of{' '}
              <span className="font-mono">
                {new Date(coverage[0].lastRunAt).toISOString().slice(0, 10)}
              </span>
              , the most recent one that extracted anything.
            </p>
          ) : null}

          <div className="mt-3">
            <LocaleCoverageList items={coverage} />
          </div>
        </>
      )}
    </Page>
  );
}
