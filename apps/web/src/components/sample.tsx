import { cn } from '@localize-infra/ui';
import { FlaskConical } from 'lucide-react';
import type * as React from 'react';

/**
 * The marker that makes sample data honest.
 *
 * Deliberately uses no state hue. Iris, Jade, Amber and Crimson all mean
 * something specific about a piece of copy's confidence; borrowing one here
 * would put a sample surface in conversation with the state system and make a
 * demo row look like a real verdict. Sample is chrome, so sample is graphite —
 * a dashed edge, which the solid State Rule never is.
 */
export function SampleBanner({
  children,
  className,
}: {
  /** What would be real here once the backend exists. Be specific. */
  children: React.ReactNode;
  className?: string;
}) {
  return (
    /*
     * One line, not a panel.
     *
     * This was a filled, bordered block roughly 80px tall sitting between the
     * page header and the first row of content — on a surface whose entire job
     * is to show rows. The shell now carries a persistent "no project
     * connected" notice in the sidebar footer, so this is the second time a
     * reader is told, and it does not need to be the loudest element on screen
     * to be honest.
     *
     * The contract is unchanged and still enforced by test: the sentence is
     * present and visible on every sample route, the breadcrumb keeps its chip,
     * and the region keeps its dashed edge and accessible name. Only the weight
     * changed.
     */
    <div
      className={cn(
        'flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b border-dashed border-strong pb-2.5',
        className,
      )}
    >
      <FlaskConical
        className="size-3.5 shrink-0 translate-y-0.5 text-tertiary"
        aria-hidden="true"
        strokeWidth={1.5}
      />
      <p className="text-small font-medium text-primary">
        Sample data — this is not your project
      </p>
      <p className="min-w-0 text-small text-tertiary">{children}</p>
    </div>
  );
}

/**
 * Wraps a region rendered from sample data.
 *
 * The dashed leading edge runs the height of the region, so scrolling past the
 * banner never leaves a reader looking at unlabelled rows. `aria-label` carries
 * the same fact to assistive technology, which the border cannot.
 */
export function SampleRegion({
  children,
  label,
  className,
}: {
  children: React.ReactNode;
  label: string;
  className?: string;
}) {
  return (
    <section
      aria-label={`${label} (sample data)`}
      className={cn(
        '[border-inline-start-width:2px] [border-inline-start-style:dashed]',
        '[border-inline-start-color:var(--border-strong)]',
        'ps-4',
        className,
      )}
    >
      {children}
    </section>
  );
}

/** Breadcrumb chip. Present on every route whose content is sample. */
export function SampleChip() {
  return (
    <span className="inline-flex items-center gap-1 rounded-sm border border-dashed border-strong px-1.5 py-0.5 text-micro font-medium uppercase tracking-wide text-tertiary">
      Sample
    </span>
  );
}
