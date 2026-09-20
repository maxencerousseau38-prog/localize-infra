'use client';

import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { Toast } from 'radix-ui';
import * as React from 'react';
import { cn } from '../lib/cn';
import type { Tone } from './badge';

/**
 * Transient feedback for a result the reader cannot see where they are.
 *
 * That clause is the whole rule, and it is narrow on purpose.
 * `docs/product/02-ux-and-flows.md` and `04-wireframes.md` both say success is
 * *quiet* and a toast "never confirms the obvious"; DESIGN.md §7.2 goes further
 * and names the ambiguity row collapsing on resolution as the feedback for that
 * action — a toast there would be a second announcement of something already on
 * screen. So the cases left are the ones where the surface that would carry an
 * inline message is gone by the time the result exists: an action that
 * redirects, or one whose effect lands off-screen.
 *
 * It is built on Radix rather than a toast library because the library is
 * already installed — `radix-ui` bundles `@radix-ui/react-toast` — and because
 * Radix owns the parts that are actually hard: the announcement region, the
 * hotkey (F8) that moves focus into the viewport, pause-on-hover and
 * pause-on-focus, and swipe dismissal.
 *
 * ## Four names, one palette
 *
 * The public tone names are `success` / `error` / `warning` / `info`, which is
 * what a caller writing a toast reaches for. They are not a second colour
 * vocabulary: each maps to one `Tone` from `badge.tsx` and takes its icon and
 * its hue from there, so a toast and a badge reporting the same state cannot
 * drift apart. `ambiguous` is absent from the map deliberately — §1.4 reserves
 * Iris for "your judgement is required", and a message that vanishes after four
 * seconds is the wrong place to ask for a judgement.
 *
 * ## The ground is glass, the state is the icon
 *
 * §5.6 lists toasts among the surfaces glass is permitted on, and a toast is
 * the clearest case for it: it sits over content the reader was already looking
 * at. That means the tone cannot be a filled background the way it is on an
 * Alert, so it is carried by the icon — which §8 requires anyway, because
 * colour may never be the only carrier of meaning.
 *
 * The shadow is `e2`, the same step the menu uses. §5.2 keeps shadows for
 * overlays, and this is one; what §5.6 forbids is a *glass-specific* shadow
 * token, not elevation on a floating panel.
 */
export type ToastTone = 'success' | 'error' | 'warning' | 'info';

const TONE: Record<ToastTone, Tone> = {
  success: 'confident',
  error: 'failed',
  warning: 'degraded',
  info: 'neutral',
};

const TONE_ICON: Record<
  ToastTone,
  React.ComponentType<{ className?: string }>
> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const TONE_COLOR: Record<ToastTone, string> = {
  success: 'text-confident',
  error: 'text-failed',
  warning: 'text-degraded',
  info: 'text-tertiary',
};

export interface ToastInput {
  tone: ToastTone;
  /** One line. What happened, in the past tense of the verb on the button. */
  title: string;
  /** Optional second line: what it cost, or what to do next. */
  description?: string;
  /** At most one, per §4.8 of the design system doc. */
  action?: { label: string; onClick: () => void };
}

interface QueuedToast extends ToastInput {
  id: number;
}

/**
 * Three, from `docs/design/05-design-system.md` §4.8.
 *
 * The cap drops the *oldest*, not the newest: the fourth message is the one the
 * reader just caused, so it is the one that must be visible.
 */
const MAX_STACKED = 3;

/**
 * 4s, 6s when there is an action to reach, and never for an error.
 *
 * Same source. The error case is the one worth restating: a message that
 * reports a failure and then removes itself has told the reader that something
 * broke and taken away the sentence saying what.
 */
const DURATION: Record<ToastTone, number> = {
  success: 4000,
  warning: 4000,
  info: 4000,
  error: Number.POSITIVE_INFINITY,
};

const ToastContext = React.createContext<((input: ToastInput) => void) | null>(
  null,
);

/**
 * Mounted once, at the root of the application.
 *
 * Throws rather than no-oping when it is missing, because the failure mode of a
 * silent `useToast` is an action that reports success by saying nothing — which
 * is indistinguishable from the action not having run.
 */
export function useToast(): (input: ToastInput) => void {
  const push = React.useContext(ToastContext);
  if (!push) {
    throw new Error('useToast must be used inside <ToastProvider>');
  }
  return push;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = React.useState<QueuedToast[]>([]);
  const nextId = React.useRef(0);

  const push = React.useCallback((input: ToastInput) => {
    nextId.current += 1;
    const entry = { ...input, id: nextId.current };
    setQueue((current) => [...current, entry].slice(-MAX_STACKED));
  }, []);

  const dismiss = React.useCallback((id: number) => {
    setQueue((current) => current.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={push}>
      <Toast.Provider swipeDirection="right">
        {children}
        {queue.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onDismiss={() => dismiss(toast.id)}
          />
        ))}
        <Toast.Viewport
          className={cn(
            // Bottom-centre on a phone, bottom-trailing from `md` up
            // (§4.8: <768 centres). `end`, not `right`, so it follows the
            // reading direction in Arabic like every other edge in this system.
            'fixed bottom-0 z-50 flex w-full flex-col gap-2 p-4 outline-none',
            'inset-x-0 md:inset-x-auto md:bottom-4 md:end-4 md:w-[22rem] md:p-0',
          )}
        />
      </Toast.Provider>
    </ToastContext.Provider>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: QueuedToast;
  onDismiss: () => void;
}) {
  const Icon = TONE_ICON[toast.tone];
  const base = DURATION[toast.tone];
  /*
   * `Infinity` is passed through, never `undefined`.
   *
   * `Toast.Root` reads `durationProp || context.duration`, so an omitted
   * duration inherits the provider's 5s and an error would dismiss itself after
   * all — the one behaviour §4.8 forbids. Radix special-cases `Infinity`
   * (`if (!duration2 || duration2 === Infinity) return`), so the sentinel has to
   * reach it intact. The action bump only applies where there is a timer to
   * extend.
   */
  const duration = Number.isFinite(base) && toast.action ? 6000 : base;
  return (
    <Toast.Root
      // `foreground` makes Radix announce the message assertively and is what
      // an error needs; everything else is announced politely, which is §4.8's
      // `role="alert"` / `role="status"` split expressed the way this primitive
      // actually implements it.
      type={toast.tone === 'error' ? 'foreground' : 'background'}
      duration={duration}
      onOpenChange={(open) => {
        if (!open) onDismiss();
      }}
      data-tone={TONE[toast.tone]}
      className={cn(
        'flex items-start gap-3 rounded-lg px-4 py-3',
        'border border-glass-border bg-glass backdrop-blur-glass shadow-e2',
        'reduced-transparency:border-line reduced-transparency:bg-raised',
        'reduced-transparency:backdrop-blur-none',
        'data-[state=open]:animate-pop-in',
        'data-[state=closed]:animate-pop-out',
        // Swipe tracks the pointer, then settles. Transform only, and the
        // settle is `standard` — §7.1 caps everything at 200ms.
        'data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]',
        'data-[swipe=cancel]:translate-x-0 data-[swipe=cancel]:transition-transform',
        'data-[swipe=cancel]:duration-standard data-[swipe=cancel]:ease-standard',
        'data-[swipe=end]:animate-pop-out',
      )}
    >
      <Icon
        className={cn('mt-0.5 size-4 shrink-0', TONE_COLOR[toast.tone])}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <Toast.Title className="text-small font-medium text-primary">
          {toast.title}
        </Toast.Title>
        {toast.description ? (
          <Toast.Description className="mt-1 text-caption leading-5 text-secondary">
            {toast.description}
          </Toast.Description>
        ) : null}
        {toast.action ? (
          <Toast.Action
            altText={toast.action.label}
            onClick={toast.action.onClick}
            className={cn(
              'mt-2 rounded-md text-caption font-medium text-link underline underline-offset-2',
              'transition-colors duration-micro hover:text-link-hover',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
            )}
          >
            {toast.action.label}
          </Toast.Action>
        ) : null}
      </div>
      <Toast.Close
        className={cn(
          'rounded-md p-1 text-tertiary',
          'transition-colors duration-micro hover:bg-surface hover:text-primary',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
        )}
      >
        <X className="size-3.5" aria-hidden="true" />
        <span className="sr-only">Dismiss</span>
      </Toast.Close>
    </Toast.Root>
  );
}
