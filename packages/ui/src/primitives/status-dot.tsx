import type * as React from 'react';
import { cn } from '../lib/cn';
import type { Tone } from './badge';

/**
 * A run's state, at row scale.
 *
 * The runs table used a full `Badge` per row — a bordered, tinted, padded pill
 * carrying a word. At three rows it looked considered; at thirty it is a column
 * of coloured rectangles competing with the one thing the reader is scanning
 * for, which is the command that produced the run and whether it ended in a
 * pull request. Deployment lists in the tools this product is measured against
 * all resolve state to a dot plus a word, and they are right: the dot carries
 * the state pre-attentively and the word carries it precisely.
 *
 * The dot is never the only signal. The label sits beside it at every width, so
 * this satisfies the rule that colour alone may not carry meaning — the dot is
 * an accelerant for people who can see it, not the message.
 */
const DOT: Record<Tone, string> = {
  neutral: 'bg-tertiary',
  ambiguous: 'bg-ambiguous',
  confident: 'bg-confident',
  degraded: 'bg-degraded',
  failed: 'bg-failed',
};

export function StatusDot({
  tone,
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone: Tone;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 whitespace-nowrap text-body text-primary',
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn('size-1.5 shrink-0 rounded-full', DOT[tone])}
      />
      {children}
    </span>
  );
}
