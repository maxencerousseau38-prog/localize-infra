/**
 * A setting given on the command line, in the environment, or nowhere.
 *
 * The flag wins, which is the rule `--api-token` already followed: an explicit
 * argument is a deliberate override of an ambient one.
 *
 * **An empty value is absence, not a choice**, and that is why this is a
 * function rather than `??`. `LOCALIZE_API_URL=` in a shell profile, or a CI
 * secret that resolved to nothing, sets the variable to the empty string.
 * Nullish coalescing passes that through; `runInit` then reads
 * `options.apiUrl ?? DEFAULT_API_URL` and keeps the empty string, because it is
 * not nullish. Every request would go to `/v1/translate` with no origin, and
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
