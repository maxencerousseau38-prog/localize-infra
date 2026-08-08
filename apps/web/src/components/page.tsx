import { NotBuiltYet, cn } from '@localize-infra/ui';
import type * as React from 'react';

/**
 * Content column: 1200px maximum, 24px gutter, 16px below 768
 * (layout contract, docs/product/04-wireframes.md §0).
 */
export function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[75rem] px-4 pb-16 sm:px-6">
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
    <header className="border-b border-subtle py-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-display font-semibold tracking-[-0.02em] text-primary">
            {title}
          </h1>
          {purpose ? (
            <p className="mt-1.5 max-w-[68ch] text-body text-secondary">
              {purpose}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {meta ? (
        <dl className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
          {meta}
        </dl>
      ) : null}
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
            <h2 className="text-title font-semibold tracking-[-0.01em] text-primary">
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
