import type * as React from 'react';
import { cn } from '../lib/cn';
import type { Tone } from './badge';

/**
 * A bordered message that reports the state of something.
 *
 * Extracted from fifteen hand-written copies across twelve files, all of which
 * had independently arrived at the same five utilities — `rounded-md border
 * border-X bg-X-bg px-3 py-2 text-small text-X-text`. They agreed, which is
 * what made the duplication survive: nothing looked wrong, so nothing prompted
 * a component. The cost only appears when one of them needs to change.
 *
 * ## It does not announce itself
 *
 * No `role="alert"`, and that is deliberate rather than an omission. Twelve of
 * the fifteen live inside a caller-owned `<output aria-live="polite">` — nine
 * such regions exist in `apps/web` — and a nested `role="alert"` would announce
 * the same sentence twice, the second time assertively. The caller owns the
 * live region because the caller knows whether the message is new. Pass `role`
 * when this one is standing alone, as the remaining three are.
 *
 * ## No icon by default
 *
 * §8 requires an icon on a Badge, and says nothing about this. The fifteen
 * originals carry none, so neither does this: the extraction is a refactor, and
 * a refactor that changes what twelve screens look like is not one. An icon
 * belongs to the surface that needs it, passed as a child.
 *
 * ## Tone is required
 *
 * There is no default. §6.3: colour reports the state of something that
 * exists, so the caller has to say which state — and `failed` as a default
 * would make the commonest case the silent one.
 *
 * ## Two sizes, because there were two shapes
 *
 * `inline` is the original and the default: a one-line message beside the
 * control that produced it, tinted text and all. `section` is the band that had
 * independently appeared three times on `/runs/[id]`, character for character —
 * a page-level notice with a bold first line and a paragraph under it.
 *
 * They are one component rather than two because they differ in four utilities
 * and share the thing that matters, which is the tone vocabulary. Reaching for
 * `<Alert className="rounded-lg px-4 py-3">` instead would have worked —
 * `cn()` does let those win — but it overrides three of the four base
 * utilities and leaves `text-small text-<tone>-text` on the container doing
 * nothing, which is a component used against its own defaults.
 *
 * ## `section` does not tint its text, and that is the point
 *
 * `inline` paints the whole message in the state's text colour. `section` does
 * not: its heading is `text-primary` and its body `text-secondary`, on a tinted
 * ground. At two lines and page width, a fully crimson paragraph reads as
 * shouting, and the border and background already carry the state. This matches
 * what the three originals did rather than improving on them.
 */
export type AlertSize = 'inline' | 'section';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  tone: Tone;
  size?: AlertSize;
  /**
   * The bold first line of a `section`.
   *
   * Passing it is what turns `children` into the paragraph beneath, so the two
   * arrive together or not at all — there is no heading without a body and no
   * way to get the section's two-line shape by accident.
   *
   * Named `heading` rather than `title` because `title` is already an HTML
   * attribute on every element, where it means a tooltip. Shadowing it with a
   * `ReactNode` would need an `Omit` on the props and would take a real
   * capability away from the caller.
   */
  heading?: React.ReactNode;
}

const SIZE: Record<AlertSize, string> = {
  inline: 'rounded-md px-3 py-2 text-small',
  // §5.1: `lg` is the panel radius, which is what this is — a band across the
  // content column, not a message beside a field.
  section: 'rounded-lg px-4 py-3',
};

const TONE: Record<Tone, string> = {
  // Neutral carries no state: an informational note, not a colour that claims
  // something about the thing it describes.
  neutral: 'border-line bg-surface',
  ambiguous: 'border-ambiguous bg-ambiguous-bg',
  confident: 'border-confident bg-confident-bg',
  degraded: 'border-degraded bg-degraded-bg',
  failed: 'border-failed bg-failed-bg',
};

/** Applied at `inline` only — see the note on tinting above. */
const INLINE_TEXT: Record<Tone, string> = {
  neutral: 'text-secondary',
  ambiguous: 'text-ambiguous-text',
  confident: 'text-confident-text',
  degraded: 'text-degraded-text',
  failed: 'text-failed-text',
};

export function Alert({
  tone,
  size = 'inline',
  heading,
  className,
  children,
  ...props
}: AlertProps) {
  return (
    <div
      className={cn(
        'border',
        SIZE[size],
        TONE[tone],
        size === 'inline' && INLINE_TEXT[tone],
        className,
      )}
      {...props}
    >
      {heading === undefined ? (
        children
      ) : (
        <>
          <p className="text-body font-medium text-primary">{heading}</p>
          <p className="mt-1 max-w-[68ch] text-small leading-6 text-secondary">
            {children}
          </p>
        </>
      )}
    </div>
  );
}
