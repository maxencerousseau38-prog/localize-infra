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
          <p className="text-small font-medium uppercase tracking-wide text-tertiary">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-3 max-w-[22ch] font-display text-display font-semibold tracking-[-0.02em] text-primary sm:font-display text-display-lg">
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
