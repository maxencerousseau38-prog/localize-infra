'use client';

import { X } from 'lucide-react';
import { Dialog } from 'radix-ui';
import type * as React from 'react';
import { cn } from '../lib/cn';

/**
 * Radix handles focus trapping, Esc dismissal, focus restoration to the trigger
 * and scroll locking. Those are the parts hand-rolled dialogs get wrong, which
 * is why the primitive is non-negotiable here rather than a preference.
 */
export const DialogRoot = Dialog.Root;
export const DialogTrigger = Dialog.Trigger;
export const DialogClose = Dialog.Close;

const SIZES = {
  sm: 'max-w-[30rem]',
  md: 'max-w-[35rem]',
  lg: 'max-w-[45rem]',
} as const;

export function DialogContent({
  className,
  children,
  size = 'md',
  ...props
}: React.ComponentPropsWithoutRef<typeof Dialog.Content> & {
  size?: keyof typeof SIZES;
}) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay
        className={cn(
          'fixed inset-0 z-50 bg-overlay',
          'data-[state=open]:animate-fade-in',
          'data-[state=closed]:animate-fade-out',
        )}
      />
      <Dialog.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2',
          SIZES[size],
          'rounded-lg border border-line bg-canvas shadow-e3',
          'data-[state=open]:animate-dialog-in',
          'data-[state=closed]:animate-dialog-out',
          className,
        )}
        {...props}
      >
        {children}
        <Dialog.Close
          className={cn(
            'absolute end-4 top-4 rounded-md p-1 text-tertiary',
            'transition-colors hover:bg-surface hover:text-primary',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
          )}
        >
          <X className="size-4" aria-hidden="true" />
          <span className="sr-only">Close</span>
        </Dialog.Close>
      </Dialog.Content>
    </Dialog.Portal>
  );
}

export function DialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col gap-1.5 p-5 pe-12', className)}
      {...props}
    />
  );
}

export function DialogTitle({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof Dialog.Title>) {
  return (
    <Dialog.Title
      className={cn('text-title font-semibold text-primary', className)}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof Dialog.Description>) {
  return (
    <Dialog.Description
      className={cn('text-body leading-6 text-secondary', className)}
      {...props}
    />
  );
}

export function DialogBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 pb-1', className)} {...props} />;
}

export function DialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex flex-col-reverse gap-2 p-5 sm:flex-row sm:justify-end',
        className,
      )}
      {...props}
    />
  );
}

/**
 * Edge panel. Distinct from Dialog: a drawer does not interrupt, it reveals.
 *
 * `side` is logical, not physical. The trailing edge (default) carries
 * detail-without-navigation — a run, a member. The leading edge carries
 * navigation, which is where a reader already expects to find it, and is what
 * the sidebar becomes below the 1024px breakpoint.
 */
export function SheetContent({
  className,
  children,
  size = 'md',
  side = 'end',
  ...props
}: React.ComponentPropsWithoutRef<typeof Dialog.Content> & {
  size?: 'sm' | 'md';
  side?: 'start' | 'end';
}) {
  const leading = side === 'start';
  return (
    <Dialog.Portal>
      <Dialog.Overlay
        className={cn(
          'fixed inset-0 z-50 bg-overlay',
          'data-[state=open]:animate-fade-in',
          'data-[state=closed]:animate-fade-out',
        )}
      />
      <Dialog.Content
        className={cn(
          'fixed inset-y-0 z-50 flex w-full flex-col',
          leading ? 'start-0 border-e' : 'end-0 border-s',
          'border-line bg-canvas shadow-e3',
          size === 'sm' ? 'sm:max-w-[25rem]' : 'sm:max-w-[35rem]',
          leading
            ? 'data-[state=open]:animate-sheet-in-start data-[state=closed]:animate-sheet-out-start'
            : 'data-[state=open]:animate-sheet-in data-[state=closed]:animate-sheet-out',
          className,
        )}
        {...props}
      >
        {children}
        <Dialog.Close
          className={cn(
            'absolute end-4 top-4 rounded-md p-1 text-tertiary',
            'transition-colors hover:bg-surface hover:text-primary',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
          )}
        >
          <X className="size-4" aria-hidden="true" />
          <span className="sr-only">Close</span>
        </Dialog.Close>
      </Dialog.Content>
    </Dialog.Portal>
  );
}
