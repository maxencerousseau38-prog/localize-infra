import { ChevronRight } from 'lucide-react';
import type * as React from 'react';
import { cn } from '../lib/cn';

/**
 * Breadcrumb, pagination and keyboard hints.
 *
 * These were evaluated against shadcn's equivalents under DESIGN.md §15 and
 * written here instead. Both of shadcn's are plain semantic markup — no focus
 * management, no roving tabindex, no collision detection — so they fail the
 * second adoption gate, and importing them would drag in a second token
 * vocabulary (`text-muted-foreground`, `text-foreground`) for markup we can
 * write correctly in a few lines.
 *
 * What was worth taking is the ARIA pattern, which shadcn encodes correctly and
 * which is easy to get subtly wrong: the current page is a `<span>` carrying
 * `aria-current="page"` rather than a link, and separators are decorative and
 * hidden. That is reproduced exactly.
 */

/* ── Breadcrumb ──────────────────────────────────────────────── */

export function Breadcrumb({
  className,
  ...props
}: React.ComponentProps<'nav'>) {
  return <nav aria-label="Breadcrumb" className={className} {...props} />;
}

export function BreadcrumbList({
  className,
  ...props
}: React.ComponentProps<'ol'>) {
  return (
    <ol
      className={cn(
        'flex flex-wrap items-center gap-1.5 text-small text-tertiary',
        className,
      )}
      {...props}
    />
  );
}

export function BreadcrumbItem({
  className,
  ...props
}: React.ComponentProps<'li'>) {
  return (
    <li
      className={cn('inline-flex items-center gap-1.5', className)}
      {...props}
    />
  );
}

/**
 * The current page. Not a link — it goes nowhere, and making it one is the most
 * common breadcrumb defect. `aria-current` is what screen readers announce.
 */
export function BreadcrumbPage({
  className,
  ...props
}: React.ComponentProps<'span'>) {
  return (
    <span
      aria-current="page"
      className={cn('font-medium text-primary', className)}
      {...props}
    />
  );
}

/** Decorative. Hidden from assistive technology — the list conveys the order. */
export function BreadcrumbSeparator({
  className,
  children,
  ...props
}: React.ComponentProps<'li'>) {
  return (
    <li
      role="presentation"
      aria-hidden="true"
      className={cn('text-tertiary [&>svg]:size-3', className)}
      {...props}
    >
      {children ?? <ChevronRight />}
    </li>
  );
}

/* ── Keyboard hint ───────────────────────────────────────────── */

/**
 * A key, rendered as one.
 *
 * Keyboard affordances were previously written as bare mono text ("j / k to
 * move"), which reads as prose rather than as keys. DESIGN.md §9 requires
 * shortcuts to be shown; showing them as keys is what makes them scannable.
 */
export function Kbd({ className, ...props }: React.ComponentProps<'kbd'>) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-sm px-1.5',
        'border border-subtle bg-surface',
        'font-mono text-micro font-medium text-secondary',
        className,
      )}
      {...props}
    />
  );
}

/* ── Pagination ──────────────────────────────────────────────── */

/**
 * Pagination for data surfaces (DESIGN.md §8).
 *
 * Deliberately a summary plus two controls rather than a numbered page strip:
 * numbered pages are a navigation pattern for documents, and the question a
 * developer asks of a run list is "am I seeing everything?", which the count
 * answers directly. The range is announced politely so the answer reaches a
 * screen reader when the page changes.
 */
export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  noun,
  className,
}: {
  /** 1-based. */
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  /** Singular noun for the row, e.g. "run". */
  noun: string;
  className?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 border-t border-subtle pt-3',
        className,
      )}
    >
      <p aria-live="polite" className="text-caption text-tertiary">
        <span className="font-mono text-secondary">
          {first}–{last}
        </span>{' '}
        of <span className="font-mono text-secondary">{total}</span>{' '}
        {total === 1 ? noun : `${noun}s`}
      </p>

      <div className="flex items-center gap-1.5">
        <PageButton
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          label="Previous page"
        >
          Previous
        </PageButton>
        <PageButton
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pages}
          label="Next page"
        >
          Next
        </PageButton>
      </div>
    </div>
  );
}

function PageButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'h-7 rounded-md border border-line px-2.5 text-caption font-medium text-secondary',
        'transition-colors duration-(--duration-micro)',
        'hover:bg-surface hover:text-primary',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
        'disabled:pointer-events-none disabled:opacity-40',
      )}
    >
      {children}
    </button>
  );
}
