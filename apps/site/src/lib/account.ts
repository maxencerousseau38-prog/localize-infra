/**
 * Who is looking, and what they are entitled to.
 *
 * READ THIS BEFORE WIRING A BUTTON TO IT.
 *
 * There are no accounts. There is no session store, no database, no billing
 * (CLAUDE.md: "N'existe pas encore … comptes … facturation"). The standing rule
 * is that the interface must never simulate those, so this module does not
 * pretend to authenticate anyone: `readViewer()` returns `anonymous`, always,
 * because that is the only true answer today.
 *
 * What it does provide is the shape of the decision, so the conversion flow is
 * written once and correctly rather than retrofitted later:
 *
 *   anonymous                        → create an account or sign in
 *   authenticated, no entitlement    → upgrade
 *   authenticated, entitled          → proceed, no interruption
 *
 * All three branches are implemented in `ConversionDialog` and all three are
 * exercised by tests that inject a viewer. When an auth backend exists, the
 * only change here is `readViewer` and `ACCOUNT_BACKEND`; no call site moves.
 *
 * `ACCOUNT_BACKEND` is what keeps this honest at runtime. While it is
 * `'absent'`, the dialog says so in plain words instead of showing an email
 * field that goes nowhere — a sign-up form that cannot sign anyone up is the
 * exact simulation the project forbids, and it is worse than an honest
 * explanation because it costs the reader their email address to discover it.
 */

export type Entitlement =
  /** Signed in, but no plan covers the hosted product. */
  | 'none'
  /** Signed in and covered. */
  | 'active';

export type Viewer =
  | { status: 'anonymous' }
  | { status: 'authenticated'; email: string; entitlement: Entitlement };

export const ANONYMOUS: Viewer = { status: 'anonymous' };

/**
 * Whether an account system exists to talk to.
 *
 * `'absent'` is not a placeholder to be flipped optimistically — it is the
 * assertion that no code path below may collect credentials, imply a session,
 * or report a plan. Flip it only when there is something real behind it.
 */
export const ACCOUNT_BACKEND: 'absent' | 'connected' = 'absent';

/**
 * The current viewer.
 *
 * Deliberately synchronous and deliberately constant. When a session exists
 * this becomes a read of it; until then, returning anything other than
 * `anonymous` would be inventing a user.
 */
export function readViewer(): Viewer {
  return ANONYMOUS;
}

/** Whether this viewer may proceed to the gated action without interruption. */
export function hasAccess(viewer: Viewer): boolean {
  return viewer.status === 'authenticated' && viewer.entitlement === 'active';
}
