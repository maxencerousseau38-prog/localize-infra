import { Avatar, Progress, Separator, Tabs } from 'radix-ui';
import type * as React from 'react';
import { cn } from '../lib/cn';

/**
 * Skeletons mirror the final geometry exactly — same heights, same widths — so
 * nothing shifts when content arrives. A skeleton that does not match what
 * loads is worse than a spinner, because it promises a layout it will not keep.
 *
 * The shimmer is a single linear sweep, and it stops entirely under
 * prefers-reduced-motion via the global rule in tokens.css.
 */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'rounded-md bg-raised',
        'bg-[linear-gradient(90deg,var(--bg-raised)_0%,var(--bg-active)_50%,var(--bg-raised)_100%)]',
        'bg-[length:200%_100%] animate-shimmer',
        className,
      )}
      {...props}
    />
  );
}

/** Skeleton rows sized to the real table geometry (44px comfortable). */
export function SkeletonTableRows({
  rows = 5,
  columns = 3,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <>
      {Array.from({ length: rows }, (_, r) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: placeholder cells have no identity beyond their position, and the grid never reorders.
        <tr key={`skeleton-row-${r}`} className="border-b border-subtle">
          {Array.from({ length: columns }, (_, c) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: as above — position is the only identity a placeholder has.
            <td key={`skeleton-cell-${r}-${c}`} className="h-11 px-3">
              <Skeleton className={cn('h-3.5', c === 0 ? 'w-40' : 'w-24')} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/**
 * Determinate only where a real fraction exists (e.g. locales completed of
 * total). Indeterminate progress belongs at the top of the content area as a
 * 2px bar, never as a full-screen spinner.
 */
export function ProgressBar({
  value,
  max = 100,
  label,
  className,
}: {
  value: number;
  max?: number;
  label: string;
  className?: string;
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <Progress.Root
      value={value}
      max={max}
      aria-label={label}
      className={cn(
        'h-1.5 w-full overflow-hidden rounded-full bg-raised',
        className,
      )}
    >
      <Progress.Indicator
        className="h-full rounded-full bg-primary transition-transform duration-(--duration-standard) ease-(--ease-standard) motion-reduce:transition-none"
        style={{ transform: `translateX(-${100 - pct}%)` }}
      />
    </Progress.Root>
  );
}

export function SeparatorLine({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof Separator.Root>) {
  return (
    <Separator.Root
      className={cn(
        'bg-subtle',
        'data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full',
        'data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px',
        className,
      )}
      {...props}
    />
  );
}

export function AvatarRoot({
  name,
  src,
  className,
}: {
  name: string;
  src?: string;
  className?: string;
}) {
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    // The avatar is decorative, and hidden as a whole rather than only its
    // image: the initials fallback is a compressed rendering of a name that is
    // always displayed beside it, so announcing "IM" adds noise, not meaning.
    // Callers must render the person's name — that is what carries it.
    <Avatar.Root
      aria-hidden="true"
      title={name}
      className={cn(
        'inline-flex size-7 shrink-0 select-none items-center justify-center',
        'overflow-hidden rounded-full border border-subtle bg-raised',
        className,
      )}
    >
      {src ? (
        <Avatar.Image src={src} alt="" className="size-full object-cover" />
      ) : null}
      <Avatar.Fallback className="text-micro font-medium text-secondary">
        {initials}
      </Avatar.Fallback>
    </Avatar.Root>
  );
}

export const TabsRoot = Tabs.Root;

export function TabsList({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof Tabs.List>) {
  return (
    <Tabs.List
      className={cn(
        'flex items-center gap-1 border-b border-subtle',
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof Tabs.Trigger>) {
  return (
    <Tabs.Trigger
      className={cn(
        '-mb-px border-b-2 border-transparent px-3 py-2',
        'text-body text-tertiary transition-colors duration-(--duration-micro)',
        'hover:text-secondary',
        'data-[state=active]:border-primary data-[state=active]:text-primary',
        'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof Tabs.Content>) {
  return <Tabs.Content className={cn('pt-4', className)} {...props} />;
}
