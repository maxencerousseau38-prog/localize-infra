import { NotBuiltYet, cn } from '@localize-infra/ui';
import type * as React from 'react';

/**
 * The content column (DESIGN.md §4.2).
 *
 * `content` is 1200px and is the default: prose, forms and reading surfaces
 * gain nothing from more width, and a 68ch measure stretched across 1920 is
 * worse, not better.
 *
 * `wide` is for a data surface that is *hiding* columns at 1440 and can reveal
 * them above 1680. That qualifier is load-bearing and was learned by building
 * the other version first: widening the run table to 1600 did not add any
 * information, it just poured the slack into the widest column. Empty space at
 * 1920 is a real finding, but stretching columns to cover it is decoration, and
 * on a three-row sample the emptiness is a data problem that no layout fixes.
 *
 * No surface qualifies today — every column is already visible at 1440. Kept
 * because the responsive contract in DESIGN.md §4.2 has to have one place it is
 * expressed, and because the next surface with real column pressure should find
 * the decision already made rather than inventing a local one.
 */
export function Page({
  children,
  width = 'content',
}: {
  children: React.ReactNode;
  width?: 'content' | 'wide';
}) {
  return (
    <div
      className={cn(
        'mx-auto w-full px-4 pb-16 sm:px-6',
        width === 'wide'
          ? 'max-w-[75rem] wide:max-w-[100rem]'
          : 'max-w-[75rem]',
      )}
    >
      {children}
    </div>
  );
}

/**
 * The page header band.
 *
 * Replaces a bare `h1` floating in whitespace, which was the root of the app
 * reading as a scaffold: a title with nothing around it gives the eye no
 * structure to land on. Title, purpose, metadata and the primary action sit on
 * one band closed by a rule, so every route opens the same way and the content
 * below starts against a horizon rather than in mid-air.
 */
export function PageHeader({
  title,
  purpose,
  meta,
  action,
}: {
  title: string;
  /** One line. What this surface is for, in the reader's terms. */
  purpose?: string;
  /** Scannable facts — counts, timestamps. Not decoration. */
  meta?: React.ReactNode;
  /** The single primary action, if the surface has one. */
  action?: React.ReactNode;
}) {
  return (
    /*
     * The metadata row moves up beside the title instead of sitting on its own
     * line below the purpose (DESIGN.md §4.6).
     *
     * The header was spending three stacked bands — title, purpose, meta — plus
     * a rule, before a data surface showed its first row. On /runs that put the
     * first row at 35% of the viewport on a page whose entire job is rows. The
     * facts in the meta row are short and scannable; they belong on the title's
     * baseline, where they read as a status line rather than as a third
     * paragraph.
     */
    <header className="border-b border-subtle pb-4 pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-3">
        <div className="min-w-0">
          {/* DESIGN.md §3.4: display type steps down below sm. 28px was
              constant from 390 to 1920, which on a phone spends a third of the
              width on the title before any content appears. */}
          <h1 className="font-display text-title font-semibold tracking-[-0.02em] text-primary sm:text-display">
            {title}
          </h1>
          {purpose ? (
            <p className="mt-1.5 max-w-[68ch] text-body text-secondary">
              {purpose}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-baseline gap-x-6 gap-y-2">
          {meta ? (
            <dl className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
              {meta}
            </dl>
          ) : null}
          {action}
        </div>
      </div>
    </header>
  );
}

/** One fact in the header metadata row. */
export function PageMeta({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-caption uppercase tracking-wide text-tertiary">
        {label}
      </dt>
      <dd className="text-small font-medium text-primary">{children}</dd>
    </div>
  );
}

/** Vertical rhythm between page sections. */
export function PageSection({
  title,
  description,
  action,
  children,
  className,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('mt-8', className)}>
      {title ? (
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            {/* DESIGN.md §3.5: two steps below the page title, not one.
                `display` 28 over `title` 20 is a single step doing display
                duty, and the two read as siblings. At `subtitle` 16 semibold
                the ranking is unambiguous, and the section header stops
                spending 20px of vertical space it had not earned. */}
            <h2 className="text-subtitle font-semibold tracking-[-0.01em] text-primary">
              {title}
            </h2>
            {description ? (
              <p className="mt-1 max-w-[68ch] text-small text-secondary">
                {description}
              </p>
            ) : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/**
 * A route with no backend and nothing to demonstrate.
 *
 * Retained only for Settings. Everywhere else, a surface that would show data
 * now shows its real interface with labelled sample data instead — a
 * placeholder there would mean abandoning the design rather than being honest
 * about the data. Settings is different: its controls would not work, so there
 * is nothing to demonstrate, only buttons that lie.
 */
export function UnbuiltPage({
  title,
  surface,
  blockedBy,
}: {
  title: string;
  surface: string;
  blockedBy: string;
}) {
  return (
    <Page>
      <PageHeader title={title} />
      <div className="mt-8">
        <NotBuiltYet
          surface={surface}
          blockedBy={blockedBy}
          className="max-w-[65ch]"
        />
      </div>
    </Page>
  );
}
