import type * as React from 'react';
import { cn } from '../lib/cn';
import { useFieldControl } from './field';

const controlBase = [
  'w-full rounded-md border border-line bg-canvas',
  'text-[14px] leading-5 text-primary',
  'placeholder:text-tertiary',
  'transition-colors duration-(--duration-micro) ease-(--ease-standard)',
  'hover:border-strong',
  'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus',
  'disabled:cursor-not-allowed disabled:bg-surface disabled:text-tertiary',
  // Driven by Field via aria-invalid so callers cannot forget the styling.
  'aria-[invalid=true]:border-failed aria-[invalid=true]:outline-failed',
];

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: InputProps) {
  const field = useFieldControl();
  return (
    <input
      {...field}
      className={cn(controlBase, 'h-9 px-3', className)}
      {...props}
    />
  );
}

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({ className, rows = 4, ...props }: TextareaProps) {
  const field = useFieldControl();
  return (
    <textarea
      {...field}
      rows={rows}
      className={cn(controlBase, 'resize-y px-3 py-2', className)}
      {...props}
    />
  );
}
