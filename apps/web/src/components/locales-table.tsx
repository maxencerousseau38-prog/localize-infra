'use client';

import { DataSearch, DataToolbar } from '@/components/data-toolbar';
import type { ConfidenceState, SampleLocale } from '@/lib/sample';
import { useTableQuery } from '@/lib/use-table-query';
import {
  EmptyState,
  ProgressBar,
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
  localeDisplayName,
  localeFontClass,
  localeTextProps,
} from '@localize-infra/ui';
import * as React from 'react';

const TONE: Record<ConfidenceState, { tone: Tone; label: string }> = {
  confident: { tone: 'confident', label: 'Current' },
  ambiguous: { tone: 'ambiguous', label: 'Needs a decision' },
  degraded: { tone: 'degraded', label: 'Behind' },
  failed: { tone: 'failed', label: 'Failed' },
  neutral: { tone: 'neutral', label: 'Unknown' },
};

/** A sample of the language, in its own script — the product proving it cares. */
const SPECIMEN: Record<string, string | undefined> = {
  de: 'Änderungen speichern',
  ja: '変更を保存',
  es: 'Guardar cambios',
  'pt-BR': 'Salvar alterações',
  ar: 'حفظ التغييرات',
};

type SortKey = 'coverage' | 'language';

/**
 * Locale coverage as a data surface (DESIGN.md §8).
 *
 * Search matches the display name and the code together, because a reader
 * looking for Brazilian Portuguese may type either "Portuguese" or "pt-BR" and
 * both are the same intent. Five rows do not need this; thirty do, and the
 * control belongs to the surface rather than to the row count it happens to
 * have while the data is sample.
 */
export function LocalesTable({
  locales,
}: { locales: readonly SampleLocale[] }) {
  // Search and sort live in the URL, not component state (DESIGN.md §9).
  const { query, sort, desc, setQuery, toggleSort, reset } = useTableQuery<
    'all',
    SortKey
  >({ filter: 'all', sort: 'coverage', desc: true });

  const rows = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return locales
      .filter(
        (locale) =>
          !needle ||
          locale.code.toLowerCase().includes(needle) ||
          localeDisplayName(locale.code).toLowerCase().includes(needle),
      )
      .slice()
      .sort((a, b) => {
        const value =
          sort === 'coverage'
            ? a.translated / a.total - b.translated / b.total
            : localeDisplayName(a.code).localeCompare(
                localeDisplayName(b.code),
              );
        return desc ? -value : value;
      });
  }, [locales, query, sort, desc]);

  const direction = (key: SortKey) =>
    sort === key ? (desc ? 'desc' : 'asc') : null;

  return (
    <>
      <DataToolbar count={rows.length} total={locales.length} noun="language">
        <DataSearch
          value={query}
          onChange={setQuery}
          label="Search languages by name or code"
          placeholder="Filter by language…"
        />
      </DataToolbar>

      {/*
       * Below md a language becomes a record, the same move /runs made.
       *
       * As a narrowed table this was the worse of the two: `State` — the column
       * that answers the page's own question, "which language is behind?" — ran
       * off the right edge and read as "Needs a dec…", while `Translated` and
       * `Last run` were `display: none` entirely. The specimen folded under the
       * language name and wrapped to two lines, so five rows became a ragged
       * stack of eleven.
       *
       * Here the specimen gets its own line at full width, which it deserves:
       * it is the product demonstrating it renders each script and direction
       * properly, and it is the one thing on this surface a reader cannot get
       * from a number.
       */}
      <ul className="mt-1 md:hidden">
        {rows.length === 0 ? (
          <li className="border-t border-subtle py-10">
            <EmptyState
              title="No languages match"
              description="No language in this sample has that name or code."
              action={
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-sm text-body text-link underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  Show all languages
                </button>
              }
            />
          </li>
        ) : (
          rows.map((locale) => {
            const pct = Math.round((locale.translated / locale.total) * 100);
            const tone = TONE[locale.state];
            return (
              <li key={locale.code} className="border-t border-subtle py-3.5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="min-w-0">
                    <span className="font-medium text-primary">
                      {localeDisplayName(locale.code)}
                    </span>{' '}
                    <span className="font-mono text-caption text-tertiary">
                      {locale.code}
                    </span>
                  </span>
                  <StatusDot tone={tone.tone}>{tone.label}</StatusDot>
                </div>

                <p
                  {...localeTextProps(locale.code)}
                  className={cn(
                    'mt-1.5 text-body text-secondary',
                    localeFontClass(locale.code),
                  )}
                >
                  {SPECIMEN[locale.code]}
                </p>

                <div className="mt-3 flex items-center gap-3">
                  <ProgressBar
                    value={locale.translated}
                    max={locale.total}
                    tone={tone.tone}
                    label={`${localeDisplayName(locale.code)} coverage`}
                    className="h-1 min-w-0 flex-1"
                  />
                  <span className="shrink-0 font-mono text-caption tabular-nums text-secondary">
                    {pct}%
                  </span>
                  <span className="shrink-0 font-mono text-caption tabular-nums text-tertiary">
                    {locale.translated}/{locale.total}
                  </span>
                </div>

                <p className="mt-2 text-caption text-tertiary">
                  Last run {locale.lastRun}
                </p>
              </li>
            );
          })
        )}
      </ul>

      <Table className="mt-1 hidden md:table">
        <THead>
          <TR>
            <SortableTH
              label="Language"
              direction={direction('language')}
              onSort={() => toggleSort('language')}
            />
            <TH className="hidden lg:table-cell">Specimen</TH>
            <SortableTH
              label="Coverage"
              numeric
              direction={direction('coverage')}
              onSort={() => toggleSort('coverage')}
            />
            <TH numeric className="hidden sm:table-cell">
              Translated
            </TH>
            <TH>State</TH>
            <TH className="hidden md:table-cell">Last run</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? (
            <TableEmpty colSpan={6}>
              <EmptyState
                title="No languages match"
                description="No language in this sample matches that name or code."
                action={
                  <button
                    type="button"
                    onClick={reset}
                    className="rounded-sm text-body text-link underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                  >
                    Show all languages
                  </button>
                }
              />
            </TableEmpty>
          ) : (
            rows.map((locale) => {
              const pct = Math.round((locale.translated / locale.total) * 100);
              const tone = TONE[locale.state];
              return (
                <TR key={locale.code}>
                  <TD>
                    <span className="font-medium text-primary">
                      {localeDisplayName(locale.code)}
                    </span>{' '}
                    <span className="font-mono text-caption text-tertiary">
                      {locale.code}
                    </span>
                    {/* The specimen is the product demonstrating that it
                        renders each script properly, so it folds in here
                        rather than being dropped on a narrow screen. */}
                    <span
                      {...localeTextProps(locale.code)}
                      className={cn(
                        'mt-0.5 block text-small text-secondary lg:hidden',
                        localeFontClass(locale.code),
                      )}
                    >
                      {SPECIMEN[locale.code]}
                    </span>
                  </TD>
                  {/* Rendered in its own script and direction. A localization
                      product showing Arabic in a Latin fallback would be
                      arguing against itself. */}
                  <TD className="hidden lg:table-cell">
                    <span
                      {...localeTextProps(locale.code)}
                      className={localeFontClass(locale.code)}
                    >
                      {SPECIMEN[locale.code]}
                    </span>
                  </TD>
                  {/* The percentage plus the shape of it. The reader's question
                      on this surface is "which language is behind?", and five
                      bare numbers answer that only after you read and compare
                      all five. The bar is encoding the gap, not decorating the
                      number, and it takes the row's state colour so it says the
                      same thing the badge did. */}
                  <TD numeric className="w-40">
                    <span className="flex items-center justify-end gap-2.5">
                      <ProgressBar
                        value={locale.translated}
                        max={locale.total}
                        tone={tone.tone}
                        label={`${localeDisplayName(locale.code)} coverage`}
                        className="h-1 w-16 shrink-0"
                      />
                      <span className="w-9 shrink-0 text-end font-mono tabular-nums text-secondary">
                        {pct}%
                      </span>
                    </span>
                  </TD>
                  <TD
                    numeric
                    className="hidden font-mono tabular-nums text-tertiary sm:table-cell"
                  >
                    {locale.translated}/{locale.total}
                  </TD>
                  <TD>
                    <StatusDot tone={tone.tone}>{tone.label}</StatusDot>
                  </TD>
                  <TD className="hidden whitespace-nowrap text-tertiary md:table-cell">
                    {locale.lastRun}
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
