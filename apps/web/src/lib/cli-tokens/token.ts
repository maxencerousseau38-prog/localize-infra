import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { CLI_TOKEN_SCHEME, cliTokenPrefix } from '@localize-infra/schemas';

/**
 * A new personal CLI token: the plaintext, shown once, and what the database
 * keeps instead of it.
 *
 * Generated here rather than in Postgres so the plaintext never reaches the
 * database at all — not in a function argument, not in a statement log. The
 * database receives the SHA-256 digest and a six-character prefix for display.
 */
export interface IssuedToken {
  token: string;
  hash: string;
  prefix: string;
}

export function hashCliToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function generateCliToken(): IssuedToken {
  // 32 bytes → 43 base64url characters, which is what CLI_TOKEN_PATTERN wants.
  const token = `${CLI_TOKEN_SCHEME}${randomBytes(32).toString('base64url')}`;
  return { token, hash: hashCliToken(token), prefix: cliTokenPrefix(token) };
}
