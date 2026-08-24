import 'server-only';

/**
 * The model key, and the one place that asks whether there is one.
 *
 * `server-only` is the load-bearing line: importing this from a client
 * component is a build error rather than a leak. The key itself never leaves
 * this module's callers — what crosses to the browser is the boolean below,
 * computed on the server and passed as a prop.
 *
 * Verified rather than asserted. Building `apps/web` with
 * `ANTHROPIC_API_KEY` set to a sentinel value and searching the output finds it
 * in **no** client chunk and in no server chunk either: it is not a
 * `NEXT_PUBLIC_` variable, so Next never inlines it, and `process.env` is read
 * at request time rather than baked into a build. The proof is what is served,
 * which is stronger than reading the import graph.
 *
 * Two copies of this function existed, one in `drafting.ts` and one in
 * `classification.ts`. Identical, and therefore free to drift — the failure
 * would be one surface quietly checking a variable the other does not.
 */

/** Whether this deployment can call a model at all. */
export function modelConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * The key, or an error naming what is missing.
 *
 * Throws rather than returning null so no caller can reach the network with an
 * `undefined` key and read the API's 401 as a product failure. The message
 * names the variable, because the person reading it is the person who can set
 * it.
 *
 * **This deployment does not have it.** `ANTHROPIC_API_KEY` is configured for
 * the `apps/api` Vercel project, not for the web one, so drafting and
 * classification both report themselves unavailable and say so on screen
 * instead of failing when somebody presses a button.
 */
export function requireModelKey(feature: string): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error(
      `${feature} is not available on this deployment: ANTHROPIC_API_KEY is not set`,
    );
  }
  return key;
}
