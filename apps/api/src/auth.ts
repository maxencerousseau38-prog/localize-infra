import { createHash, timingSafeEqual } from 'node:crypto';
import type { Context, Next } from 'hono';

const BEARER_PREFIX = 'Bearer ';

/**
 * Constant-time string equality check. Hashes both inputs to a fixed-length
 * SHA-256 digest first so `timingSafeEqual` (which requires equal-length
 * buffers and throws otherwise) can be used unconditionally, and so the
 * comparison doesn't leak the token's length via a `.length` short-circuit.
 */
function constantTimeEquals(a: string, b: string): boolean {
  const bufA = createHash('sha256').update(a).digest();
  const bufB = createHash('sha256').update(b).digest();
  return timingSafeEqual(bufA, bufB);
}

/**
 * Pure check for whether an `Authorization` header value carries the exact
 * expected bearer token. Extracted from the Hono middleware so it can be
 * unit-tested without spinning up the app.
 */
export function isValidBearerToken(
  authHeader: string | null | undefined,
  expectedToken: string,
): boolean {
  if (!authHeader || !expectedToken) return false;
  // The scheme name ("Bearer") is case-insensitive per RFC 7235 section 2.1;
  // only the token value itself (compared below via constantTimeEquals) is
  // case-sensitive.
  const scheme = authHeader.slice(0, BEARER_PREFIX.length).toLowerCase();
  if (scheme !== BEARER_PREFIX.toLowerCase()) return false;
  const token = authHeader.slice(BEARER_PREFIX.length);
  return token.length > 0 && constantTimeEquals(token, expectedToken);
}

/**
 * Hono middleware that rejects any request whose `Authorization` header is
 * not exactly `Bearer <expectedToken>` with a 401 before it reaches the
 * route handler.
 */
export function createAuthMiddleware(expectedToken: string) {
  return async (c: Context, next: Next) => {
    const authHeader = c.req.header('Authorization');
    if (!isValidBearerToken(authHeader, expectedToken)) {
      return c.json(
        { error: 'Unauthorized: missing or invalid bearer token' },
        401,
      );
    }
    await next();
  };
}
