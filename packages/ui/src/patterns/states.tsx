import type { LucideIcon } from 'lucide-react';
import type * as React from 'react';
import { cn } from '../lib/cn';
import { Button } from '../primitives/button';

/**
 * Empty states name the thing that is missing and give exactly one way to
 * create it (UX doc §9). "No data" is not an empty state — it is an apology.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 px-6 py-12 text-center',
        className,
      )}
    >
      {Icon ? (
        <Icon
          className="size-6 text-tertiary"
          aria-hidden="true"
          strokeWidth={1.5}
        />
      ) : null}
      <div className="flex flex-col gap-1">
        <p className="text-subtitle font-medium text-primary">{title}</p>
        {description ? (
          <p className="max-w-[36ch] text-body leading-6 text-secondary">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

/**
 * Error states carry three things, in this order: what failed, why, and what
 * the reader can do about it. `detail` is rendered verbatim in monospace
 * because it is usually a machine string the reader needs to copy into an
 * issue — paraphrasing it would destroy its only use.
 */
export function ErrorState({
  title,
  description,
  detail,
  onRetry,
  retryLabel = 'Try again',
  className,
}: {
  title: string;
  description?: string;
  detail?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-start gap-3 rounded-lg border border-failed-border',
        'bg-failed-bg px-4 py-4',
        className,
      )}
    >
      <div className="flex flex-col gap-1">
        <p className="text-subtitle font-medium text-failed-text">{title}</p>
        {description ? (
          <p className="text-body leading-6 text-secondary">{description}</p>
        ) : null}
      </div>
      {detail ? (
        <pre className="w-full overflow-x-auto rounded-md bg-canvas px-3 py-2 font-mono text-caption leading-5 text-secondary">
          {detail}
        </pre>
      ) : null}
      {onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Shown wherever the product would otherwise have to invent data. The web app
 * has no backend yet (see CLAUDE.md), and a screen that fakes a dashboard is
 * worse than one that admits the gap: it makes every other claim in the
 * product unverifiable.
 */
export function NotBuiltYet({
  surface,
  blockedBy,
  className,
}: {
  surface: string;
  blockedBy: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border border-dashed border-line px-4 py-6',
        className,
      )}
    >
      <p className="text-body font-medium text-primary">
        {surface} is not built yet.
      </p>
      <p className="mt-1 text-body leading-6 text-secondary">
        This screen has no data behind it. {blockedBy}
      </p>
    </div>
  );
}
