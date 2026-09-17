import { afterEach, describe, expect, it, vi } from 'vitest';
import { OPERATOR, type WorkspaceCaller } from './callers.js';
import {
  type QuotaConsumer,
  checkQuota,
  createPostgrestQuotaConsumer,
  describeDelay,
  describeQuotaRefusal,
  translationUnits,
} from './quota.js';

afterEach(() => {
  vi.restoreAllMocks();
});

const WORKSPACE: WorkspaceCaller = {
  kind: 'workspace',
  tokenId: '11111111-1111-4111-8111-111111111111',
  userId: '22222222-2222-4222-8222-222222222222',
  organizationId: '33333333-3333-4333-8333-333333333333',
  organizationSlug: 'acme',
  installationId: 42,
  privateRepositories: false,
};

const CONFIG = {
  supabaseUrl: 'https://db.test',
  serviceRoleKey: 'service-key',
};

function row(over: Record<string, unknown> = {}) {
  return [
    {
      allowed: false,
      reason: 'rate',
      retry_after_seconds: 12,
      used: 31,
      limit_value: 30,
      ...over,
    },
  ];
}

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe('translationUnits', () => {
  it('counts the strings a request carries', () => {
    expect(translationUnits({ strings: [{ key: 'a' }, { key: 'b' }] })).toBe(2);
  });

  /*
   * A body the guard cannot read still costs one unit rather than zero: the
   * request is about to be rejected as invalid, and a request that costs
   * nothing is one a loop can send for free.
   */
  it('costs one unit for a body it cannot read', () => {
    expect(translationUnits(null)).toBe(1);
    expect(translationUnits('nonsense')).toBe(1);
    expect(translationUnits({})).toBe(1);
    expect(translationUnits({ strings: [] })).toBe(1);
    expect(translationUnits({ strings: 'lots' })).toBe(1);
  });

  it('clamps an absurd request to what the database accepts', () => {
    expect(translationUnits({ strings: new Array(50_000).fill({}) })).toBe(
      10_000,
    );
  });
});

describe('describeDelay', () => {
  it('reads as a wait a person can act on', () => {
    expect(describeDelay(12)).toBe('in 12 seconds');
    expect(describeDelay(0.2)).toBe('in 1 seconds');
    expect(describeDelay(600)).toBe('in about 10 minutes');
    expect(describeDelay(10_800)).toBe('in about 3 hours');
  });
});

describe('describeQuotaRefusal', () => {
  it('names the rate limit and how long to wait', () => {
    const refusal = describeQuotaRefusal('translate', {
      allowed: false,
      reason: 'rate',
      retryAfterSeconds: 12,
      used: 31,
      limit: 30,
    });
    expect(refusal.status).toBe(429);
    expect(refusal.retryAfterSeconds).toBe(12);
    expect(refusal.body.error).toBe(
      'Too many translation requests from this CLI token: the limit is 30 a minute. Try again in 12 seconds.',
    );
  });

  it('names the daily ceiling, its reset, and who can raise it', () => {
    const refusal = describeQuotaRefusal('translate', {
      allowed: false,
      reason: 'quota',
      retryAfterSeconds: 7200,
      used: 5000,
      limit: 5000,
    });
    expect(refusal.body.error).toMatch(/ceiling of 5000 strings/);
    expect(refusal.body.error).toMatch(/resets at 00:00 UTC, in about 2 hours/);
  });

  it('says pull requests when it is pull requests', () => {
    const rate = describeQuotaRefusal('open_pr', {
      allowed: false,
      reason: 'rate',
      retryAfterSeconds: 5,
      used: 11,
      limit: 10,
    });
    expect(rate.body.error).toMatch(/Too many pull request requests/);
    const quota = describeQuotaRefusal('open_pr', {
      allowed: false,
      reason: 'quota',
      retryAfterSeconds: 60,
      used: 50,
      limit: 50,
    });
    expect(quota.body.error).toMatch(/ceiling of 50 pull requests/);
  });
});

describe('createPostgrestQuotaConsumer', () => {
  it('charges through rpc/consume_api_quota with the service role', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse([
        {
          allowed: true,
          reason: null,
          retry_after_seconds: 0,
          used: 12,
          limit_value: 5000,
        },
      ]),
    );
    const consumer = createPostgrestQuotaConsumer(
      CONFIG,
      fetchImpl as unknown as typeof fetch,
    );
    await expect(consumer.consume(WORKSPACE, 'translate', 12)).resolves.toEqual(
      { allowed: true },
    );

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe('https://db.test/rest/v1/rpc/consume_api_quota');
    expect((init.headers as Record<string, string>).apikey).toBe('service-key');
    expect(JSON.parse(init.body as string)).toEqual({
      p_token_id: WORKSPACE.tokenId,
      p_organization_id: WORKSPACE.organizationId,
      p_route: 'translate',
      p_units: 12,
    });
  });

  it('reads a refusal, including numbers PostgREST may send as strings', async () => {
    const consumer = createPostgrestQuotaConsumer(CONFIG, (async () =>
      jsonResponse(
        row({ retry_after_seconds: '12', used: '31', limit_value: '30' }),
      )) as unknown as typeof fetch);
    await expect(consumer.consume(WORKSPACE, 'translate', 1)).resolves.toEqual({
      allowed: false,
      reason: 'rate',
      retryAfterSeconds: 12,
      used: 31,
      limit: 30,
    });
  });

  it('throws on a failed call and on an empty answer', async () => {
    const failing = createPostgrestQuotaConsumer(CONFIG, (async () =>
      jsonResponse({ message: 'nope' }, 401)) as unknown as typeof fetch);
    await expect(failing.consume(WORKSPACE, 'translate', 1)).rejects.toThrow(
      'usage check failed (401)',
    );
    const empty = createPostgrestQuotaConsumer(CONFIG, (async () =>
      jsonResponse([])) as unknown as typeof fetch);
    await expect(empty.consume(WORKSPACE, 'translate', 1)).rejects.toThrow(
      'no row',
    );
  });
});

describe('checkQuota', () => {
  function consumerReturning(...decisions: unknown[]): QuotaConsumer {
    const queue = [...decisions];
    return {
      consume: vi.fn(async () => queue.shift() as never),
    };
  }

  /*
   * The operator token is `apps/web` talking to its own API. Charging it would
   * meter the product's own pipeline against one workspace's ceiling.
   */
  it('never charges the operator token', async () => {
    const consumer = consumerReturning();
    await expect(
      checkQuota(consumer, OPERATOR, 'translate', 500),
    ).resolves.toEqual({ ok: true });
    expect(consumer.consume).not.toHaveBeenCalled();
  });

  it('does nothing on a deployment with no database', async () => {
    await expect(
      checkQuota(null, WORKSPACE, 'translate', 500),
    ).resolves.toEqual({ ok: true });
  });

  it('lets an allowed request through', async () => {
    const consumer = consumerReturning({ allowed: true });
    await expect(
      checkQuota(consumer, WORKSPACE, 'translate', 3),
    ).resolves.toEqual({ ok: true });
    expect(consumer.consume).toHaveBeenCalledWith(WORKSPACE, 'translate', 3);
  });

  it('turns a refusal into 429 with a wait', async () => {
    const consumer = consumerReturning({
      allowed: false,
      reason: 'rate',
      retryAfterSeconds: 9,
      used: 31,
      limit: 30,
    });
    const outcome = await checkQuota(consumer, WORKSPACE, 'translate', 1);
    expect(outcome).toMatchObject({
      ok: false,
      status: 429,
      retryAfterSeconds: 9,
    });
    if (!outcome.ok) expect(outcome.body.error).toMatch(/Too many/);
  });

  /*
   * Fail-closed, like token resolution: a usage check that could not run is
   * not evidence that there is budget left.
   */
  it('answers 503 when the usage check itself fails, and does not run the work', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const consumer: QuotaConsumer = {
      consume: async () => {
        throw new Error('database unreachable');
      },
    };
    const outcome = await checkQuota(consumer, WORKSPACE, 'translate', 1);
    expect(outcome).toMatchObject({ ok: false, status: 503 });
    if (!outcome.ok) {
      expect(outcome.body.error).toMatch(/Could not check/);
      expect(outcome.body.error).not.toMatch(/database unreachable/);
      expect(outcome.retryAfterSeconds).toBeUndefined();
    }
    expect(logged).toHaveBeenCalled();
  });
});
