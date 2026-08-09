import { AlertTriangle, CheckCircle2, HelpCircle, XCircle } from 'lucide-react';
import type * as React from 'react';
import { cn } from '../lib/cn';

export type Tone =
  | 'neutral'
  | 'ambiguous'
  | 'confident'
  | 'degraded'
  | 'failed';

/**
 * WCAG 1.4.1 forbids colour as the only means of conveying information, and a
 * meaningful fraction of developers are colour-blind. Rather than documenting
 * "remember to add an icon", the tone→icon mapping is baked into the API so a
 * state badge cannot be rendered without one.
 */
const TONE_ICON: Record<
  Tone,
  React.ComponentType<{ className?: string }> | null
> = {
  neutral: null,
  ambiguous: HelpCircle,
  confident: CheckCircle2,
  degraded: AlertTriangle,
  failed: XCircle,
};

const TONE_CLASS: Record<Tone, string> = {
  neutral: 'bg-raised text-secondary border-subtle',
  ambiguous: 'bg-ambiguous-bg text-ambiguous-text border-ambiguous/25',
  confident: 'bg-confident-bg text-confident-text border-confident/25',
  degraded: 'bg-degraded-bg text-degraded-text border-degraded/25',
  failed: 'bg-failed-bg text-failed-text border-failed/25',
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  /** Hide the tone icon. Only legitimate when adjacent text already carries an icon. */
  hideIcon?: boolean;
}

export function Badge({
  tone = 'neutral',
  hideIcon = false,
  className,
  children,
  ...props
}: BadgeProps) {
  const Icon = TONE_ICON[tone];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap.5 rounded-sm border px-1.5 py-0.5',
        'text-caption font-medium leading-4',
        TONE_CLASS[tone],
        className,
      )}
      {...props}
    >
      {Icon && !hideIcon ? (
        <Icon className="size-3 shrink-0" aria-hidden="true" />
      ) : null}
      {children}
    </span>
  );
}

/**
 * Counts cap at 99+ so a runaway value cannot break layout.
 */
export function CountBadge({
  count,
  max = 99,
  ...props
}: { count: number; max?: number } & Omit<BadgeProps, 'children'>) {
  return (
    <Badge data-numeric {...props}>
      {count > max ? `${max}+` : count}
    </Badge>
  );
}
