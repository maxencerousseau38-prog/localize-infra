import type * as React from 'react';
import { cn } from '../lib/cn';
import type { Tone } from './badge';

/**
 * The State Rule — the design system's signature element.
 *
 * A 3px rule on the *leading* edge of any surface carrying user copy, coloured
 * by confidence state. It compresses the product's core idea — confidence is
 * always visible — into one scannable, reusable element, and it is the visual
 * thread tying the ambiguity queue, review surface, locale tables and run
 * details together.
 *
 * Uses `border-inline-start`, not `border-left`, so it flips correctly in RTL.
 * We ship Arabic; a physical property here would be a visible competence
 * failure in the exact product category we sell into.
 * See docs/design/05-design-system.md §1.6.
 */
const RULE_COLOR: Record<Tone, string> = {
  neutral: '[border-inline-start-color:var(--border-default)]',
  ambiguous: '[border-inline-start-color:var(--state-ambiguous)]',
  confident: '[border-inline-start-color:var(--state-confident)]',
  degraded: '[border-inline-start-color:var(--state-degraded)]',
  failed: '[border-inline-start-color:var(--state-failed)]',
};

export interface StateRuleProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: Tone;
  /**
   * Accessible description of the state. The rule is decorative on its own —
   * meaning must also be carried by text or an icon in the content.
   */
  children?: React.ReactNode;
}

export function StateRule({
  tone = 'neutral',
  className,
  children,
  ...props
}: StateRuleProps) {
  return (
    <div
      className={cn(
        '[border-inline-start-width:3px] [border-inline-start-style:solid]',
        'ps-4',
        RULE_COLOR[tone],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
