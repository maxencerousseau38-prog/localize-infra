import { describe, expect, it } from 'vitest';
import { tokenState } from './data';

const now = new Date('2026-09-17T12:00:00Z');

describe('tokenState', () => {
  it('is active before expiry and unrevoked', () => {
    expect(
      tokenState({ expires_at: '2026-12-01T00:00:00Z', revoked_at: null }, now),
    ).toBe('active');
  });

  it('is expired at or after expiry', () => {
    expect(
      tokenState({ expires_at: '2026-09-17T12:00:00Z', revoked_at: null }, now),
    ).toBe('expired');
  });

  it('reports revocation over expiry', () => {
    expect(
      tokenState(
        {
          expires_at: '2026-01-01T00:00:00Z',
          revoked_at: '2025-12-01T00:00:00Z',
        },
        now,
      ),
    ).toBe('revoked');
  });
});
