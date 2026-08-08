import type * as React from 'react';
import { cn } from '../lib/cn';

/**
 * Elevation is expressed with borders first and shadow second. In dark mode
 * shadows are near-useless, so `raised` shifts surface lightness instead.
 */
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  raised?: boolean;
}

export function Card({ raised = false, className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-line bg-canvas',
        raised && 'bg-surface shadow-e1',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex flex-col gap-1.5 p-5', className)} {...props} />
  );
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        'text-title font-semibold leading-7 text-primary',
        className,
      )}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-body text-secondary', className)} {...props} />;
}

export function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5 pt-0', className)} {...props} />;
}

export function CardFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex items-center gap-3 p-5 pt-0', className)}
      {...props}
    />
  );
}
