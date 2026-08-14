import { Page, PageHeader, PageMeta } from '@/components/page';
import { SampleBanner, SampleRegion } from '@/components/sample';
import { SAMPLE_REVIEW } from '@/lib/sample';
import { Button, StringCard } from '@localize-infra/ui';
import { Check, Pencil } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Review' };

/**
 * The non-developer surface, and the only one designed mobile-first.
 *
 * Inès reviews from a phone. Everything a developer needs and she does not —
 * keys, branches, ICU syntax, file paths — is absent by design; the UX doc's
 * vocabulary rules are enforced here. Actions are full-width and thumb-sized on
 * small screens and only collapse to inline buttons once there is room.
 */
export default function ReviewPage() {
  return (
    <Page>
      <PageHeader
        title="Review"
        purpose="Suggested wording, waiting for someone who knows the product to say yes."
        meta={<PageMeta label="Waiting">{SAMPLE_REVIEW.length}</PageMeta>}
      />

      <div className="mt-6">
        <SampleBanner>
          Approving here changes nothing — there is no project to write back to.
          These three show how a reviewer would see suggested copy.
        </SampleBanner>
      </div>

      <SampleRegion label="Suggestions awaiting review" className="mt-6">
        {/*
         * Held to a reading measure (DESIGN.md §4.2).
         *
         * This surface was designed on a phone and never checked on a desktop,
         * where it became a mobile layout stretched to 1132px. `StringCard`
         * pushes the locale chip to the far edge with `justify-between`, so on
         * a wide screen the `FR` label sat some 900px from "Bon retour" — the
         * two are only related by proximity, and there was none left. Six short
         * strings also spent the whole viewport.
         *
         * The content here is a short string, its translation and one line of
         * context: prose-shaped, not tabular. §4.2 already says reading
         * surfaces gain nothing from more width; this applies it.
         */}
        <ul className="flex max-w-3xl flex-col gap-3">
          {SAMPLE_REVIEW.map((item) => (
            <li
              key={item.id}
              className="rounded-lg border border-subtle bg-canvas p-3 sm:p-4"
            >
              <StringCard
                source={item.source}
                sourceLocale={item.sourceLocale}
                translation={item.translation}
                targetLocale={item.targetLocale}
                tone="confident"
                stateLabel={item.stateLabel}
                context={item.context}
              />
              {/* Full-width and stacked on a phone; inline once there is room.
                  This is the one surface where thumb reach outranks density. */}
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Button variant="primary" size="sm" className="sm:w-auto">
                  <Check aria-hidden="true" />
                  Looks right
                </Button>
                <Button variant="secondary" size="sm" className="sm:w-auto">
                  <Pencil aria-hidden="true" />
                  Suggest a change
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </SampleRegion>
    </Page>
  );
}
