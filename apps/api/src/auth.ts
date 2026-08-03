import type { Context, Next } from 'hono';

const BEARER_PREFIX = 'Bearer ';

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
  if (!authHeader.startsWith(BEARER_PREFIX)) return false;
  const token = authHeader.slice(BEARER_PREFIX.length);
  return token.length > 0 && token === expectedToken;
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
