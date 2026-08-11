'use client';

import { DataFilter, DataSearch, DataToolbar } from '@/components/data-toolbar';
import type { SampleRun } from '@/lib/sample';
import { useTableQuery } from '@/lib/use-table-query';
import {
  Badge,
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
} from '@localize-infra/ui';
import Link from 'next/link';
import * as React from 'react';

const STATE: Record<SampleRun['state'], { tone: Tone; label: string }> = {
  succeeded: { tone: 'confident', label: 'Succeeded' },
  partial: { tone: 'degraded', label: 'Partial' },
  failed: { tone: 'failed', label: 'Failed' },
};

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'succeeded', label: 'Succeeded' },
  { value: 'partial', label: 'Partial' },
  { value: 'failed', label: 'Failed' },
] as const;

type Filter = (typeof FILTERS)[number]['value'];
type SortKey = 'when' | 'duration' | 'strings';

function duration(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

/**
 * The run history as an actual data surface (DESIGN.md §8).
 *
 * Sorting is client-side over the rows present, so it genuinely works rather
 * than implying a query engine that does not exist. `order` carries the
 * newest-first index because the sample runs are already in that order and
 * their `when` values are human strings ("2 hours ago"), which do not sort.
 */
export function RunsTable({ runs }: { runs: readonly SampleRun[] }) {
  /*
   * Filter, search and sort live in the URL (DESIGN.md §9), not in component
   * state. This surface's whole audience works by sending each other links —
   * "here are the failed runs from this week" is a URL or it is a screenshot.
   * It was `useState` until now, so no view was shareable or survived a reload.
   */
  const { filter, query, sort, desc, setFilter, setQuery, toggleSort, reset } =
    useTableQuery<Filter, SortKey>({
      filter: 'all',
      sort: 'when',
      desc: true,
    });

  const rows = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    const value = (run: SampleRun, index: number) =>
      sort === 'duration'
        ? run.durationMs
        : sort === 'strings'
          ? run.strings
          : runs.length - index;

    return runs
      .map((run, index) => ({ run, order: value(run, index) }))
      .filter(({ run }) => filter === 'all' || run.state === filter)
      .filter(
        ({ run }) => !needle || run.trigger.toLowerCase().includes(needle),
      )
      .sort((a, b) => (desc ? b.order - a.order : a.order - b.order))
      .map(({ run }) => run);
  }, [runs, filter, query, sort, desc]);

  const direction = (key: SortKey) =>
    sort === key ? (desc ? 'desc' : 'asc') : null;

  return (
    <>
      <DataToolbar count={rows.length} total={runs.length} noun="run">
        <DataFilter
          label="Filter runs by status"
          value={filter}
          options={FILTERS}
          onChange={setFilter}
        />
        <DataSearch
          value={query}
          onChange={setQuery}
          label="Search runs by trigger"
          placeholder="Filter by command…"
        />
      </DataToolbar>

      {/* No chart. A run-history chart would be decoration; the table is the
          information, and it is scannable in one pass. */}
      <Table className="mt-1">
        <THead>
          <TR>
            <TH>Status</TH>
            <TH className="hidden lg:table-cell">Trigger</TH>
            <TH numeric>Locales</TH>
            <SortableTH
              label="Strings"
              numeric
              direction={direction('strings')}
              onSort={() => toggleSort('strings')}
              className="hidden sm:table-cell"
            />
            <SortableTH
              label="Duration"
              numeric
              direction={direction('duration')}
              onSort={() => toggleSort('duration')}
              className="hidden md:table-cell"
            />
            <TH className="hidden md:table-cell">Output</TH>
            <SortableTH
              label="When"
              direction={direction('when')}
              onSort={() => toggleSort('when')}
            />
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? (
            <TableEmpty colSpan={7}>
              <EmptyState
                title="No runs match"
                description="No run in this sample has that status or command."
                action={
                  <button
                    type="button"
                    onClick={reset}
                    className="rounded-sm text-body text-link underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                  >
                    Show all runs
                  </button>
                }
              />
            </TableEmpty>
          ) : (
            rows.map((run) => {
              const state = STATE[run.state];
              return (
                <TR key={run.id} className="relative">
                  <TD>
                    <Badge tone={state.tone}>{state.label}</Badge>
                    {/* The trigger folds in here below lg rather than being
                        dropped: it is how you recognise the run. */}
                    {/* 9rem, not 11: at 390 the folded trigger pushed the table 19px past
                        its container, so the three columns that survive the fold
                        still needed a horizontal scroll to read. The command is
                        truncated either way; the question is only whether the
                        row fits. */}
                    <span className="mt-1 block max-w-[9rem] truncate font-mono text-caption text-tertiary sm:max-w-[18rem] lg:hidden">
                      {run.trigger}
                    </span>
                  </TD>
                  <TD className="hidden lg:table-cell">
                    {/* One focus stop per row, and the whole row is the click
                        target. The accessible name says which run, because
                        "localize-infra init" repeats down the column. */}
                    <Link
                      href={`/runs/${run.id}`}
                      aria-label={`Run ${run.id.replace('run-', '')}, ${state.label.toLowerCase()}`}
                      className="font-mono text-caption text-secondary after:absolute after:inset-0 hover:text-primary focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
                    >
                      {run.trigger}
                    </Link>
                  </TD>
                  <TD numeric>
                    {run.localesFailed > 0 ? (
                      <span className="text-degraded-text">
                        {run.locales - run.localesFailed}/{run.locales}
                      </span>
                    ) : (
                      `${run.locales}`
                    )}
                  </TD>
                  <TD numeric className="hidden sm:table-cell">
                    {run.strings || '—'}
                  </TD>
                  <TD numeric className="hidden md:table-cell">
                    {duration(run.durationMs)}
                  </TD>
                  <TD className="hidden md:table-cell">
                    {run.prNumber ? (
                      <span className="text-link">
                        #{run.prNumber}
                        {run.prMerged ? ' · merged' : ''}
                      </span>
                    ) : (
                      <span className="text-tertiary">None</span>
                    )}
                  </TD>
                  <TD className="whitespace-nowrap">{run.when}</TD>
                </TR>
              );
            })
          )}
        </TBody>
      </Table>
    </>
  );
}
