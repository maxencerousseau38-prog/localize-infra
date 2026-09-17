import { z } from 'zod';

/**
 * Personal CLI tokens: `lit_` followed by 43 base64url characters, which is 32
 * random bytes.
 *
 * The prefix exists so a token is recognisable where it should not be — a
 * secret scanner, a log line, a pasted snippet — and so the API can tell a
 * personal token from the operator's server-to-server one without a database
 * round trip for every malformed header.
 *
 * Only the format lives here. Hashing uses `node:crypto` and happens in the two
 * servers that need it (apps/web issues, apps/api verifies); this package is
 * also imported by browser code.
 */
export const CLI_TOKEN_SCHEME = 'lit_';
export const CLI_TOKEN_PATTERN = /^lit_[A-Za-z0-9_-]{43}$/;

/** What a person sees to recognise a token: the scheme and six characters. */
export function cliTokenPrefix(token: string): string {
  return token.slice(0, CLI_TOKEN_SCHEME.length + 6);
}

export function isCliToken(value: string): boolean {
  return CLI_TOKEN_PATTERN.test(value);
}

/**
 * `GET /v1/whoami` — who the API thinks is calling.
 *
 * The CLI asks this before it writes or spends anything, so a revoked or
 * mistyped token is reported in one sentence instead of once per locale.
 */
export const WhoAmIResponseSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('operator') }),
  z.object({
    kind: z.literal('workspace'),
    workspace: z.string().min(1),
    githubConnected: z.boolean(),
  }),
]);
export type WhoAmIResponse = z.infer<typeof WhoAmIResponseSchema>;

/**
 * `POST /v1/open-pr/preflight` — can a pull request be opened here, before any
 * translation is paid for?
 */
export const PreflightRequestSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  baseBranch: z.string().min(1),
});
export type PreflightRequest = z.infer<typeof PreflightRequestSchema>;

export const PreflightResponseSchema = z.object({
  ok: z.literal(true),
  repository: z.string(),
  baseBranch: z.string(),
  private: z.boolean(),
});
export type PreflightResponse = z.infer<typeof PreflightResponseSchema>;
