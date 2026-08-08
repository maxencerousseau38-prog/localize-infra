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
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border border-dashed border-strong',
        'bg-surface px-4 py-3',
        className,
      )}
    >
      <FlaskConical
        className="mt-0.5 size-4 shrink-0 text-tertiary"
        aria-hidden="true"
        strokeWidth={1.5}
      />
      <div className="min-w-0">
        <p className="text-body font-medium text-primary">
          Sample data — this is not your project
        </p>
        <p className="mt-0.5 text-small text-secondary">{children}</p>
      </div>
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
