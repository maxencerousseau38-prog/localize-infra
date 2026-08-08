import { AlertCircle } from 'lucide-react';
import { type ReactNode, createContext, useContext, useId } from 'react';
import { cn } from '../lib/cn';

/**
 * The form field contract, enforced rather than documented.
 *
 * docs/design/05-design-system.md §4.4 requires: labels above inputs always,
 * required marked on the label, help text between label and control, and errors
 * below the control with an icon — never colour alone.
 *
 * Those rules are easy to state and easy to forget, so `Field` owns the layout
 * and the ARIA wiring. A control rendered inside it is automatically given an
 * id, `aria-describedby` pointing at whichever of help/error exist, and
 * `aria-invalid` — none of which a caller can forget to pass.
 */
interface FieldContextValue {
  controlId: string;
  describedBy: string | undefined;
  invalid: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

/**
 * Props a control should spread onto itself to inherit the field's wiring.
 * Returns null outside a Field so primitives stay usable standalone.
 */
export function useFieldControl() {
  const ctx = useContext(FieldContext);
  if (!ctx) return null;
  return {
    id: ctx.controlId,
    'aria-describedby': ctx.describedBy,
    'aria-invalid': ctx.invalid || undefined,
  } as const;
}

export interface FieldProps {
  label: string;
  /** Marked on the label, never signalled by absence. */
  required?: boolean;
  /** Sits between label and control, where it is read before the input. */
  help?: ReactNode;
  /** Presence switches the field to its invalid state. */
  error?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Field({
  label,
  required = false,
  help,
  error,
  children,
  className,
}: FieldProps) {
  const base = useId();
  const controlId = `${base}-control`;
  const helpId = help ? `${base}-help` : undefined;
  const errorId = error ? `${base}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <FieldContext.Provider
      value={{ controlId, describedBy, invalid: Boolean(error) }}
    >
      {/* 8px label→control, not the 16px in the wireframes layout contract.
          Deliberate and documented in design system §4.4: against the 24px
          gap between fields, 16px leaves the label floating between two
          controls instead of belonging to one. */}
      <div className={cn('flex flex-col gap-2', className)}>
        <label
          htmlFor={controlId}
          className="text-small font-medium leading-5 text-primary"
        >
          {label}
          {required ? (
            <span className="ms-1 text-tertiary" aria-hidden="true">
              *
            </span>
          ) : null}
          {required ? <span className="sr-only"> (required)</span> : null}
        </label>

        {help ? (
          <p id={helpId} className="-mt-1 text-small leading-5 text-tertiary">
            {help}
          </p>
        ) : null}

        {children}

        {error ? (
          // Icon + text, never colour alone (WCAG 1.4.1).
          <p
            id={errorId}
            className="flex items-start gap-1.5 text-small leading-5 text-failed-text"
          >
            <AlertCircle
              className="mt-0.5 size-3.5 shrink-0"
              aria-hidden="true"
            />
            <span>{error}</span>
          </p>
        ) : null}
      </div>
    </FieldContext.Provider>
  );
}

/** Standard width for a form column (design system §4.4). */
export function FormColumn({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex max-w-[35rem] flex-col gap-6', className)}
      {...props}
    />
  );
}
