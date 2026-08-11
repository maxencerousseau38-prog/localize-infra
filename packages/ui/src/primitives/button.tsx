import { type VariantProps, cva } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import type * as React from 'react';
import { cn } from '../lib/cn';

/**
 * Primary buttons are Graphite, not Iris.
 *
 * If the primary action were Iris, every screen would shout the same colour as
 * the ambiguity signal and the signal would die. Interactive prominence comes
 * from weight and contrast; colour is reserved for state.
 * See docs/design/05-design-system.md §1.3.
 */
const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap',
    'font-medium rounded-md',
    'transition-colors duration-(--duration-micro) ease-(--ease-standard)',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
    'disabled:pointer-events-none disabled:opacity-50',
    // Icons inside buttons should never intercept the pointer or shrink.
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-inverse hover:bg-primary/90 active:bg-primary/85',
        secondary:
          'bg-canvas text-primary border border-line hover:bg-surface active:bg-raised',
        ghost: 'text-primary hover:bg-surface active:bg-raised',
        danger: 'bg-failed text-inverse hover:bg-failed/90 active:bg-failed/85',
        link: 'text-link underline-offset-4 hover:underline hover:text-link-hover p-0 h-auto',
      },
      size: {
        sm: 'h-7 px-2.5 text-small [&_svg]:size-3.5',
        md: 'h-8 px-3 text-body [&_svg]:size-4',
        lg: 'h-10 px-4 text-body [&_svg]:size-4',
        icon: 'size-8 [&_svg]:size-4',
      },
    },
    compoundVariants: [
      // `link` is text, not a control surface: strip the box sizing.
      { variant: 'link', size: 'sm', class: 'h-auto px-0' },
      { variant: 'link', size: 'md', class: 'h-auto px-0' },
      { variant: 'link', size: 'lg', class: 'h-auto px-0' },
    ],
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Render as the child element (e.g. an `<a>`) while keeping button styling. */
  asChild?: boolean;
  /**
   * React 19 passes `ref` as an ordinary prop to function components, but it
   * still has to be declared to be typed. Needed by callers that own focus
   * restoration themselves — a dialog opened from state rather than through a
   * Radix trigger has nothing to return focus to unless it keeps this.
   */
  ref?: React.Ref<HTMLButtonElement>;
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  type,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : 'button';
  return (
    <Comp
      // Buttons inside a form default to `submit`, which is a common source of
      // accidental submissions. Require the caller to opt in explicitly.
      type={asChild ? undefined : (type ?? 'button')}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { buttonVariants };
