import { cn } from '@localize-infra/ui';

/**
 * A non-interactive code sample.
 *
 * Deliberately not syntax-highlighted: highlighting shell and JSON well needs a
 * tokenizer shipped to the browser, and this is a static page whose budget is
 * first paint. Monospace, a border and correct wrapping carry the meaning.
 *
 * `tabIndex={0}` because a horizontally scrollable region must be reachable by
 * keyboard — otherwise a long command is simply unreadable without a mouse
 * (WCAG 2.1.1).
 */
export function CodeBlock({
  children,
  label,
  showLabel = false,
  className,
}: {
  children: string;
  /** Accessible name, e.g. "Install from source". */
  label: string;
  /**
   * Print `label` above the block as well as announcing it.
   *
   * Off by default, because most blocks on the page are the only command in
   * their section and the paragraph above already names them. It exists for
   * the case where two blocks sit together and differ in one token: the
   * hosted-API command in POSIX and PowerShell form differ only in `export`
   * versus `$env:`, so a sighted reader was given two near-identical blocks
   * and left to diff them, while a screen reader was told which was which.
   * An accessible name that carries information no one can see is half a
   * label.
   */
  showLabel?: boolean;
  className?: string;
}) {
  return (
    <>
      {showLabel ? (
        <p className="mt-4 text-caption font-medium uppercase tracking-wide text-tertiary">
          {label}
        </p>
      ) : null}
      <pre
        // biome-ignore lint/a11y/noNoninteractiveTabindex: a horizontally scrollable region MUST be focusable, or its content is unreachable without a mouse (WCAG 2.1.1, and axe's scrollable-region-focusable rule).
        tabIndex={0}
        // biome-ignore lint/a11y/useSemanticElements: `region` is the role for a named scrollable area; there is no HTML element that conveys it here.
        role="region"
        aria-label={label}
        className={cn(
          // A shown label belongs to the block below it, so the block hugs it
          // instead of keeping the standalone spacing.
          showLabel ? 'mt-1.5' : 'mt-3',
          'overflow-x-auto rounded-md border border-subtle bg-surface/60',
          'px-4 py-3 font-mono text-small leading-6 text-secondary',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
          className,
        )}
      >
        <code>{children}</code>
      </pre>
    </>
  );
}

/** Inline code inside prose. */
export function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded-sm bg-raised px-1.5 py-0.5 font-mono text-small text-secondary">
      {children}
    </code>
  );
}
