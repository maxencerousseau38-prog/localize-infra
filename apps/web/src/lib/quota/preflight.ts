import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { utcDate } from '@/lib/usage/summary';

/**
 * Refuse a run that cannot finish, before it spends anything.
 *
 * ## The failure this exists for
 *
 * `chargeWorkspace` charges per locale, immediately before that locale's model
 * call, and a refusal throws `QuotaRefusal`, which the per-locale catch in
 * `run-actions.ts` deliberately re-raises rather than isolating. That
 * re-raise is correct — one honest refusal must not become one message per
 * language, and a workspace out of budget is out of budget for every remaining
 * locale.
 *
 * What was wrong is what happens *before* it. A project of 800 strings into
 * seven locales plans 5,600 pairs against a ceiling of 5,000: the first six
 * locales are charged and translated, the seventh is refused, and the run ends
 * `failed`. The customer is billed nothing further and receives nothing — the
 * 4,800 pairs already paid for are discarded with the run, because a run that
 * throws opens no pull request.
 *
 * So the ceiling did not throttle the run. It destroyed it, and it destroyed
 * the most expensive part first. Nothing in the product warned that the run
 * could not fit, because nothing had ever asked.
 *
 * ## What this does, and what it deliberately does not
 *
 * It asks one question before the loop: does today's remaining budget cover
 * every pair this run plans to send? If not, the run is refused having spent
 * nothing, and the message names both numbers so the reader can decide whether
 * to remove a locale or wait for 00:00 UTC.
 *
 * **It is not the enforcement, and must never be mistaken for it.** Reading the
 * counter and then charging against it is a race: two runs started together
 * both read the same remainder and both pass here. `consume_api_quota` settles
 * that, atomically, per locale, exactly as before. This only removes the case
 * where the arithmetic was knowable in advance and nobody did it.
 *
 * ## Why it proceeds when the budget cannot be read
 *
 * `chargeWorkspace` fails closed, and it is right to: a check that did not run
 * is not evidence of budget. This one fails **open**, and that is not an
 * inconsistency. The charge still runs and still fails closed, so proceeding
 * here costs nothing that today's behaviour does not already cost; refusing
 * here would block runs on a read that has no authority anyway. A guard that
 * can only ever say "this will definitely fail" is allowed to be silent when
 * it does not know.
 *
 * ## Why the member's session and not the service-role key
 *
 * Both reads are already granted to a member — `api_usage_daily` through
 * `api_usage_select_member`, `api_limits()` through its grant to
 * `authenticated` — and `lib/usage/load.ts` has read exactly these two that
 * way since #105. Reaching for the admin client would widen the service-role
 * surface to obtain data the caller can already see.
 */

/** Today's translation budget for one workspace. */
export interface TranslationBudget {
  /** The daily ceiling, as `api_limits()` states it. */
  limit: number;
  /** Pairs already charged today. */
  used: number;
  /** What is left. Never negative. */
  remaining: number;
  /**
   * True when either read failed, so `remaining` means nothing.
   *
   * Callers must treat this as "no opinion", never as "no budget" — see the
   * fail-open reasoning above.
   */
  unknown: boolean;
}

const UNKNOWN: TranslationBudget = {
  limit: 0,
  used: 0,
  remaining: 0,
  unknown: true,
};

export async function readTranslationBudget(
  organizationId: string,
): Promise<TranslationBudget> {
  try {
    const supabase = await createClient();
    const today = utcDate();

    const [usage, limits] = await Promise.all([
      supabase
        .from('api_usage_daily')
        .select('strings_translated')
        .eq('organization_id', organizationId)
        .eq('usage_date', today)
        .maybeSingle(),
      supabase.rpc('api_limits'),
    ]);

    // A failed read is not a zero. Zero is a real answer — a workspace that has
    // spent nothing today — and the two must not collapse into the same value.
    if (usage.error || limits.error) return UNKNOWN;

    const limitRow = Array.isArray(limits.data)
      ? (limits.data[0] as { strings_per_day?: unknown } | undefined)
      : (limits.data as { strings_per_day?: unknown } | null);

    const limit = Number(limitRow?.strings_per_day);
    if (!Number.isFinite(limit) || limit <= 0) return UNKNOWN;

    /*
     * No row is not a missing reading. `consume_api_quota` inserts the row on
     * the first spend of the day, so its absence means nothing has been spent —
     * the same fact `/[org]/usage` relies on to print a zero it can defend.
     */
    const used = Number(usage.data?.strings_translated ?? 0);
    if (!Number.isFinite(used) || used < 0) return UNKNOWN;

    return {
      limit,
      used,
      remaining: Math.max(0, limit - used),
      unknown: false,
    };
  } catch {
    // Deliberately quiet. This path has no authority, the charge below has all
    // of it, and a log line per run for a check that changes nothing would
    // teach the reader to ignore it.
    return UNKNOWN;
  }
}

/**
 * The sentence, or `null` when the run may go ahead.
 *
 * Pure, so the arithmetic and the wording are testable without a database —
 * and so the one place that decides cannot drift from the one place that
 * explains.
 */
export function describeRunShortfall(
  plannedUnits: number,
  budget: TranslationBudget,
): string | null {
  if (budget.unknown) return null;
  if (plannedUnits <= budget.remaining) return null;

  /*
   * Two different refusals, because they have two different fixes.
   *
   * A run larger than the whole ceiling can never succeed, however long anyone
   * waits, and telling that reader to come back at 00:00 UTC would be false.
   * A run merely larger than what is left today is a waiting problem.
   */
  const needs = plannedUnits.toLocaleString('en-US');
  const ceiling = budget.limit.toLocaleString('en-US');

  if (plannedUnits > budget.limit) {
    return `This run needs ${needs} string-language pairs, more than this workspace’s entire daily ceiling of ${ceiling}. It cannot finish in one day, so it was not started and nothing was charged. Translate into fewer languages at a time, or ask the operator to raise the ceiling.`;
  }

  const left = budget.remaining.toLocaleString('en-US');
  return `This run needs ${needs} string-language pairs and ${left} of today’s ${ceiling} are left. It was not started and nothing was charged — a run that stops halfway loses the languages it already paid for. The ceiling resets at 00:00 UTC.`;
}
