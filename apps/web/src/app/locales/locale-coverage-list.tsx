import type { LocaleCoverage } from '@/lib/data/workspace';
import {
  ProgressBar,
  StatusDot,
  type Tone,
  localeDisplayName,
} from '@localize-infra/ui';

/**
 * One row per language, in the arrangement /locales already used.
 *
 * Records below `md` rather than a narrowed table: that fix landed when this
 * page rendered sample data, and the reason survives the data becoming real —
 * four columns do not fit 390 and the state label was cut mid-word.
 *
 * The specimen column is gone. It rendered a fixed phrase per language to prove
 * the product renders each script properly; with real data there is no such
 * phrase, and picking an arbitrary translated key to stand in would be
 * decoration chosen by the interface rather than a fact about the project.
 */
function toneFor(item: LocaleCoverage): { tone: Tone; label: string } {
  if (item.needsDecision > 0) {
    return { tone: 'ambiguous', label: 'Needs a decision' };
  }
  if (item.total > 0 && item.translated >= item.total) {
    return { tone: 'confident', label: 'Current' };
  }
  return { tone: 'degraded', label: 'Behind' };
}

export function LocaleCoverageList({ items }: { items: LocaleCoverage[] }) {
  return (
    <ul>
      {items.map((item) => {
        const state = toneFor(item);
        const pct =
          item.total > 0 ? Math.round((item.translated / item.total) * 100) : 0;

        return (
          <li key={item.locale} className="border-t border-subtle py-3.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="min-w-0">
                <span className="font-medium text-primary">
                  {localeDisplayName(item.locale)}
                </span>{' '}
                <span className="font-mono text-caption text-tertiary">
                  {item.locale}
                </span>
              </span>
              <StatusDot tone={state.tone}>{state.label}</StatusDot>
            </div>

            <div className="mt-3 flex items-center gap-3">
              <ProgressBar
                value={item.translated}
                max={Math.max(item.total, 1)}
                tone={state.tone}
                label={`${localeDisplayName(item.locale)} coverage`}
                className="h-1 min-w-0 flex-1"
              />
              <span className="shrink-0 font-mono text-caption tabular-nums text-secondary">
                {pct}%
              </span>
              <span className="shrink-0 font-mono text-caption tabular-nums text-tertiary">
                {item.translated}/{item.total}
              </span>
            </div>

            <p className="mt-2 text-caption text-tertiary">
              {item.needsDecision > 0
                ? `${item.needsDecision} question${item.needsDecision === 1 ? '' : 's'} waiting · `
                : null}
              From the run of{' '}
              {item.lastRunAt
                ? new Date(item.lastRunAt).toISOString().slice(0, 10)
                : 'an earlier date'}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
