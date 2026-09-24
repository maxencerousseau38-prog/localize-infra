import { NotConnected } from '@/components/not-connected';
import { Page, PageHeader, PageMeta } from '@/components/page';
import { listReviewItemsForViewer, requireSession } from '@/lib/data/workspace';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { EmptyState } from '@localize-infra/ui';
import type { Metadata } from 'next';
import { ReviewList } from './review-list';

export const metadata: Metadata = { title: 'Review' };

/**
 * Wording waiting on somebody who knows the product.
 *
 * This rendered three invented strings with Approve and Suggest-a-change
 * buttons that did nothing, behind a banner admitting it. The buttons are gone
 * rather than wired: approving a run is a single decision that commits its
 * whole proposal, and it lives on the project page next to the questions it
 * depends on. A per-string approve here would imply a granularity the pipeline
 * does not have — there is no way to accept one key and reject another.
 *
 * So this reads. It shows what is about to be committed, for a reviewer who is
 * not the person who will click approve, and says where the decision happens.
 *
 * Only runs that actually stopped for a person are included. A proposal from a
 * run that already opened its pull request is history, and presenting it as
 * pending would ask for a decision that has no effect.
 */
export default async function ReviewPage() {
  // Before the session check: without a database there is no session to
  // require, and `requireSession` would throw where a sentence belongs.
  if (!isSupabaseConfigured()) {
    return (
      <Page>
        {/* The header stays. A page whose only content is an empty state
            still needs its one h1 — dropping it made this route headingless,
            which is an accessibility failure and not a test artefact. */}
        <PageHeader
          title="Review"
          purpose="Suggested wording, waiting for someone who knows the product to say yes."
        />
        <NotConnected noun="suggestions" />
      </Page>
    );
  }

  await requireSession();
  const items = await listReviewItemsForViewer();

  const locales = new Set(items.map((i) => i.locale));

  return (
    <Page>
      <PageHeader
        title="Review"
        purpose="Suggested wording, waiting for someone who knows the product to say yes."
        meta={
          items.length > 0 ? (
            <>
              <PageMeta label="Waiting">{items.length}</PageMeta>
              <PageMeta label="Languages">{locales.size}</PageMeta>
            </>
          ) : null
        }
      />

      {items.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="Nothing is waiting for review"
            description="When a run stops to ask a question, the wording it proposed appears here until somebody approves the run on its project page."
          />
        </div>
      ) : (
        /*
         * The explanatory paragraph that stood here is gone, and what it said
         * is now reachable instead of merely stated. It read "Approving happens
         * on the run's project page" — true, and a sentence a reader could only
         * act on by navigating somewhere else themselves. Each run group now
         * carries the link.
         */
        <ReviewList items={items} />
      )}
    </Page>
  );
}
