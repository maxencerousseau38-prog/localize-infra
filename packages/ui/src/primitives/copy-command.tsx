'use client';

import { Check, Copy } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '../lib/cn';

/**
 * The landing page's primary conversion action.
 *
 * The success metric for the marketing site is `npx` runs, not signups, which
 * makes this the single most important interactive element on the public
 * surface. Accordingly it is built to a higher standard than a generic copy
 * button:
 *
 *  - The whole block is one large target (>44px) so it works on touch.
 *  - Result is announced via a live region for screen-reader users.
 *  - The label width is reserved so the "Copied" state causes no layout shift.
 *  - Falls back to a manual selection hint if the Clipboard API is unavailable
 *    (older Safari, insecure contexts) rather than silently failing.
 */
export interface CopyCommandProps {
  command: string;
  className?: string;
  /** Visible prompt character. Purely decorative — excluded from the copied text. */
  prompt?: string;
}

export function CopyCommand({
  command,
  className,
  prompt = '$',
}: CopyCommandProps) {
  const [state, setState] = useState<'idle' | 'copied' | 'error'>('idle');
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (timeout.current) clearTimeout(timeout.current);
    };
  }, []);

  const copy = useCallback(async () => {
    if (timeout.current) clearTimeout(timeout.current);
    try {
      await navigator.clipboard.writeText(command);
      setState('copied');
    } catch {
      setState('error');
    }
    timeout.current = setTimeout(() => setState('idle'), 2000);
  }, [command]);

  return (
    <div className={cn('w-full', className)}>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy command: ${command}`}
        className={cn(
          'group flex w-full items-center gap-3 rounded-lg border border-line',
          'bg-surface px-4 py-3.5 text-start',
          'transition-colors duration-(--duration-micro) ease-(--ease-standard)',
          'hover:border-strong hover:bg-raised',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
        )}
      >
        <span
          aria-hidden="true"
          className="select-none font-mono text-tertiary"
        >
          {prompt}
        </span>
        <code className="min-w-0 flex-1 truncate font-mono text-[14px] text-primary sm:text-[15px]">
          {command}
        </code>
        <span
          className={cn(
            'inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1',
            'text-[12px] font-medium',
            'transition-colors duration-(--duration-micro)',
            state === 'copied'
              ? 'text-confident-text'
              : 'text-tertiary group-hover:text-secondary',
          )}
        >
          {state === 'copied' ? (
            <Check className="size-3.5" aria-hidden="true" />
          ) : (
            <Copy className="size-3.5" aria-hidden="true" />
          )}
          {/* Width reserved for the longer label so the swap causes no shift. */}
          <span className="hidden w-[3.25rem] sm:inline">
            {state === 'copied' ? 'Copied' : 'Copy'}
          </span>
        </span>
      </button>

      <output aria-live="polite" className="sr-only">
        {state === 'copied'
          ? 'Command copied to clipboard'
          : state === 'error'
            ? 'Could not copy automatically. Select the command and copy manually.'
            : ''}
      </output>

      {state === 'error' ? (
        <p className="mt-2 text-[13px] text-degraded-text">
          Couldn&rsquo;t copy automatically — select the command above and copy
          it manually.
        </p>
      ) : null}
    </div>
  );
}
