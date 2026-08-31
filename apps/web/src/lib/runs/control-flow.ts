/**
 * Whether a thrown value is Next moving control rather than reporting a fault.
 *
 * `redirect()` and `notFound()` work by throwing. The throw is the mechanism,
 * not the failure, and Next catches it upstream to perform the navigation. A
 * `catch` that swallows one of them turns `redirect('/login')` into a silent
 * no-op — the request finishes with no navigation and no message, which is the
 * same dead-button symptom the catch was added to remove.
 *
 * Matched on the digest **value**, never on its presence. A genuine `Error`
 * thrown in a production Next build also carries a `digest` — a hash of the
 * message, used to correlate a client-side report with a server log. Treating
 * "has a digest" as "is control flow" would re-throw every real server error
 * instead of reporting it, which is exactly the behaviour being fixed.
 *
 * Kept out of the `'use server'` module deliberately: every export of such a
 * file becomes a callable server action, so a helper declared there would be a
 * public endpoint. It also has to live somewhere it can be tested, and a
 * server action cannot be imported by a unit test.
 */
const CONTROL_FLOW_DIGESTS = [
  // `redirect()` — the digest carries the destination after a semicolon.
  'NEXT_REDIRECT',
  // `notFound()` — exact, no payload.
  'NEXT_NOT_FOUND',
  // `forbidden()` / `unauthorized()` and the status-code helpers.
  'NEXT_HTTP_ERROR_FALLBACK',
] as const;

export function isNextControlFlowError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;

  const { digest } = error as { digest?: unknown };
  if (typeof digest !== 'string') return false;

  return CONTROL_FLOW_DIGESTS.some(
    (marker) => digest === marker || digest.startsWith(`${marker};`),
  );
}
