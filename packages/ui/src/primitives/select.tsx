'use client';

import { Check, ChevronDown } from 'lucide-react';
import { Select } from 'radix-ui';
import type * as React from 'react';
import { cn } from '../lib/cn';
import { useFieldControl } from './field';

export const SelectRoot = Select.Root;
export const SelectValue = Select.Value;
export const SelectGroup = Select.Group;

export function SelectTrigger({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof Select.Trigger>) {
  const field = useFieldControl();
  return (
    <Select.Trigger
      {...field}
      className={cn(
        'flex h-9 w-full items-center justify-between gap-2 rounded-md',
        'border border-line bg-canvas px-3',
        'text-body leading-5 text-primary',
        'transition-colors duration-(--duration-micro)',
        'hover:border-strong',
        'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus',
        'disabled:cursor-not-allowed disabled:bg-surface disabled:text-tertiary',
        'aria-[invalid=true]:border-failed',
        'data-[placeholder]:text-tertiary',
        className,
      )}
      {...props}
    >
      {children}
      <Select.Icon>
        <ChevronDown className="size-4 text-tertiary" aria-hidden="true" />
      </Select.Icon>
    </Select.Trigger>
  );
}

export function SelectContent({
  className,
  children,
  position = 'popper',
  ...props
}: React.ComponentPropsWithoutRef<typeof Select.Content>) {
  return (
    <Select.Portal>
      <Select.Content
        position={position}
        sideOffset={4}
        className={cn(
          'z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden',
          'rounded-lg border border-line bg-canvas shadow-e2',
          // Motion is transform + opacity only, and under 200ms.
          'data-[state=open]:animate-pop-in',
          'data-[state=closed]:animate-pop-out',
          className,
        )}
        {...props}
      >
        <Select.Viewport className="max-h-72 p-1">{children}</Select.Viewport>
      </Select.Content>
    </Select.Portal>
  );
}

export function SelectItem({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof Select.Item>) {
  return (
    <Select.Item
      className={cn(
        'relative flex cursor-pointer select-none items-center gap-2 rounded-[4px]',
        'py-1.5 pe-8 ps-2 text-body leading-5 text-primary outline-none',
        'data-[highlighted]:bg-surface',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      )}
      {...props}
    >
      <Select.ItemText>{children}</Select.ItemText>
      <Select.ItemIndicator className="absolute end-2 flex items-center">
        <Check className="size-3.5" aria-hidden="true" />
      </Select.ItemIndicator>
    </Select.Item>
  );
}

export function SelectLabel({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof Select.Label>) {
  return (
    <Select.Label
      className={cn(
        'px-2 py-1.5 text-caption font-medium uppercase tracking-wide text-tertiary',
        className,
      )}
      {...props}
    />
  );
}
