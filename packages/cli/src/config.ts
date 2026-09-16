/**
 * The API this command talks to when nothing says otherwise: the production
 * deployment of `apps/api`.
 *
 * This was `http://localhost:8787`, which meant an unmodified `npx` reached
 * nothing, and the one setting nobody could avoid was the one they had to type.
 * The hosted API is still not open: every `/v1/*` route requires a bearer
 * token, and `init` refuses before anything is written or sent when none is
 * configured. What changes is that a person who holds a token needs nothing
 * else.
 *
 * A URL, not a secret. The token is never part of the package; it comes from
 * `--api-token` or `LOCALIZE_API_TOKEN` at run time.
 *
 * Read by `init` and by the usage text, so the two cannot disagree.
 */
export const DEFAULT_API_URL = 'https://localize-infra-api.vercel.app';

/**
 * The base URL requests are sent to.
 *
 * Trailing slashes are removed because every request appends `/v1/…`. With
 * the default now a full address people will copy, `LOCALIZE_API_URL=…/` is
 * the likely typo, and it produced `//v1/translate` — which the production
 * deployment answers with a 308 rather than the route.
 */
export function resolveApiUrl(value: string | undefined): string {
  return (value ?? DEFAULT_API_URL).replace(/\/+$/, '');
}

/**
 * A setting given on the command line, in the environment, or nowhere.
 *
 * The flag wins, which is the rule `--api-token` already followed: an explicit
 * argument is a deliberate override of an ambient one.
 *
 * **An empty value is absence, not a choice**, and that is why this is a
 * function rather than `??`. `LOCALIZE_API_URL=` in a shell profile, or a CI
 * secret that resolved to nothing, sets the variable to the empty string.
 * Nullish coalescing passes that through, and `resolveApiUrl` would then keep
 * the empty string, because it is not nullish. Every request would go to `/v1/translate` with no origin, and
 * the user would be shown a fetch error naming a URL they never typed.
 *
 * Trimmed, for the same reason: a value with a stray newline — the shape a
 * `$(cat secret)` produces — is the value the person meant.
 */
export function fromFlagOrEnv(
  flagValue: string | undefined,
  envValue: string | undefined,
): string | undefined {
  const flag = flagValue?.trim();
  if (flag) return flag;

  const env = envValue?.trim();
  if (env) return env;

  return undefined;
}
