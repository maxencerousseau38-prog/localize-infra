import 'server-only';
import type { RunRecord } from '@/lib/data/workspace';
import { createClient } from '@/lib/supabase/server';
import {
  type UsageDay,
  type UsageLimits,
  type UsageSummary,
  buildUsageSummary,
  utcDate,
} from './summary';

/**
 * One workspace's usage, read as the signed-in member.
 *
 * **No service-role key, and that is the point.** Every source here was already
 * readable by a member before this page existed:
 *
 *  - `api_usage_daily` — `api_usage_select_member` admits `is_org_member`.
 *  - `api_limits()` — granted to `authenticated`, with the migration's own
 *    reason: "a workspace reading its own usage needs the denominator".
 *  - `cli_tokens` — a column grant that deliberately excludes `token_hash`.
 *  - `runs` — under the same RLS every other surface reads it through.
 *
 * So the isolation is the database's, not this file's: a member of another
 * workspace reading this page sees nothing, because the policies return
 * nothing. There is no place here where a workspace id could be trusted from a
 * request and used to widen that.
 */

export interface TokenUse {
  id: string;
  name: string;
  token_prefix: string;
  last_used_at: string | null;
  revoked_at: string | null;
  expires_at: string;
}

export interface UsagePage {
  summary: UsageSummary;
  /** Shaped for the shared runs table, never re-counted into the totals. */
  runs: RunRecord[];
  tokens: TokenUse[];
  /** True when the limits could not be read, so none are claimed. */
  limitsUnavailable: boolean;
}

const RECENT_RUNS = 10;

/** The fallback is not a guess at the limits — it is the absence of them. */
const NO_LIMITS: UsageLimits = { strings_per_day: 0, prs_per_day: 0 };

export async function loadUsage(organizationId: string): Promise<UsagePage> {
  const supabase = await createClient();
  const today = utcDate();
  // The month, as `usage_date` stores it. Asked of the database rather than
  // filtered in memory, so a workspace with a long history reads one month.
  const monthStart = `${today.slice(0, 7)}-01`;

  const [usage, limits, runs, tokens] = await Promise.all([
    supabase
      .from('api_usage_daily')
      .select('usage_date,strings_translated,translate_requests,prs_opened')
      .eq('organization_id', organizationId)
      .gte('usage_date', monthStart)
      .order('usage_date', { ascending: false }),
    supabase.rpc('api_limits'),
    supabase
      .from('runs')
      // The columns `toRunTableRow` reads, and no more. `run_translations` is
      // not touched: this page reports spending from the counters, and the
      // proposals are the customer's copy, not a usage figure.
      .select(
        'id,status,stage,framework,keys_extracted,keys_translated,locales_succeeded,locales_failed,started_at,finished_at,pr_number,pr_url,error,created_at,progress_at,source_locale,target_locales',
      )
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(RECENT_RUNS),
    supabase
      .from('cli_tokens')
      .select('id,name,token_prefix,last_used_at,revoked_at,expires_at')
      .eq('organization_id', organizationId)
      .order('last_used_at', { ascending: false, nullsFirst: false }),
  ]);

  /*
   * `api_limits()` returns one row. A deployment whose database cannot answer
   * has no denominator to show, and the page says so rather than printing a
   * number it made up — the same rule the funnel follows for a rate nobody
   * measures.
   */
  const limitRow = Array.isArray(limits.data)
    ? (limits.data[0] as UsageLimits | undefined)
    : (limits.data as UsageLimits | null);

  return {
    summary: buildUsageSummary(
      (usage.data ?? []) as UsageDay[],
      limitRow ?? NO_LIMITS,
      today,
    ),
    runs: (runs.data ?? []) as RunRecord[],
    tokens: (tokens.data ?? []) as TokenUse[],
    limitsUnavailable: !limitRow,
  };
}
