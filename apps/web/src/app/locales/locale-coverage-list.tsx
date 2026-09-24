import type { LocaleCoverage } from '@/lib/data/workspace';
import { isBehind } from '@/lib/locales/summary';
import {
  ProgressBar,
  StateRule,
  StatusDot,
  type Tone,
  localeDisplayName,
} from '@localize-infra/ui';
import Link from 'next/link';

/**
 * One row per language, carrying the rule this page was missing.
 *
 * Records below `md` rather than a narrowed table: that fix landed when this
 * page rendered sample data, and the reason survives the data becoming real —
 * four columns do not fit 390 and the state label was cut mid-word.
 *
 * The specimen column is gone. It rendered a fixed phrase per language to prove
 * the product renders each script properly; with real data there is no such
 * phrase, and picking an arbitrary translated key to stand in would be
 * decoration chosen by the interface rather than a fact about the project.
 *
 * ## What changed
 *
 * **The State Rule.** §1.4 calls it the signature and this page is *about*
 * confidence per language, which is the one thing a rule coloured by confidence
 * says. It had a StatusDot and nothing else.
 *
 * **Columns instead of `justify-between`.** The state sat at whatever x the
 * language name left it, so scanning the states meant reading every row. The
 * same defect the run detail's locale list had, fixed the same way.
 *
 * **"From the run of …" is gone from every row.** Coverage comes from exactly
 * one run — `listLocaleCoverageForViewer` takes `limit(1)` — so that line
 * repeated a single fact once per language. The page states it once, above the
 * list.
 *
 * **A language with questions links to them.** It reported "2 questions
 * waiting" as text and offered no way to reach them. `/review` now filters by
 * language through the URL, so the count is the way there. A language that is
 * merely behind gets no link: the fix is to run again, and running happens on
 * the project page, which this row does not know.
 */
function toneFor(item: LocaleCoverage): { tone: Tone; label: string } {
  if (item.needsDecision > 0) {
    return { tone: 'ambiguous', label: 'Needs a decision' };
  }
  if (item.total > 0 && !isBehind(item)) {
    return { tone: 'confident', label: 'Current' };
  }
  return { tone: 'degraded', label: 'Behind' };
}

export function LocaleCoverageList({ items }: { items: LocaleCoverage[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((item) => {
        const state = toneFor(item);
        const pct =
          item.total > 0 ? Math.round((item.translated / item.total) * 100) : 0;

        return (
          <li key={item.locale}>
            <StateRule
              tone={state.tone}
              className="rounded-e-md py-3.5 pe-3 transition-colors hover:bg-surface/60"
            >
              {/*
                Capped, so the row stays one thing.
                ──────────────────────────────────
                The name took `flex-1` and pushed the state and the counts to
                the far edge: at 1440 "German" sat at x=300 and "Needs a
                decision" at x=1080, with 700px of nothing between them. The
                columns lined up down the page, which was the point, and the
                association across each row was lost, which was not.

                §4.2 is the reason this is a cap rather than more columns: a
                data surface widens when it has something to reveal, and this
                one has four fields. The rest of the width is margin.
              */}
              <div className="flex max-w-[56rem] flex-wrap items-baseline gap-x-4 gap-y-2">
                <span className="min-w-0 flex-1 truncate sm:max-w-[18rem]">
                  <span className="text-body font-medium text-primary">
                    {localeDisplayName(item.locale)}
                  </span>{' '}
                  <span className="font-mono text-caption text-tertiary">
                    {item.locale}
                  </span>
                </span>
                {/*
                  Fixed columns from `sm`, so the state and the counts line up
                  down the page and a reader scans one column instead of N rows.
                  Below it they wrap, which is §12's relocation rather than a
                  shrunken desktop row.
                */}
                <span className="shrink-0 sm:w-[11rem]">
                  <StatusDot tone={state.tone}>{state.label}</StatusDot>
                </span>
                <span className="shrink-0 font-mono text-caption tabular-nums text-secondary sm:w-[3.5rem] sm:text-end">
                  {pct}%
                </span>
                <span className="shrink-0 font-mono text-caption tabular-nums text-tertiary sm:w-[4.5rem] sm:text-end">
                  {item.translated}/{item.total}
                </span>
              </div>

              <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                {/*
                  Capped, because a full-width bar stops being a measure.
                  ─────────────────────────────────────────────────────
                  It spanned the content column — about 1100px at 1440 — so a
                  language at 100% drew a coloured rule across the page, and at
                  that length it read as a divider rather than a quantity. Both
                  seeded languages are complete, which made it the heaviest
                  thing on the page after the band while conveying nothing the
                  `100%` beside it did not.

                  At 20rem the fill and the gap are both legible, which is the
                  only reason to draw a bar rather than print the number.
                */}
                <ProgressBar
                  value={item.translated}
                  max={Math.max(item.total, 1)}
                  tone={state.tone}
                  label={`${localeDisplayName(item.locale)} coverage`}
                  className="h-1 w-full min-w-0 max-w-[20rem]"
                />
                {item.needsDecision > 0 ? (
                  <Link
                    href={`/review?locale=${encodeURIComponent(item.locale)}`}
                    className="shrink-0 text-caption text-link underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                  >
                    {item.needsDecision} question
                    {item.needsDecision === 1 ? '' : 's'} waiting
                  </Link>
                ) : null}
              </div>
            </StateRule>
          </li>
        );
      })}
    </ul>
  );
}
