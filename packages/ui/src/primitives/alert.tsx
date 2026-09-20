import type * as React from 'react';
import { cn } from '../lib/cn';
import type { Tone } from './badge';

/**
 * A bordered message that reports the state of something.
 *
 * Extracted from twelve hand-written copies across eight files, all of which
 * had independently arrived at the same five utilities — `rounded-md border
 * border-X bg-X-bg px-3 py-2 text-small text-X-text`. They agreed, which is
 * what made the duplication survive: nothing looked wrong, so nothing prompted
 * a component. The cost only appears when one of them needs to change.
 *
 * ## It does not announce itself
 *
 * No `role="alert"`, and that is deliberate rather than an omission. Most of
 * these live inside a caller-owned `<output aria-live="polite">` — sixteen such
 * regions exist in the app — and a nested `role="alert"` would announce the
 * same sentence twice, the second time assertively. The caller owns the live
 * region because the caller knows whether the message is new. Pass `role` when
 * this one is standing alone.
 *
 * ## No icon by default
 *
 * §8 requires an icon on a Badge, and says nothing about this. The twelve
 * originals carry none, so neither does this: the extraction is a refactor, and
 * a refactor that changes what twelve screens look like is not one. An icon
 * belongs to the surface that needs it, passed as a child.
 *
 * ## Tone is required
 *
 * There is no default. §6.3: colour reports the state of something that
 * exists, so the caller has to say which state — and `failed` as a default
 * would make the commonest case the silent one.
 */
export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  tone: Tone;
}

const TONE: Record<Tone, string> = {
  // Neutral carries no state: an informational note, not a colour that claims
  // something about the thing it describes.
  neutral: 'border-line bg-surface text-secondary',
  ambiguous: 'border-ambiguous bg-ambiguous-bg text-ambiguous-text',
  confident: 'border-confident bg-confident-bg text-confident-text',
  degraded: 'border-degraded bg-degraded-bg text-degraded-text',
  failed: 'border-failed bg-failed-bg text-failed-text',
};

export function Alert({ tone, className, ...props }: AlertProps) {
  return (
    <div
      className={cn(
        'rounded-md border px-3 py-2 text-small',
        TONE[tone],
        className,
      )}
      {...props}
    />
  );
}
