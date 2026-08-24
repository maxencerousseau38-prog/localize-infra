'use client';

import { DataFilter, DataSearch, DataToolbar } from '@/components/data-toolbar';
import type { ProposedTranslation } from '@/lib/data/workspace';
import {
  type ProposalSortKey,
  proposalLocales,
  proposalOrigins,
  selectProposals,
} from '@/lib/runs/proposals';
import { useTableQuery, useUrlFilter } from '@/lib/use-table-query';
import {
  Badge,
  Button,
  EmptyState,
  SortableTH,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  TableEmpty,
  type Tone,
  localeDisplayName,
  localeFontClass,
  localeTextProps,
} from '@localize-infra/ui';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import * as React from 'react';

/**
 * What a run proposed, as a data surface (DESIGN.md §8).
 *
 * `/runs/[id]` already fetched every one of these rows — key, source, proposal,
 * locale and origin — and used them to compute a per-locale count. A run of a
 * hundred strings in three languages loaded three hundred rows of text to
 * display three numbers. This shows them.
 *
 * **Read-only, deliberately.** The repository has exactly two mutations over
 * this data, `resolveAmbiguity` and `approveRun`, both on the project page, and
 * `run_translations.proposed_text` has no update path at all — a proposal is
 * immutable once recorded. `/review` previously carried Approve and
 * Suggest-a-change buttons that did nothing, and they were deleted rather than
 * wired, because approving a run is one decision about the whole run and not a
 * verdict per string. A row action here would re-create exactly that.
 *
 * Client-side over rows the server already sent. The controls genuinely narrow
 * what is present rather than standing in for a query that does not exist; when
 * a run grows past what is reasonable to ship in one payload, the same controls
 * move to the query and the component keeps its shape.
 */

const ORIGIN: Record<
  ProposedTranslation['origin'],
  { tone: Tone; label: string; hint: string }
> = {
  model: {
    tone: 'neutral',
    label: 'Translated',
    hint: 'Newly translated in this run',
  },
  preserved: {
    tone: 'confident',
    label: 'Kept',
    hint: 'Already in the repository; kept, never overwritten',
  },
  resolved: {
    tone: 'ambiguous',
    label: 'Answered',
    hint: 'An ambiguity a person answered',
  },
};

export function ProposalsTable({
  proposals,
}: { proposals: readonly ProposedTranslation[] }) {
  // Search, sort and page live in the URL (DESIGN.md §9) so a reader can send a
  // colleague the exact row they are asking about.
  const { query, sort, desc, page, setQuery, toggleSort, setPage, reset } =
    useTableQuery<'all', ProposalSortKey>({
      filter: 'all',
      sort: 'key',
      desc: false,
    });
  /*
   * Widened to `string` on purpose. Inferred from the default alone the type
   * would be the literal `'all'`, and the filter could then only ever offer the
   * option that means "no filter".
   */
  const [locale, setLocale] = useUrlFilter<string>('locale', 'all');
  const [origin, setOrigin] = useUrlFilter<string>('origin', 'all');

  const locales = React.useMemo(() => proposalLocales(proposals), [proposals]);
  const origins = React.useMemo(() => proposalOrigins(proposals), [proposals]);

  const result = React.useMemo(
    () =>
      selectProposals(proposals, { query, locale, origin, sort, desc, page }),
    [proposals, query, locale, origin, sort, desc, page],
  );

  const direction = (key: ProposalSortKey) =>
    sort === key ? (desc ? 'desc' : 'asc') : null;

  return (
    <div>
      <DataToolbar count={result.matched} total={result.total} noun="proposal">
        {/* Offered only when there is a choice to make. One locale is not a
            filter, it is a label that cannot be changed. */}
        {locales.length > 1 ? (
          <DataFilter
            label="Language"
            value={locale}
            onChange={setLocale}
            options={[
              { value: 'all', label: 'All' },
              ...locales.map((code) => ({
                value: code,
                label: code,
              })),
            ]}
          />
        ) : null}
        {origins.length > 1 ? (
          <DataFilter
            label="Origin"
            value={origin}
            onChange={setOrigin}
            options={[
              { value: 'all', label: 'All' },
              ...origins.map((value) => ({
                value,
                label: ORIGIN[value].label,
              })),
            ]}
          />
        ) : null}
        <DataSearch
          value={query}
          onChange={setQuery}
          label="Search proposals"
          placeholder="Key, source or translation"
        />
      </DataToolbar>

      <Table>
        <THead>
          <TR>
            <SortableTH
              label="Key"
              direction={direction('key')}
              onSort={() => toggleSort('key')}
            />
            {/* Plain headers, not sortable ones. The first version made these
                look sortable and quietly sorted by key — a control that
                responds by doing something else is worse than no control. */}
            <TH>Source</TH>
            <TH>Proposed</TH>
            <SortableTH
              label="Language"
              direction={direction('locale')}
              onSort={() => toggleSort('locale')}
            />
            <SortableTH
              label="Origin"
              direction={direction('origin')}
              onSort={() => toggleSort('origin')}
            />
          </TR>
        </THead>
        <TBody>
          {result.rows.length === 0 ? (
            <TableEmpty colSpan={5}>
              <EmptyState
                title="No proposal matches"
                description="Nothing in this run matches the current search and filters."
                action={
                  <Button variant="secondary" size="sm" onClick={reset}>
                    Clear search
                  </Button>
                }
              />
            </TableEmpty>
          ) : (
            result.rows.map((row) => (
              <TR key={`${row.locale}:${row.translation_key}`}>
                <TD className="font-mono text-caption text-secondary">
                  {row.translation_key}
                </TD>
                <TD className="text-secondary">{row.source_text}</TD>
                {/* The proposal is rendered in its own script and direction —
                    a right-to-left translation shown left-to-right is wrong in
                    the one place a reader is checking it. */}
                <TD
                  {...localeTextProps(row.locale)}
                  className={localeFontClass(row.locale)}
                >
                  {row.proposed_text}
                </TD>
                <TD className="whitespace-nowrap">
                  {localeDisplayName(row.locale)}{' '}
                  <span className="font-mono text-caption text-tertiary">
                    {row.locale}
                  </span>
                </TD>
                <TD>
                  {/* The label is short enough to fit a column and vague on its
                      own; the hint is the enum's own wording from
                      `translation_origin`, so the two cannot drift. */}
                  <span title={ORIGIN[row.origin].hint}>
                    <Badge tone={ORIGIN[row.origin].tone}>
                      {ORIGIN[row.origin].label}
                    </Badge>
                  </span>
                </TD>
              </TR>
            ))
          )}
        </TBody>
      </Table>

      {result.pageCount > 1 ? (
        <nav
          aria-label="Proposal pages"
          className="flex items-center justify-between gap-4 border-t border-subtle pt-3"
        >
          <Button
            variant="secondary"
            size="sm"
            disabled={result.page <= 1}
            onClick={() => setPage(result.page - 1)}
          >
            <ChevronLeft aria-hidden="true" />
            Previous
          </Button>
          {/* Announced, because paging changes the whole table below it and a
              silent swap leaves a screen-reader user on an unchanged heading. */}
          <p aria-live="polite" className="text-caption text-tertiary">
            Page <span className="font-mono text-secondary">{result.page}</span>{' '}
            of{' '}
            <span className="font-mono text-secondary">{result.pageCount}</span>
          </p>
          <Button
            variant="secondary"
            size="sm"
            disabled={result.page >= result.pageCount}
            onClick={() => setPage(result.page + 1)}
          >
            Next
            <ChevronRight aria-hidden="true" />
          </Button>
        </nav>
      ) : null}
    </div>
  );
}
