import type { AmbiguityRecord } from '@/lib/data/workspace';
import {
  StateRule,
  cn,
  localeDisplayName,
  localeFontClass,
  localeTextProps,
} from '@localize-infra/ui';

/**
 * The queue, read-only.
 *
 * Answering a question needs the run it came from and the proposal it belongs
 * to, both of which live on the project page — so this lists and links rather
 * than duplicating the resolution form. Two places that can resolve the same
 * ambiguity is two places to keep in step, and the second one always lags.
 *
 * Iris earns its keep here: every row is, by definition, a case where the
 * product is asking for the reader's judgement (DESIGN.md §1.4).
 */
export function AmbiguityInbox({ items }: { items: AmbiguityRecord[] }) {
  return (
    <ul className="mt-8 flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.id}>
          <StateRule
            tone="ambiguous"
            className="rounded-e-lg border border-s-0 border-subtle py-4 pe-4"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="font-mono text-caption text-tertiary">
                {item.translation_key}
              </p>
              <span className="font-mono text-micro uppercase tracking-wide text-tertiary">
                {localeDisplayName(item.locale)}
              </span>
            </div>

            <p className="mt-1.5 text-subtitle font-medium text-primary">
              {item.source_text}
            </p>
            <p className="mt-1.5 max-w-[68ch] text-small leading-6 text-secondary">
              {item.question}
            </p>

            <p className="mt-3 text-caption text-tertiary">
              Proposed:{' '}
              <span
                {...localeTextProps(item.locale)}
                className={cn('text-secondary', localeFontClass(item.locale))}
              >
                {item.proposed_text}
              </span>
              {item.alternatives.length > 0
                ? ` · ${item.alternatives.length} alternative${item.alternatives.length === 1 ? '' : 's'}`
                : null}
            </p>
          </StateRule>
        </li>
      ))}
    </ul>
  );
}
