import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { createAuthMiddleware, isValidBearerToken } from './auth.js';

describe('isValidBearerToken', () => {
  const expectedToken = 'super-secret-token';

  it('returns true for an exact "Bearer <token>" match', () => {
    expect(isValidBearerToken(`Bearer ${expectedToken}`, expectedToken)).toBe(
      true,
    );
  });

  it('returns false when the header is missing', () => {
    expect(isValidBearerToken(undefined, expectedToken)).toBe(false);
    expect(isValidBearerToken(null, expectedToken)).toBe(false);
  });

  it('returns false when the token does not match', () => {
    expect(isValidBearerToken('Bearer wrong-token', expectedToken)).toBe(false);
  });

  it('returns false when the "Bearer " prefix is missing', () => {
    expect(isValidBearerToken(expectedToken, expectedToken)).toBe(false);
  });

  it('returns false for an empty token', () => {
    expect(isValidBearerToken('Bearer ', expectedToken)).toBe(false);
  });

  it('returns false for a token sharing a long common prefix with the expected token but differing in the last character', () => {
    const almostRight = `${expectedToken.slice(0, -1)}X`;
    expect(isValidBearerToken(`Bearer ${almostRight}`, expectedToken)).toBe(
      false,
    );
  });

  it('accepts a differently-cased "bearer" scheme keyword (RFC 7235 scheme names are case-insensitive)', () => {
    expect(isValidBearerToken(`bearer ${expectedToken}`, expectedToken)).toBe(
      true,
    );
    expect(isValidBearerToken(`BEARER ${expectedToken}`, expectedToken)).toBe(
      true,
    );
    expect(isValidBearerToken(`BeArEr ${expectedToken}`, expectedToken)).toBe(
      true,
    );
  });

  it('still compares the token value itself case-sensitively', () => {
    expect(
      isValidBearerToken(
        `Bearer ${expectedToken.toUpperCase()}`,
        expectedToken,
      ),
    ).toBe(false);
  });
});

describe('createAuthMiddleware', () => {
  const expectedToken = 'super-secret-token';

  function buildApp() {
    const app = new Hono();
    app.use('/protected', createAuthMiddleware(expectedToken));
    app.get('/protected', (c) => c.json({ ok: true }));
    return app;
  }

  it('passes through and reaches the route when the token is valid', async () => {
    const app = buildApp();
    const res = await app.request('/protected', {
      headers: { Authorization: `Bearer ${expectedToken}` },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('returns 401 with a clear error body when the header is missing', async () => {
    const app = buildApp();
    const res = await app.request('/protected');
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toEqual(expect.any(String));
    expect(body.error.length).toBeGreaterThan(0);
  });

  it('returns 401 when the token is wrong', async () => {
    const app = buildApp();
    const res = await app.request('/protected', {
      headers: { Authorization: 'Bearer wrong-token' },
    });
    expect(res.status).toBe(401);
  });
});
