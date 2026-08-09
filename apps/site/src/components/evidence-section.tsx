import type * as React from 'react';

/**
 * An evidence section: framing in a rail, evidence at full width.
 *
 * The audit of Docs, Benchmarks and Quality found the same shape repeated down
 * every page — heading, prose, table, heading, prose, table — with all of it
 * locked to roughly half of a 1152px container and the right half empty on
 * every screen wider than a tablet. DESIGN.md §4.4: a page where every section
 * is heading-then-content is a document, not a composition.
 *
 * This is the split the landing page's Commitments and Build status already
 * use — four columns of argument against eight of evidence — so these pages
 * join a rhythm the site had rather than inventing a third one. The heading and
 * its framing stay at a readable measure in the rail; the table, which is the
 * evidence and wants width, gets the rest.
 *
 * Below `lg` it is one column and the rail simply precedes the evidence, which
 * is the reading order in both cases.
 */
export function EvidenceSection({
  id,
  title,
  badge,
  children,
  aside,
  className,
}: {
  /** Anchors the section for `aria-labelledby` and deep links. */
  id: string;
  title: string;
  /** State of the evidence itself — verified, unmeasured. Not decoration. */
  badge?: React.ReactNode;
  /** The framing: why this measurement exists and how to read it. */
  aside: React.ReactNode;
  /** The evidence. Usually a table. */
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-labelledby={id}
      className={className ?? 'border-t border-subtle pt-12 sm:pt-14'}
    >
      <div className="grid gap-8 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2
              id={id}
              className="font-display text-title font-semibold tracking-[-0.02em] text-primary sm:text-headline"
            >
              {title}
            </h2>
            {badge}
          </div>
          <div className="mt-4 space-y-3 text-body leading-6 text-secondary">
            {aside}
          </div>
        </div>

        <div className="min-w-0 lg:col-span-8">{children}</div>
      </div>
    </section>
  );
}
