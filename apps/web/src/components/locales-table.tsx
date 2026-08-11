'use client';

import { DataSearch, DataToolbar } from '@/components/data-toolbar';
import type { ConfidenceState, SampleLocale } from '@/lib/sample';
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

      <Table className="mt-1">
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
                  <TD numeric>
                    <span className="tabular-nums">{pct}%</span>
                  </TD>
                  <TD numeric className="hidden sm:table-cell">
                    {locale.translated}/{locale.total}
                  </TD>
                  <TD>
                    <Badge tone={tone.tone}>{tone.label}</Badge>
                  </TD>
                  <TD className="hidden whitespace-nowrap md:table-cell">
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
