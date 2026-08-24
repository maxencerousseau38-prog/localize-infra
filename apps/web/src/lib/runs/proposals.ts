import type { ProposedTranslation } from '@/lib/data/workspace';

/**
 * Narrowing a run's proposals, as a pure function.
 *
 * The searching, filtering, sorting and paging all live here rather than inside
 * the component for one reason: this is the part that can be wrong in ways a
 * screenshot does not show. A filter that quietly drops rows, a sort that is not
 * stable, a last page that renders empty — each of those looks like a working
 * table. `proposals.test.ts` is the only thing that can tell the difference.
 *
 * Client-side over rows the page already holds. `/runs/[id]` was fetching every
 * proposal and using them to compute a per-locale count, so the data is paid for
 * either way; what changes is that it is now shown.
 */

export type ProposalSortKey = 'key' | 'locale' | 'origin';

/**
 * Rows per page.
 *
 * Chosen against the shape of the data rather than by habit: a run's proposals
 * are keys × locales, so a modest fifty-string project in five languages is
 * already 250 rows. Twenty-five keeps the page a scroll rather than a document
 * while leaving the count in the toolbar meaningful.
 */
export const PROPOSALS_PAGE_SIZE = 25;

export interface ProposalQuery {
  query: string;
  /** A locale code, or 'all'. */
  locale: string;
  /** An origin, or 'all'. */
  origin: string;
  sort: ProposalSortKey;
  desc: boolean;
  page: number;
}

export interface ProposalPage {
  /** The rows to render, after everything. */
  rows: ProposedTranslation[];
  /** Rows before filtering — the toolbar's denominator. */
  total: number;
  /** Rows after filtering, before paging — the toolbar's numerator. */
  matched: number;
  pageCount: number;
  /** Clamped: a page beyond the end resolves to the last one. */
  page: number;
}

/**
 * Matched against the key, the source and the proposal together.
 *
 * One box rather than three, because a reader looking for a string does not
 * know in advance whether they remember its key, its English or the translation
 * they saw in the diff. Splitting the search would make them guess.
 */
function matches(row: ProposedTranslation, needle: string): boolean {
  return (
    row.translation_key.toLowerCase().includes(needle) ||
    row.source_text.toLowerCase().includes(needle) ||
    row.proposed_text.toLowerCase().includes(needle)
  );
}

function compare(
  a: ProposedTranslation,
  b: ProposedTranslation,
  key: ProposalSortKey,
): number {
  if (key === 'locale') return a.locale.localeCompare(b.locale);
  if (key === 'origin') return a.origin.localeCompare(b.origin);
  return a.translation_key.localeCompare(b.translation_key);
}

export function selectProposals(
  all: readonly ProposedTranslation[],
  q: ProposalQuery,
): ProposalPage {
  const needle = q.query.trim().toLowerCase();

  const filtered = all.filter(
    (row) =>
      (q.locale === 'all' || row.locale === q.locale) &&
      (q.origin === 'all' || row.origin === q.origin) &&
      (needle === '' || matches(row, needle)),
  );

  /*
   * Sorted on a copy, and always broken by a second key.
   *
   * `filter` already returns a new array, so the copy is belt-and-braces — but
   * the tie-break is not. Sorting a run's proposals by locale leaves every row
   * of that locale equal, and `Array.prototype.sort` is only stable within one
   * engine's implementation of one call. Two readers comparing the same URL
   * should see the same order, so the order is fully determined here.
   */
  const sorted = [...filtered].sort((a, b) => {
    const primary = compare(a, b, q.sort);
    if (primary !== 0) return q.desc ? -primary : primary;
    const secondary =
      q.sort === 'key'
        ? a.locale.localeCompare(b.locale)
        : a.translation_key.localeCompare(b.translation_key);
    return q.desc ? -secondary : secondary;
  });

  const pageCount = Math.max(1, Math.ceil(sorted.length / PROPOSALS_PAGE_SIZE));
  /*
   * Clamped rather than trusted. `page` arrives from the URL, where anybody can
   * type it, and a filter that shrinks the result while the reader sits on page
   * nine would otherwise render a table with headers and no rows — which looks
   * exactly like "no proposals" and is not.
   */
  const page = Math.min(Math.max(1, q.page), pageCount);
  const start = (page - 1) * PROPOSALS_PAGE_SIZE;

  return {
    rows: sorted.slice(start, start + PROPOSALS_PAGE_SIZE),
    total: all.length,
    matched: sorted.length,
    pageCount,
    page,
  };
}

/** The locales this run actually proposed for, in a stable order. */
export function proposalLocales(all: readonly ProposedTranslation[]): string[] {
  return [...new Set(all.map((row) => row.locale))].sort();
}

/**
 * The origins present, in pipeline order rather than alphabetical.
 *
 * `model`, `preserved`, `resolved` is the order a string moves through, and the
 * filter reads as a sequence rather than a list. Only origins actually present
 * are offered: a filter for a value that would return nothing is a control that
 * can only disappoint.
 */
const ORIGIN_ORDER = ['model', 'preserved', 'resolved'] as const;

export function proposalOrigins(
  all: readonly ProposedTranslation[],
): ProposedTranslation['origin'][] {
  const present = new Set(all.map((row) => row.origin));
  return ORIGIN_ORDER.filter((origin) => present.has(origin));
}
