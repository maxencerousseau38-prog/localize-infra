import type * as React from 'react';

/**
 * The eyebrow-and-heading block every landing section opens with.
 *
 * It was written out four times, identically — `text-eyebrow` label, `mt-3`,
 * `font-display text-headline font-semibold` — so the one thing that had to
 * change to fix the page's hierarchy had to be changed in four places, and the
 * seven content pages carried a fifth and sixth variant of the same idea.
 *
 * **The step is `display` → `display-lg`, not `headline`.** Measured against
 * the deployed page at 1440: the hero ran 68px and every section heading below
 * it ran 24px, against 17px prose. A section heading 1.4× its own body copy
 * does not rank against it, which is the failure §3.5 names — *"never express
 * hierarchy through size alone when the sizes are close"* — and the ladder was
 * 68 → 24 → 17 with nothing in the middle.
 *
 * This is not a new value. `PageHeader` and the closing band already run
 * `text-display sm:text-display-lg`, so the landing's sections were the one
 * surface that had drifted below the site's own display step. The ladder is now
 * 68 → 40 → 17.
 *
 * Content pages keep `text-headline` for their inner headings, and that is the
 * same rule rather than an exception: there the h2 sits under a 40px `PageHeader`
 * title, so 40 → 24 → 17 already ranks. The step belongs to the surface's
 * register, not to the tag.
 */
export function SectionHeading({
  eyebrow,
  title,
  id,
  children,
  className,
}: {
  eyebrow: string;
  title: string;
  /** Set when a section labels itself by this heading via `aria-labelledby`. */
  id?: string;
  /** Optional lede or supporting prose, rendered under the heading. */
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className ?? 'max-w-3xl'}>
      <p className="text-eyebrow font-medium uppercase text-tertiary">
        {eyebrow}
      </p>
      {/* Steps down below sm, as DESIGN.md §3.4 requires of display type. The
          measure widens with the step: 40px in a 2xl column broke these
          headings onto three lines at 1440. */}
      <h2
        id={id}
        className="mt-3 max-w-[20ch] font-display text-display font-semibold text-primary sm:text-display-lg"
      >
        {title}
      </h2>
      {children}
    </div>
  );
}
