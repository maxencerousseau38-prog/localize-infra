/**
 * What a workspace has spent, from the rows that already record it.
 *
 * ## This reads; it does not count
 *
 * Every number here comes out of `api_usage_daily`, which `consume_api_quota`
 * writes as it charges. Nothing is recounted from `runs` or `run_translations`,
 * and that is deliberate: a second tally of the same spending would be free to
 * disagree with the one the ceiling is actually enforced against, and the
 * disagreement would surface as a page telling somebody they have budget left
 * while the API refuses them.
 *
 * ## Zero here is measured, not missing
 *
 * `lib/metrics/funnel.ts` refuses to print zero for something nobody measured,
 * and it is right to. This is the opposite case and the distinction matters:
 * `consume_api_quota` creates a row on first use of the day, so **no row means
 * no spending** — a fact, not an absence of one. Printing "0 of 5000" is
 * therefore honest, where "0%" for a merge rate nobody asks GitHub about would
 * not be.
 *
 * ## The day and the month are UTC
 *
 * Because `usage_date` is, and because the ceiling resets at 00:00 UTC. A month
 * boundary that moved with the reader's timezone would make the total disagree
 * with the rows it sums, twice a day, for everybody east or west of London.
 */

/** One row of `api_usage_daily`, in the columns this file reads. */
export interface UsageDay {
  usage_date: string;
  strings_translated: number;
  translate_requests: number;
  prs_opened: number;
}

/** What `api_limits()` returns. Read from the database, never hardcoded. */
export interface UsageLimits {
  strings_per_day: number;
  prs_per_day: number;
}

export interface UsageTotals {
  strings: number;
  pullRequests: number;
  /** How many distinct days in the period recorded any spending. */
  activeDays: number;
}

export interface UsageSummary {
  today: UsageTotals;
  month: UsageTotals;
  limits: UsageLimits;
  /** The UTC day these figures are for, so the page can say which. */
  todayDate: string;
  /** True once the workspace can no longer translate today. */
  atStringCeiling: boolean;
  /** True once the workspace can no longer open a pull request today. */
  atPullRequestCeiling: boolean;
}

const EMPTY: UsageTotals = { strings: 0, pullRequests: 0, activeDays: 0 };

function total(days: readonly UsageDay[]): UsageTotals {
  return days.reduce<UsageTotals>(
    (acc, day) => ({
      strings: acc.strings + day.strings_translated,
      pullRequests: acc.pullRequests + day.prs_opened,
      activeDays:
        acc.activeDays +
        (day.strings_translated > 0 || day.prs_opened > 0 ? 1 : 0),
    }),
    EMPTY,
  );
}

/** `2026-09-18` → `2026-09`. The prefix is the month, no parsing needed. */
function monthOf(isoDate: string): string {
  return isoDate.slice(0, 7);
}

export function buildUsageSummary(
  days: readonly UsageDay[],
  limits: UsageLimits,
  todayDate: string,
): UsageSummary {
  const today = total(days.filter((day) => day.usage_date === todayDate));
  const month = total(
    days.filter((day) => monthOf(day.usage_date) === monthOf(todayDate)),
  );

  return {
    today,
    month,
    limits,
    todayDate,
    /*
     * `>=`, not `===`. The ceiling is enforced as `used + units > limit`, so a
     * workspace sitting exactly on it cannot translate another string — and a
     * row could exceed it if the limit were ever lowered under existing
     * spending. Reporting "not at the ceiling" in either case would contradict
     * the refusal the API is about to give.
     */
    atStringCeiling: today.strings >= limits.strings_per_day,
    atPullRequestCeiling: today.pullRequests >= limits.prs_per_day,
  };
}

/** The UTC day, as `api_usage_daily` stores it. */
export function utcDate(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * "Never used" rather than a fabricated date.
 *
 * `cli_tokens.last_used_at` is null until `resolve_cli_token` stamps it, which
 * happens on the token's first API call. A token that has never been used says
 * so; it does not borrow its creation date.
 */
export function describeLastUsed(
  lastUsedAt: string | null,
  now: Date = new Date(),
): string {
  if (!lastUsedAt) return 'Never used';
  const then = new Date(lastUsedAt);
  const minutes = Math.floor((now.getTime() - then.getTime()) / 60_000);
  if (!Number.isFinite(minutes) || minutes < 0) return 'Never used';
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return then.toISOString().slice(0, 10);
}
