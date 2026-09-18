import type {
  Caller,
  TokenResolverConfig,
  WorkspaceCaller,
} from './callers.js';

/**
 * What a personal CLI token may spend, and how fast.
 *
 * Every `/v1/translate` call reaches a paid model on the operator's account,
 * and every `/v1/open-pr` call writes to GitHub. A valid token could do either
 * in a loop, so the only thing between one shared or runaway credential and an
 * unbounded bill was that nobody had tried.
 *
 * The rules live in the database (`consume_api_quota`), not here, for the same
 * reason token resolution does: this process is serverless and horizontally
 * scaled, so a counter held in memory counts one instance's requests and
 * agrees with no other instance. Postgres is the only place where "how many
 * this minute" has a single answer.
 *
 * **The operator token is never charged here.** It is server-to-server, held
 * by `apps/web`; `checkQuota` returns immediately for it and never touches the
 * database.
 *
 * This used to read "which has its own guards". It had none, and that sentence
 * is why nobody looked: every "Run pipeline" click reached a paid model with no
 * rate window and no daily ceiling, which made the browser the cheapest way to
 * spend the operator's money. `apps/web` now charges `consume_api_quota`
 * itself, with the workspace as the subject instead of a token, against the
 * same counters and the same numbers — see `apps/web/src/lib/quota/charge.ts`
 * and migration `20260918000100`.
 *
 * The exemption stays, and stays correct: this process authenticates a token,
 * not a workspace, and the operator bearer names no organization to charge.
 */
export type QuotaRoute = 'translate' | 'open_pr';

export type QuotaDecision =
  | { allowed: true }
  | {
      allowed: false;
      /** 'rate' — too fast; 'quota' — too much today. Different fixes. */
      reason: 'rate' | 'quota';
      retryAfterSeconds: number;
      used: number;
      limit: number;
    };

export interface QuotaConsumer {
  /** Charges the request and says whether it may proceed. */
  consume(
    caller: WorkspaceCaller,
    route: QuotaRoute,
    units: number,
  ): Promise<QuotaDecision>;
}

interface QuotaRow {
  allowed: boolean;
  reason: string | null;
  retry_after_seconds: number | string | null;
  used: number | string | null;
  limit_value: number | string | null;
}

/**
 * The number of strings a translate request would spend.
 *
 * Read from the raw body rather than from a parsed request, because the charge
 * has to happen *before* the work: by the time the route handler has validated
 * the body it is one `await` away from calling the model. A body this cannot
 * read costs one unit — it is about to be rejected as invalid anyway, and the
 * rate window still counts the attempt.
 */
export function translationUnits(body: unknown): number {
  if (typeof body !== 'object' || body === null) return 1;
  const strings = (body as { strings?: unknown }).strings;
  if (!Array.isArray(strings) || strings.length === 0) return 1;
  // The database refuses more than 10000 units outright; clamping here turns
  // an absurd request into a refusal a person can read rather than a 500.
  return Math.min(strings.length, 10000);
}

export function createPostgrestQuotaConsumer(
  config: TokenResolverConfig,
  fetchImpl: typeof fetch = fetch,
): QuotaConsumer {
  return {
    async consume(caller, route, units) {
      const response = await fetchImpl(
        `${config.supabaseUrl}/rest/v1/rpc/consume_api_quota`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            apikey: config.serviceRoleKey,
            authorization: `Bearer ${config.serviceRoleKey}`,
          },
          body: JSON.stringify({
            p_token_id: caller.tokenId,
            p_organization_id: caller.organizationId,
            p_route: route,
            p_units: units,
          }),
        },
      );
      if (!response.ok) {
        throw new Error(`usage check failed (${response.status})`);
      }
      const rows = (await response.json()) as QuotaRow[];
      const row = Array.isArray(rows) ? rows[0] : undefined;
      if (!row) throw new Error('usage check returned no row');
      if (row.allowed) return { allowed: true };
      return {
        allowed: false,
        reason: row.reason === 'rate' ? 'rate' : 'quota',
        retryAfterSeconds: Math.max(1, Number(row.retry_after_seconds ?? 1)),
        used: Number(row.used ?? 0),
        limit: Number(row.limit_value ?? 0),
      };
    },
  };
}

export type QuotaOutcome =
  | { ok: true }
  | {
      ok: false;
      status: 429 | 503;
      body: { error: string };
      retryAfterSeconds?: number;
    };

const ROUTE_NOUN: Record<QuotaRoute, string> = {
  translate: 'translation requests',
  open_pr: 'pull request requests',
};

/** "in 45 seconds" / "in about 3 hours" — a wait a person can act on. */
export function describeDelay(seconds: number): string {
  if (seconds < 90) return `in ${Math.max(1, Math.round(seconds))} seconds`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 90) return `in about ${minutes} minutes`;
  return `in about ${Math.round(minutes / 60)} hours`;
}

export function describeQuotaRefusal(
  route: QuotaRoute,
  decision: Extract<QuotaDecision, { allowed: false }>,
): { status: 429; body: { error: string }; retryAfterSeconds: number } {
  const wait = describeDelay(decision.retryAfterSeconds);
  const error =
    decision.reason === 'rate'
      ? `Too many ${ROUTE_NOUN[route]} from this CLI token: the limit is ${decision.limit} a minute. Try again ${wait}.`
      : route === 'translate'
        ? `This workspace has reached today's translation ceiling of ${decision.limit} strings. It resets at 00:00 UTC, ${wait}. Ask the operator if you need more.`
        : `This workspace has reached today's ceiling of ${decision.limit} pull requests. It resets at 00:00 UTC, ${wait}. Ask the operator if you need more.`;
  return {
    status: 429,
    body: { error },
    retryAfterSeconds: decision.retryAfterSeconds,
  };
}

/**
 * The one call a route makes. Charges the caller, or explains the refusal.
 *
 * Fail-closed on a database error, like token resolution: a usage check that
 * cannot run is not evidence that there is budget left, and 503 says "try
 * again" rather than inviting the caller to retry immediately.
 */
export async function checkQuota(
  consumer: QuotaConsumer | null,
  caller: Caller,
  route: QuotaRoute,
  units: number,
): Promise<QuotaOutcome> {
  // The operator token, and a self-hosted deployment with no database: nothing
  // to charge, nowhere to charge it.
  if (caller.kind === 'operator' || !consumer) return { ok: true };

  let decision: QuotaDecision;
  try {
    decision = await consumer.consume(caller, route, units);
  } catch (err) {
    console.error('usage check failed:', err);
    return {
      ok: false,
      status: 503,
      body: {
        error:
          'Could not check this workspace’s usage right now, so the request was not run. Try again in a moment.',
      },
    };
  }
  if (decision.allowed) return { ok: true };
  const refusal = describeQuotaRefusal(route, decision);
  return {
    ok: false,
    status: refusal.status,
    body: refusal.body,
    retryAfterSeconds: refusal.retryAfterSeconds,
  };
}
