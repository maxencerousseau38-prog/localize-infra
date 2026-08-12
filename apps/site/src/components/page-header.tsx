import type * as React from 'react';

export function PageHeader({
  eyebrow,
  title,
  lede,
  children,
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="border-b border-subtle">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
        {eyebrow ? (
          /* Caption size with wide tracking, matching the landing page's
             section eyebrows. This was `text-small` with `tracking-wide`, so
             the same element read at two different sizes depending on which
             page you were on. */
          <p className="text-eyebrow font-medium uppercase text-tertiary">
            {eyebrow}
          </p>
        ) : null}
        {/*
         * DESIGN.md §3.4: display type steps down below sm.
         *
         * This previously read `text-display … sm:font-display text-display-lg`
         * — the `sm:` prefix had landed on `font-display` and `text-display-lg`
         * was left unprefixed, so it won at every width and the title was a
         * constant 40px from 390 to 1920. The step-down was intended all along;
         * it was one misplaced prefix from working, and nothing in the suite
         * could see it.
         */}
        <h1 className="mt-3 max-w-[22ch] font-display text-display font-semibold text-primary sm:text-display-lg">
          {title}
        </h1>
        {lede ? (
          <p className="mt-4 max-w-[62ch] text-prose text-secondary">{lede}</p>
        ) : null}
        {children}
      </div>
    </header>
  );
}
