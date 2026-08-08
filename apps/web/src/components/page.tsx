import { NotBuiltYet } from '@localize-infra/ui';
import type * as React from 'react';

/**
 * Content column: 1200px maximum, 24px gutters (layout contract,
 * docs/product/04-wireframes.md §1).
 */
export function Page({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    // 24px gutter, 16px below 768 (layout contract §0).
    <div className="mx-auto w-full max-w-[75rem] px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-[22px] font-semibold leading-8 text-primary">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-[65ch] text-[14px] leading-6 text-secondary">
            {description}
          </p>
        ) : null}
      </header>
      {children}
    </div>
  );
}

/**
 * A route that exists in the navigation but has no data behind it.
 *
 * Every one of these could instead be a convincing screen full of invented
 * projects, runs and percentages. That is precisely the thing this product
 * sells against: if the dashboard lies about having data, nothing else it
 * reports can be trusted either.
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
    <Page title={title}>
      {/* Measure-constrained rather than full width: a dashed box stretched
          across 1200px for two lines of prose reads as an unfinished layout,
          not as a deliberate statement. */}
      <NotBuiltYet
        surface={surface}
        blockedBy={blockedBy}
        className="max-w-[65ch]"
      />
    </Page>
  );
}
