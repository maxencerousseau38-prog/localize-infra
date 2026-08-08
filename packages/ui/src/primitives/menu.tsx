'use client';

import { Check } from 'lucide-react';
import { DropdownMenu, Popover, Tooltip } from 'radix-ui';
import type * as React from 'react';
import { cn } from '../lib/cn';

/* ── Dropdown menu ─────────────────────────────────────────────
   Radix supplies roving tabindex and type-ahead, both of which are
   tedious and easy to get wrong by hand.
   ───────────────────────────────────────────────────────────── */
export const MenuRoot = DropdownMenu.Root;
export const MenuTrigger = DropdownMenu.Trigger;
export const MenuGroup = DropdownMenu.Group;

const surface = [
  'z-50 min-w-[10rem] overflow-hidden rounded-lg',
  'border border-line bg-canvas p-1 shadow-e2',
  'data-[state=open]:animate-pop-in',
  'data-[state=closed]:animate-pop-out',
];

export function MenuContent({
  className,
  sideOffset = 6,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenu.Content>) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        sideOffset={sideOffset}
        className={cn(surface, className)}
        {...props}
      />
    </DropdownMenu.Portal>
  );
}

const itemBase = [
  'relative flex cursor-pointer select-none items-center gap-2 rounded-[4px]',
  'px-2 py-1.5 text-body leading-5 text-primary outline-none',
  'data-[highlighted]:bg-surface',
  'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
  '[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-tertiary',
];

export function MenuItem({
  className,
  destructive = false,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenu.Item> & {
  destructive?: boolean;
}) {
  return (
    <DropdownMenu.Item
      className={cn(
        itemBase,
        destructive &&
          'text-failed-text data-[highlighted]:bg-failed-bg [&_svg]:text-failed',
        className,
      )}
      {...props}
    />
  );
}

export function MenuCheckboxItem({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenu.CheckboxItem>) {
  return (
    <DropdownMenu.CheckboxItem
      className={cn(itemBase, 'pe-8', className)}
      {...props}
    >
      {children}
      <DropdownMenu.ItemIndicator className="absolute end-2">
        <Check className="size-3.5" aria-hidden="true" />
      </DropdownMenu.ItemIndicator>
    </DropdownMenu.CheckboxItem>
  );
}

export function MenuLabel({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenu.Label>) {
  return (
    <DropdownMenu.Label
      className={cn(
        'px-2 py-1.5 text-caption font-medium uppercase tracking-wide text-tertiary',
        className,
      )}
      {...props}
    />
  );
}

export function MenuSeparator({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenu.Separator>) {
  return (
    <DropdownMenu.Separator
      className={cn('-mx-1 my-1 h-px bg-subtle', className)}
      {...props}
    />
  );
}

export function MenuShortcut({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  // Shortcuts are shown inline in menus rather than hidden, so they are
  // discoverable without reading documentation (UX doc §10).
  return (
    <span
      className={cn('ms-auto font-mono text-caption text-tertiary', className)}
      {...props}
    />
  );
}

/* ── Popover ──────────────────────────────────────────────────── */
export const PopoverRoot = Popover.Root;
export const PopoverTrigger = Popover.Trigger;

export function PopoverContent({
  className,
  sideOffset = 6,
  ...props
}: React.ComponentPropsWithoutRef<typeof Popover.Content>) {
  return (
    <Popover.Portal>
      <Popover.Content
        sideOffset={sideOffset}
        className={cn(surface, 'p-4', className)}
        {...props}
      />
    </Popover.Portal>
  );
}

/* ── Tooltip ──────────────────────────────────────────────────── */
export const TooltipProvider = Tooltip.Provider;
export const TooltipRoot = Tooltip.Root;
export const TooltipTrigger = Tooltip.Trigger;

export function TooltipContent({
  className,
  sideOffset = 6,
  ...props
}: React.ComponentPropsWithoutRef<typeof Tooltip.Content>) {
  return (
    <Tooltip.Portal>
      <Tooltip.Content
        sideOffset={sideOffset}
        className={cn(
          'z-50 max-w-[16rem] rounded-md border border-line bg-canvas',
          'px-2 py-1 text-small leading-5 text-primary shadow-e2',
          'data-[state=delayed-open]:animate-pop-in',
          className,
        )}
        {...props}
      />
    </Tooltip.Portal>
  );
}
