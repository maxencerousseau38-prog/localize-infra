'use client';

import { cn } from '@localize-infra/ui';
import { Search, X } from 'lucide-react';
import * as React from 'react';

/**
 * The control band above a data surface (DESIGN.md §8).
 *
 * The audit found every table in the application was a static list: no count,
 * no filter, no search, no sort. Three rows that cannot be narrowed is a mock
 * of a table, and it was the single largest gap between this product and the
 * tools it is measured against — a gap that was never visual.
 *
 * These controls operate on the rows actually present, client-side. That is a
 * real capability, not a simulated backend: the filter genuinely filters, so
 * nothing here silently fails the way a disabled-looking Save button would.
 * When the data behind these surfaces becomes real, the same controls move to
 * the query rather than being written for the first time.
 */
export function DataToolbar({
  count,
  total,
  noun,
  children,
}: {
  /** Rows after filtering. */
  count: number;
  /** Rows before filtering. */
  total: number;
  /** Singular noun for the row, e.g. "run". */
  noun: string;
  children?: React.ReactNode;
}) {
  const filtered = count !== total;
  return (
    /*
     * Below sm this is two rows, not one squeezed row: the filter and the count
     * share the first, and the search takes the full width of the second. The
     * single-row version fit at 1440 and broke at 390 — the search collapsed to
     * a stub and the count was pushed off-screen entirely, which is the
     * scaled-down-desktop failure DESIGN.md §12 exists to prevent.
     *
     * `order` does the rearranging so the count stays one live region rather
     * than being duplicated per breakpoint.
     */
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-subtle pb-3">
      {children}
      {/* The count is live: a filter that changes the result without saying so
          leaves the user unsure whether it applied. */}
      <p
        aria-live="polite"
        className="order-2 ms-auto shrink-0 text-caption text-tertiary sm:order-3"
      >
        <span className="font-mono text-secondary">{count}</span>
        {filtered ? (
          <>
            {' of '}
            <span className="font-mono text-secondary">{total}</span>
          </>
        ) : null}{' '}
        {count === 1 && !filtered ? noun : `${noun}s`}
      </p>
    </div>
  );
}

/** Free-text filter. Narrows on keystroke — this is a filter, not validation. */
export function DataSearch({
  value,
  onChange,
  label,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder: string;
}) {
  return (
    <div className="relative order-3 w-full sm:order-2 sm:w-64 sm:shrink-0">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-tertiary"
      />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
        placeholder={placeholder}
        className={cn(
          'h-8 w-full rounded-md border border-line bg-canvas ps-8 pe-7 text-body text-primary',
          'placeholder:text-tertiary',
          'focus-visible:border-focus focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-focus',
          '[&::-webkit-search-cancel-button]:appearance-none',
        )}
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute end-1.5 top-1/2 -translate-y-1/2 rounded-sm p-1 text-tertiary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus"
        >
          <X className="size-3" aria-hidden="true" />
          <span className="sr-only">Clear search</span>
        </button>
      ) : null}
    </div>
  );
}

/**
 * A one-of-N filter.
 *
 * Built on native radio inputs, not buttons carrying `role="radio"`. The first
 * version did the latter and was a broken radiogroup: ARIA promises arrow-key
 * traversal and a single tab stop, and delivering that over buttons means
 * implementing roving tabindex by hand. Real inputs bring the whole keyboard
 * model with them, and the segmented appearance is only the label's styling.
 *
 * `useId` scopes the input `name` so two filters on one page do not silently
 * join into a single group.
 */
export function DataFilter<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  const name = React.useId();
  return (
    <fieldset className="order-1 shrink-0 border-0 p-0">
      <legend className="sr-only">{label}</legend>
      <div className="flex items-center gap-0.5 rounded-md bg-surface p-0.5">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <label
              key={option.value}
              className={cn(
                'cursor-pointer rounded-[4px] px-2.5 py-1 text-caption font-medium',
                'transition-colors duration-(--duration-micro)',
                // The ring lives on the label because the input itself is
                // visually hidden; `:has()` keeps it tied to real focus.
                'has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-1 has-[:focus-visible]:outline-focus',
                active
                  ? 'bg-canvas text-primary shadow-[0_1px_2px_rgb(0_0_0/0.06)]'
                  : 'text-tertiary hover:text-secondary',
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={active}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              {option.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
