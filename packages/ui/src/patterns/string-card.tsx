import { Check } from 'lucide-react';
import type * as React from 'react';
import { cn } from '../lib/cn';
import { localeFontClass, localeTextProps } from '../lib/locale';
import type { Tone } from '../primitives/badge';
import { StateRule } from '../primitives/state-rule';
import { LocaleChip } from './locale-chip';

/**
 * The String Card — the product's atom (design system §4.2).
 *
 * Source text above, translation below, both carrying their own `lang`/`dir`
 * and script font stack, with the State Rule on the leading edge. It appears on
 * the ambiguity queue, the review surface, locale tables and run detail, so
 * every visual decision here is repeated hundreds of times: it stays quiet.
 */
export interface StringCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Text as authored, in the source locale. */
  source: string;
  sourceLocale: string;
  /** Translation. Absent when the string has not been translated yet. */
  translation?: string;
  targetLocale: string;
  /**
   * Confidence state. Drives the State Rule colour, which is decorative —
   * `stateLabel` carries the same information as text.
   */
  tone?: Tone;
  /** Plain-language state, e.g. "Needs a decision". Read by assistive tech. */
  stateLabel?: string;
  /** Where the string lives, e.g. `src/components/Modal.tsx`. */
  origin?: string;
  /** What surrounds it, e.g. "Settings dialog". */
  context?: string;
  /** Approved by a human reviewer — shown as a check beside the translation. */
  approved?: boolean;
  dense?: boolean;
  /** Trailing controls (approve, edit, open in editor). */
  actions?: React.ReactNode;
}

export function StringCard({
  source,
  sourceLocale,
  translation,
  targetLocale,
  tone = 'neutral',
  stateLabel,
  origin,
  context,
  approved = false,
  dense = false,
  actions,
  className,
  ...props
}: StringCardProps) {
  return (
    <StateRule
      tone={tone}
      className={cn(
        'rounded-e-md bg-canvas',
        dense ? 'py-2' : 'py-3',
        'pe-3',
        className,
      )}
      {...props}
    >
      {stateLabel ? <span className="sr-only">{stateLabel}. </span> : null}

      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p
              {...localeTextProps(sourceLocale)}
              className={cn(
                'min-w-0 text-body leading-6 text-primary',
                localeFontClass(sourceLocale),
              )}
            >
              {source}
            </p>
            <LocaleChip locale={sourceLocale} source className="mt-0.5" />
          </div>

          <div
            className={cn(
              'flex items-start justify-between gap-3 border-t border-subtle',
              dense ? 'mt-1.5 pt-1.5' : 'mt-2 pt-2',
            )}
          >
            {translation ? (
              <p
                {...localeTextProps(targetLocale)}
                className={cn(
                  'min-w-0 text-body leading-6 text-primary',
                  localeFontClass(targetLocale),
                )}
              >
                {translation}
              </p>
            ) : (
              // Never render an empty line where a translation would go: an
              // untranslated string is a state, and it says so.
              <p className="min-w-0 text-body leading-6 text-tertiary italic">
                Not translated
              </p>
            )}
            <span className="mt-0.5 flex shrink-0 items-center gap-1.5">
              <LocaleChip locale={targetLocale} />
              {approved ? (
                <>
                  <Check
                    className="size-3.5 text-confident"
                    aria-hidden="true"
                    strokeWidth={2.5}
                  />
                  <span className="sr-only">Approved</span>
                </>
              ) : null}
            </span>
          </div>

          {origin || context ? (
            <p className="mt-1.5 truncate text-caption leading-5 text-tertiary">
              {origin ? <span className="font-mono">{origin}</span> : null}
              {origin && context ? ' · ' : null}
              {context}
            </p>
          ) : null}
        </div>

        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
    </StateRule>
  );
}
