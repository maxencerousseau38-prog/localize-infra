import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import type * as React from 'react';
import { cn } from '../lib/cn';

/**
 * Zebra striping is deliberately absent (design system §4.3): alternating row
 * fills compete with the State Rule, which is the system's primary signal for
 * the state of a piece of copy. Borders separate rows instead.
 *
 * Density is inverted from where it started (DESIGN.md §11).
 *
 * Rows were 44px by default and `dense` (36px) existed but was used by no
 * table in the product — which is how a tool meant to be read for hours ended
 * up leaving a third of its primary surface empty. Dense is now the default and
 * `comfortable` is the exception, justified by a row carrying two lines.
 *
 * Density is expressed once, here, rather than threaded through every cell.
 */
export function Table({
  className,
  comfortable = false,
  ...props
}: React.TableHTMLAttributes<HTMLTableElement> & {
  /** 44px rows. Only for rows that genuinely carry two lines of content. */
  comfortable?: boolean;
}) {
  return (
    <div className="w-full overflow-x-auto">
      <table
        data-comfortable={comfortable || undefined}
        className={cn(
          'w-full border-collapse text-start',
          '[&[data-comfortable]_td]:h-11 [&[data-comfortable]_th]:h-9',
          className,
        )}
        {...props}
      />
    </div>
  );
}

export function THead({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn('[&_tr]:border-b [&_tr]:border-line', className)}
      {...props}
    />
  );
}

export function TBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody
      className={cn('[&_tr]:border-b [&_tr]:border-subtle', className)}
      {...props}
    />
  );
}

export function TR({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        'transition-colors duration-(--duration-micro)',
        'hover:bg-surface',
        className,
      )}
      {...props}
    />
  );
}

export function TH({
  className,
  numeric = false,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <th
      scope="col"
      className={cn(
        'h-8 px-2 align-middle sm:px-3',
        'text-caption font-medium uppercase tracking-wide text-tertiary',
        numeric ? 'text-end' : 'text-start',
        className,
      )}
      {...props}
    />
  );
}

export function TD({
  className,
  numeric = false,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <td
      data-numeric={numeric || undefined}
      className={cn(
        'h-9 px-2 text-body leading-5 text-secondary sm:px-3',
        numeric ? 'text-end' : 'text-start',
        className,
      )}
      {...props}
    />
  );
}

/**
 * Sortable header. Direction is conveyed by an explicit icon and by
 * `aria-sort`, never by colour or position alone, and the neutral state shows a
 * two-way chevron so the column reads as sortable before it is sorted.
 */
export function SortableTH({
  label,
  direction,
  onSort,
  numeric = false,
  className,
}: {
  label: string;
  direction?: 'asc' | 'desc' | null;
  onSort: () => void;
  numeric?: boolean;
  className?: string;
}) {
  const Icon =
    direction === 'asc'
      ? ArrowUp
      : direction === 'desc'
        ? ArrowDown
        : ChevronsUpDown;
  return (
    <th
      scope="col"
      aria-sort={
        direction === 'asc'
          ? 'ascending'
          : direction === 'desc'
            ? 'descending'
            : 'none'
      }
      className={cn('h-8 px-0 align-middle', className)}
    >
      <button
        type="button"
        onClick={onSort}
        className={cn(
          'flex h-8 w-full items-center gap-1.5 px-3',
          'text-caption font-medium uppercase tracking-wide text-tertiary',
          'transition-colors hover:text-secondary',
          'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
          numeric && 'justify-end',
        )}
      >
        {label}
        <Icon
          className={cn('size-3', !direction && 'opacity-50')}
          aria-hidden="true"
        />
      </button>
    </th>
  );
}

/**
 * Empty state rendered INSIDE the table body, never replacing the table
 * (design system §4.3) — so the column headers stay visible and the user can
 * still see what they were looking for.
 *
 * The cell contributes horizontal padding only. Its intended child is
 * `EmptyState`, which brings its own vertical rhythm; adding more here stacked
 * the two and produced a 380px-tall blank row for one line of text. A child
 * that is bare text should be wrapped, or given its own padding.
 */
export function TableEmpty({
  colSpan,
  children,
}: {
  colSpan: number;
  children: React.ReactNode;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 text-center">
        {children}
      </td>
    </tr>
  );
}
