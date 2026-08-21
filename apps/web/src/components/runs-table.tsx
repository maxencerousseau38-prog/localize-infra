'use client';

import { DataFilter, DataSearch, DataToolbar } from '@/components/data-toolbar';
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
} from '@localize-infra/ui';
import { GitPullRequest } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

/**
 * A run as this table needs it.
 *
 * Replaces `SampleRun`, whose shape carried two fields real runs do not have: a
 * `trigger` command string, and a duration that always existed. Runs are
 * started from the project page rather than typed as a command, and one still
 * in flight has taken no time yet — so the column is gone and the duration is
 * nullable. Keeping the sample's shape would have meant inventing both on every
 * row.
 */
export interface RunTableRow {
  id: string;
  status:
    | 'queued'
    | 'running'
    | 'awaiting_review'
    | 'succeeded'
    | 'partial'
    | 'failed';
  stage: string;
  framework: string | null;
  keysExtracted: number;
  localesSucceeded: number;
  localesFailed: number;
  durationMs: number | null;
  prNumber: number | null;
  prUrl: string | null;
  error: string | null;
  createdAt: string;
  progressAt: string | null;
}

const STATE: Record<RunTableRow['status'], { tone: Tone; label: string }> = {
  queued: { tone: 'neutral', label: 'Queued' },
  running: { tone: 'neutral', label: 'Running' },
  // Iris, and only here. DESIGN.md §1.4 reserves it for "your judgement is
  // required", which is exactly what this state means.
  awaiting_review: { tone: 'ambiguous', label: 'Needs your call' },
  succeeded: { tone: 'confident', label: 'Succeeded' },
  partial: { tone: 'degraded', label: 'Partial' },
  failed: { tone: 'failed', label: 'Failed' },
};

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'awaiting_review', label: 'Needs you' },
  { value: 'succeeded', label: 'Succeeded' },
  { value: 'failed', label: 'Failed' },
] as const;

type Filter = (typeof FILTERS)[number]['value'];
type SortKey = 'when' | 'duration' | 'strings';

function duration(ms: number | null): string {
  if (ms === null) return '—';
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
      <dt className="text-eyebrow font-medium uppercase text-tertiary">
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
export function RunsTable({ runs }: { runs: readonly RunTableRow[] }) {
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
    const value = (run: RunTableRow, index: number) =>
      sort === 'duration'
        ? (run.durationMs ?? 0)
        : sort === 'strings'
          ? run.keysExtracted
          : runs.length - index;

    return (
      runs
        .map((run, index) => ({ run, order: value(run, index) }))
        .filter(({ run }) => filter === 'all' || run.status === filter)
        // Searches what a real run actually carries. The sample had a `trigger`
        // command string; runs are started from a project page, so the fields
        // somebody would recognise are the framework and the pull request number.
        .filter(
          ({ run }) =>
            !needle ||
            (run.framework ?? '').toLowerCase().includes(needle) ||
            String(run.prNumber ?? '').includes(needle),
        )
        .sort((a, b) => (desc ? b.order - a.order : a.order - b.order))
        .map(({ run }) => run)
    );
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
            const state = STATE[run.status];
            return (
              <li
                key={run.id}
                className="group relative border-t border-subtle"
              >
                <div className="flex items-baseline justify-between gap-3 pt-3">
                  <StatusDot tone={state.tone}>{state.label}</StatusDot>
                  <span className="shrink-0 text-caption text-tertiary">
                    {new Date(run.createdAt).toISOString().slice(0, 10)}
                  </span>
                </div>

                <Link
                  href={`/runs/${run.id}`}
                  aria-label={`Run ${run.id.replace('run-', '')}, ${state.label.toLowerCase()}`}
                  className="mt-1.5 block font-mono text-caption text-secondary after:absolute after:inset-0 group-hover:text-primary focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
                >
                  {run.framework ?? 'run'} · {run.id.slice(0, 8)}
                </Link>

                <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2 pb-3.5">
                  <Fact label="Locales">
                    {run.localesFailed > 0 ? (
                      <span className="text-degraded-text">
                        {run.localesSucceeded}/
                        {run.localesSucceeded + run.localesFailed}
                      </span>
                    ) : (
                      run.localesSucceeded || '—'
                    )}
                  </Fact>
                  <Fact label="Strings">{run.keysExtracted || '—'}</Fact>
                  <Fact label="Duration">{duration(run.durationMs)}</Fact>
                  <Fact label="Output">
                    {run.prNumber ? (
                      <span className="inline-flex items-center gap-1.5">
                        {/* No merged state: a run records the pull request it
                            opened, not what happened to it afterwards. The
                            sample carried `prMerged`; reading it from a run
                            would be reporting a fact nobody stored. */}
                        <GitPullRequest
                          className="size-3.5 shrink-0 text-tertiary"
                          aria-hidden="true"
                        />
                        #{run.prNumber}
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
              const state = STATE[run.status];
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
                      {run.framework ?? 'run'} · {run.id.slice(0, 8)}
                    </Link>
                  </TD>
                  <TD numeric className="hidden tabular-nums lg:table-cell">
                    {run.localesFailed > 0 ? (
                      <span className="text-degraded-text">
                        {run.localesSucceeded}/
                        {run.localesSucceeded + run.localesFailed}
                      </span>
                    ) : (
                      `${run.localesSucceeded || '—'}`
                    )}
                  </TD>
                  <TD numeric className="hidden tabular-nums sm:table-cell">
                    {run.keysExtracted || '—'}
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
                          className="size-3.5 shrink-0 text-tertiary"
                          aria-hidden="true"
                        />
                        <span className="font-mono text-caption text-secondary">
                          #{run.prNumber}
                        </span>
                      </span>
                    ) : (
                      <span className="text-tertiary">—</span>
                    )}
                  </TD>
                  <TD className="whitespace-nowrap text-tertiary">
                    {new Date(run.createdAt).toISOString().slice(0, 10)}
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
