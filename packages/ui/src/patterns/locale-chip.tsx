import { cn } from '../lib/cn';
import { localeDisplayName } from '../lib/locale';

/**
 * A locale code with its resolved name as the accessible name (design system
 * §4.7). The code is what appears in the repository, so the code is what is
 * shown — but `pt-BR` is meaningless to a non-technical reviewer, so the full
 * name is always available to assistive technology and on hover.
 */
export function LocaleChip({
  locale,
  source = false,
  className,
}: {
  locale: string;
  /** Marks the locale the copy was authored in, not translated into. */
  source?: boolean;
  className?: string;
}) {
  const name = localeDisplayName(locale);
  return (
    <span
      title={name}
      className={cn(
        'inline-flex shrink-0 items-center rounded-[4px] border px-1.5',
        'font-mono text-[11px] leading-[18px] uppercase',
        source
          ? 'border-line bg-surface text-tertiary'
          : 'border-subtle bg-raised text-secondary',
        className,
      )}
    >
      {/* The code is decorative once the accessible name carries the full
          language name — reading "p t hyphen B R" aloud helps nobody. */}
      <span aria-hidden="true">{locale}</span>
      <span className="sr-only">
        {source ? `Source locale: ${name}` : name}
      </span>
    </span>
  );
}
