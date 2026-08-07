'use client';

import { Check, Minus } from 'lucide-react';
import { Checkbox, RadioGroup, Switch } from 'radix-ui';
import * as React from 'react';
import { cn } from '../lib/cn';

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

const labelText = 'cursor-pointer text-[14px] leading-5 text-primary';
const descriptionText = 'mt-0.5 block text-[13px] leading-5 text-tertiary';

/**
 * Checkbox, radio and switch share one visual language: a 16px control with a
 * 2px focus ring and a label that is part of the hit target — a bare control
 * with a detached label is both an accessibility failure and a 16px tap target.
 *
 * The label is associated by `htmlFor`, never by wrapping. Radix renders these
 * controls as a `<button>` alongside a hidden native input, so a wrapping label
 * has two labelable descendants and it is not obvious which one it names. The
 * description is `aria-describedby`, not part of the label: a screen reader
 * should announce "Notify me, checkbox, unchecked" and then the explanation,
 * not read the whole paragraph as the control's name.
 */
export function CheckboxField({
  label,
  description,
  className,
  id,
  ...props
}: React.ComponentPropsWithoutRef<typeof Checkbox.Root> & {
  label: string;
  description?: string;
}) {
  const generated = React.useId();
  const controlId = id ?? generated;
  const descriptionId = description ? `${controlId}-description` : undefined;

  return (
    <div
      className={cn(
        'flex items-start gap-2.5 py-1',
        props.disabled && 'opacity-50',
        className,
      )}
    >
      <Checkbox.Root
        id={controlId}
        aria-describedby={descriptionId}
        {...props}
        className={cn(
          'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[4px]',
          'border border-strong bg-canvas',
          'transition-colors duration-(--duration-micro)',
          'data-[state=checked]:border-primary data-[state=checked]:bg-primary',
          'data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary',
          'disabled:cursor-not-allowed',
          focusRing,
        )}
      >
        <Checkbox.Indicator className="text-inverse">
          {props.checked === 'indeterminate' ? (
            <Minus className="size-3" aria-hidden="true" />
          ) : (
            <Check className="size-3" aria-hidden="true" />
          )}
        </Checkbox.Indicator>
      </Checkbox.Root>
      <div className="min-w-0">
        <label
          htmlFor={controlId}
          className={cn(labelText, props.disabled && 'cursor-not-allowed')}
        >
          {label}
        </label>
        {description ? (
          <span id={descriptionId} className={descriptionText}>
            {description}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function RadioGroupRoot({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof RadioGroup.Root>) {
  return (
    <RadioGroup.Root
      className={cn('flex flex-col gap-1', className)}
      {...props}
    />
  );
}

export function RadioOption({
  label,
  description,
  className,
  id,
  ...props
}: React.ComponentPropsWithoutRef<typeof RadioGroup.Item> & {
  label: string;
  description?: string;
}) {
  const generated = React.useId();
  const controlId = id ?? generated;
  const descriptionId = description ? `${controlId}-description` : undefined;

  return (
    <div
      className={cn(
        'flex items-start gap-2.5 py-1',
        props.disabled && 'opacity-50',
        className,
      )}
    >
      <RadioGroup.Item
        id={controlId}
        aria-describedby={descriptionId}
        {...props}
        className={cn(
          'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full',
          'border border-strong bg-canvas',
          'transition-colors duration-(--duration-micro)',
          'data-[state=checked]:border-primary',
          'disabled:cursor-not-allowed',
          focusRing,
        )}
      >
        <RadioGroup.Indicator className="block size-2 rounded-full bg-primary" />
      </RadioGroup.Item>
      <div className="min-w-0">
        <label
          htmlFor={controlId}
          className={cn(labelText, props.disabled && 'cursor-not-allowed')}
        >
          {label}
        </label>
        {description ? (
          <span id={descriptionId} className={descriptionText}>
            {description}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function SwitchField({
  label,
  description,
  className,
  id,
  ...props
}: React.ComponentPropsWithoutRef<typeof Switch.Root> & {
  label: string;
  description?: string;
}) {
  const generated = React.useId();
  const controlId = id ?? generated;
  const descriptionId = description ? `${controlId}-description` : undefined;

  return (
    <div
      className={cn(
        'flex items-start justify-between gap-4 py-1',
        props.disabled && 'opacity-50',
        className,
      )}
    >
      <div className="min-w-0">
        <label
          htmlFor={controlId}
          className={cn(labelText, props.disabled && 'cursor-not-allowed')}
        >
          {label}
        </label>
        {description ? (
          <span id={descriptionId} className={descriptionText}>
            {description}
          </span>
        ) : null}
      </div>
      <Switch.Root
        id={controlId}
        aria-describedby={descriptionId}
        {...props}
        className={cn(
          'relative h-5 w-9 shrink-0 rounded-full border border-line bg-raised',
          'transition-colors duration-(--duration-standard) ease-(--ease-standard)',
          'data-[state=checked]:border-primary data-[state=checked]:bg-primary',
          'disabled:cursor-not-allowed',
          focusRing,
        )}
      >
        <Switch.Thumb
          className={cn(
            'block size-3.5 rounded-full bg-canvas shadow-e1',
            'translate-x-0.5 transition-transform duration-(--duration-standard) ease-(--ease-standard)',
            'data-[state=checked]:translate-x-4',
            'motion-reduce:transition-none',
          )}
        />
      </Switch.Root>
    </div>
  );
}
