import { describe, expect, it, vi } from 'vitest';
import {
  NOT_CONFIGURED,
  QuotaRefusal,
  type QuotaRow,
  UNAVAILABLE,
  chargeWorkspace,
  describeDelay,
  describeRefusal,
  interpretQuotaRow,
} from './charge.js';

/**
 * What the browser path is allowed to spend, and how it refuses.
 *
 * The rule under most of these is the one the API already follows and the web
 * app did not: **a check that could not run is not evidence that there is
 * budget left.** Every branch that is not an explicit allow must refuse, and
 * refuse before the model is called.
 */

const allowed: QuotaRow = {
  allowed: true,
  reason: null,
  retry_after_seconds: 0,
  used: 12,
  limit_value: 5000,
};

const charge = (
  rpc: NonNullable<Parameters<typeof chargeWorkspace>[0]['rpc']>,
) =>
  chargeWorkspace({
    organizationId: '00000000-0000-0000-0000-000000000001',
    route: 'translate',
    units: 3,
    rpc,
  });

describe('it charges the workspace, not a token', () => {
  it('sends a null token and the organization', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [allowed], error: null });
    await charge(rpc);
    expect(rpc).toHaveBeenCalledWith({
      p_token_id: null,
      p_organization_id: '00000000-0000-0000-0000-000000000001',
      p_route: 'translate',
      p_units: 3,
    });
  });

  it('returns without throwing when the row allows it', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [allowed], error: null });
    await expect(charge(rpc)).resolves.toBeUndefined();
  });

  it('accepts a single row as well as an array', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: allowed, error: null });
    await expect(charge(rpc)).resolves.toBeUndefined();
  });
});

describe('it fails closed', () => {
  it('refuses when the database returns an error', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(charge(rpc)).rejects.toBeInstanceOf(QuotaRefusal);
    await expect(charge(rpc)).rejects.toThrow(UNAVAILABLE);
  });

  it('refuses when the call itself throws', async () => {
    const rpc = vi.fn().mockRejectedValue(new Error('socket hang up'));
    await expect(charge(rpc)).rejects.toThrow(UNAVAILABLE);
  });

  it('refuses when no row comes back', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    await expect(charge(rpc)).rejects.toThrow(UNAVAILABLE);
  });

  it('never leaks the database error into the message a customer reads', async () => {
    const secret = 'postgrest failed on key=eyJhbGciOi…';
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: secret } });
    await expect(charge(rpc)).rejects.toThrow(
      expect.not.stringContaining('eyJhbGciOi'),
    );
  });

  it('marks an unavailable check as such, not as a quota refusal', async () => {
    const rpc = vi.fn().mockRejectedValue(new Error('down'));
    await charge(rpc).catch((error) => {
      expect(error).toBeInstanceOf(QuotaRefusal);
      expect((error as QuotaRefusal).reason).toBe('unavailable');
    });
    expect.assertions(2);
  });
});

describe('a refusal carries its reason', () => {
  const refused = (over: Partial<QuotaRow> = {}): QuotaRow => ({
    allowed: false,
    reason: 'quota',
    retry_after_seconds: 32512,
    used: 5000,
    limit_value: 5000,
    ...over,
  });

  it('throws QuotaRefusal with reason quota', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [refused()], error: null });
    await charge(rpc).catch((error) => {
      expect((error as QuotaRefusal).reason).toBe('quota');
    });
    expect.assertions(1);
  });

  it('throws QuotaRefusal with reason rate', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: [refused({ reason: 'rate' })], error: null });
    await charge(rpc).catch((error) => {
      expect((error as QuotaRefusal).reason).toBe('rate');
    });
    expect.assertions(1);
  });

  it('treats an unknown reason as a quota refusal, not as allowed', async () => {
    const decision = interpretQuotaRow(refused({ reason: 'something-new' }));
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.reason).toBe('quota');
  });
});

describe('the sentence is addressed to whoever clicked', () => {
  const decision = {
    allowed: false as const,
    reason: 'quota' as const,
    retryAfterSeconds: 32512,
    used: 5000,
    limit: 5000,
  };

  it('never names a CLI token, because the reader never used one', () => {
    for (const route of ['translate', 'open_pr'] as const) {
      const sentence = describeRefusal(route, decision);
      expect(sentence, route).not.toMatch(/CLI token/i);
      expect(sentence, route).not.toMatch(/--api-token|LOCALIZE_API_TOKEN/);
    }
  });

  it('names the limit and the reset, both from the database', () => {
    const sentence = describeRefusal('translate', decision);
    expect(sentence).toContain('5000 strings');
    expect(sentence).toContain('00:00 UTC');
    expect(sentence).toContain('in about 9 hours');
  });

  it('says nothing was spent, because nothing was', () => {
    expect(describeRefusal('translate', decision)).toMatch(
      /Nothing was translated and nothing was charged/,
    );
  });

  it('distinguishes going too fast from having spent too much', () => {
    const rate = describeRefusal('translate', {
      ...decision,
      reason: 'rate',
      retryAfterSeconds: 40,
      limit: 30,
    });
    expect(rate).toMatch(/faster than the hosted API allows/);
    expect(rate).not.toMatch(/ceiling/);
    expect(rate).toContain('in 40 seconds');
  });

  it('uses the pull-request wording on the pull-request route', () => {
    expect(describeRefusal('open_pr', decision)).toMatch(/pull requests/);
    expect(describeRefusal('open_pr', decision)).not.toMatch(/strings/);
  });

  it('names the missing variable when the key is absent', () => {
    expect(NOT_CONFIGURED).toContain('SUPABASE_SERVICE_ROLE_KEY');
  });
});

describe('the wait reads as a wait', () => {
  it('rounds to a unit that still says something', () => {
    expect(describeDelay(40)).toBe('in 40 seconds');
    expect(describeDelay(600)).toBe('in about 10 minutes');
    expect(describeDelay(32512)).toBe('in about 9 hours');
  });

  it('never says zero seconds', () => {
    expect(describeDelay(0)).toBe('in 1 seconds');
  });
});
