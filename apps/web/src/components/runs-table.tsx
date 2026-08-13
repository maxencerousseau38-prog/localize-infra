'use client';

import { DataFilter, DataSearch, DataToolbar } from '@/components/data-toolbar';
import type { SampleRun } from '@/lib/sample';
import { useTableQuery } from '@/lib/use-table-query';
import {
  EmptyState,
  SortableTH,
  StatusDot,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  TableEmpty,
  type Tone,
  cn,
} from '@localize-infra/ui';
import { GitPullRequest } from 'lucide-react';
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

/** One labelled fact in the small-screen record. */
function Fact({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-micro font-medium uppercase tracking-[0.1em] text-tertiary">
        {label}
      </dt>
      <dd className="mt-0.5 font-mono text-caption tabular-nums text-primary">
        {children}
      </dd>
    </div>
  );
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

      {/*
       * Below md the table becomes records, not a narrower table.
       *
       * The columns used to drop at breakpoints until a 390px screen showed
       * status, command and a relative time — locales, strings, duration and
       * the pull request were not scrolled off, they were `display: none`. A
       * developer checking a run from a phone got the three least useful facts
       * and no way to reach the rest.
       *
       * Same rows, same links, same accessible names; only the arrangement
       * changes, so the desktop table keeps its real `table` semantics and
       * sortable headers rather than both surfaces settling for a compromise.
       */}
      <ul className="mt-1 md:hidden">
        {rows.length === 0 ? (
          <li className="border-t border-subtle py-10">
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
          </li>
        ) : (
          rows.map((run) => {
            const state = STATE[run.state];
            return (
              <li
                key={run.id}
                className="group relative border-t border-subtle"
              >
                <div className="flex items-baseline justify-between gap-3 pt-3">
                  <StatusDot tone={state.tone}>{state.label}</StatusDot>
                  <span className="shrink-0 text-caption text-tertiary">
                    {run.when}
                  </span>
                </div>

                <Link
                  href={`/runs/${run.id}`}
                  aria-label={`Run ${run.id.replace('run-', '')}, ${state.label.toLowerCase()}`}
                  className="mt-1.5 block font-mono text-caption text-secondary after:absolute after:inset-0 group-hover:text-primary focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
                >
                  {run.trigger}
                </Link>

                <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2 pb-3.5">
                  <Fact label="Locales">
                    {run.localesFailed > 0 ? (
                      <span className="text-degraded-text">
                        {run.locales - run.localesFailed}/{run.locales}
                      </span>
                    ) : (
                      run.locales
                    )}
                  </Fact>
                  <Fact label="Strings">{run.strings || '—'}</Fact>
                  <Fact label="Duration">{duration(run.durationMs)}</Fact>
                  <Fact label="Output">
                    {run.prNumber ? (
                      <span className="inline-flex items-center gap-1.5">
                        <GitPullRequest
                          className={cn(
                            'size-3.5 shrink-0',
                            run.prMerged ? 'text-confident' : 'text-tertiary',
                          )}
                          aria-hidden="true"
                        />
                        #{run.prNumber}
                        {run.prMerged ? (
                          <span className="text-tertiary">merged</span>
                        ) : null}
                      </span>
                    ) : (
                      <span className="text-tertiary">—</span>
                    )}
                  </Fact>
                </dl>
              </li>
            );
          })
        )}
      </ul>

      {/* No chart. A run-history chart would be decoration; the table is the
          information, and it is scannable in one pass. */}
      <Table className="mt-1 hidden md:table">
        <THead>
          <TR>
            <TH className="w-[7.5rem]">Status</TH>
            <TH>Run</TH>
            <TH numeric className="hidden lg:table-cell">
              Locales
            </TH>
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
                <TR key={run.id} className="group relative">
                  <TD>
                    {/* A dot and a word, not a pill. At three rows a badge per
                        row looks considered; at thirty it is a column of
                        coloured rectangles competing with the thing the reader
                        is actually scanning for. */}
                    <StatusDot tone={state.tone}>{state.label}</StatusDot>
                  </TD>
                  <TD>
                    {/* The command is the row's identity, so it leads rather
                        than hiding behind a status column until lg. One focus
                        stop per row and the whole row is the click target; the
                        accessible name carries the run id, because
                        "localize-infra init" repeats down the column.

                        The width cap still matters at 390 — an uncapped command
                        pushed the table past its container — but the column is
                        no longer dropped and re-folded at a breakpoint. */}
                    <Link
                      href={`/runs/${run.id}`}
                      aria-label={`Run ${run.id.replace('run-', '')}, ${state.label.toLowerCase()}`}
                      className="block max-w-[9rem] truncate font-mono text-caption text-secondary after:absolute after:inset-0 group-hover:text-primary focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus sm:max-w-[20rem] lg:max-w-none"
                    >
                      {run.trigger}
                    </Link>
                  </TD>
                  <TD numeric className="hidden tabular-nums lg:table-cell">
                    {run.localesFailed > 0 ? (
                      <span className="text-degraded-text">
                        {run.locales - run.localesFailed}/{run.locales}
                      </span>
                    ) : (
                      `${run.locales}`
                    )}
                  </TD>
                  <TD numeric className="hidden tabular-nums sm:table-cell">
                    {run.strings || '—'}
                  </TD>
                  <TD
                    numeric
                    className="hidden font-mono tabular-nums md:table-cell"
                  >
                    {duration(run.durationMs)}
                  </TD>
                  {/* The pull request is what a run is for (invariant 2), so it
                      reads as an artefact rather than as a number in a column.
                      An absent one is a quiet dash: no PR is information, not
                      an error, and "None" in full weight read as one. */}
                  <TD className="hidden md:table-cell">
                    {run.prNumber ? (
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                        <GitPullRequest
                          className={cn(
                            'size-3.5 shrink-0',
                            run.prMerged ? 'text-confident' : 'text-tertiary',
                          )}
                          aria-hidden="true"
                        />
                        <span className="font-mono text-caption text-secondary">
                          #{run.prNumber}
                        </span>
                        {run.prMerged ? (
                          <span className="text-caption text-tertiary">
                            merged
                          </span>
                        ) : null}
                      </span>
                    ) : (
                      <span className="text-tertiary">—</span>
                    )}
                  </TD>
                  <TD className="whitespace-nowrap text-tertiary">
                    {run.when}
                  </TD>
                </TR>
              );
            })
          )}
        </TBody>
      </Table>
    </>
  );
}
