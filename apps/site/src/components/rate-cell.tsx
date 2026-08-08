import { type Check, formatPercent, rate } from '@/lib/benchmarks';
import { cn } from '@localize-infra/ui';

/**
 * Renders one measured check result.
 *
 * A check with a zero denominator renders as "No data" and never as a
 * percentage. This is the whole reason `rate()` returns a tagged union rather
 * than a number: "100%" off nothing at all is technically true and completely
 * misleading, and it was live on this site before the artifact was generated.
 */
export function RateCell({
  check,
  className,
}: {
  check: Check;
  className?: string;
}) {
  const result = rate(check);

  if (result.kind === 'not-applicable') {
    return (
      <span
        className={cn('font-mono text-[13px] text-tertiary', className)}
        title="No entry in the corpus exercises this check"
      >
        No data
      </span>
    );
  }

  return (
    <span className={cn('font-mono text-[13px] text-primary', className)}>
      {formatPercent(result.percent)}
      <span className="ms-1.5 text-tertiary">
        {result.passed}/{result.applicable}
      </span>
    </span>
  );
}
