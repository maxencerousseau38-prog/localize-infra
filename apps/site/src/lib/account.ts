/**
 * Who is looking, and what they are entitled to.
 *
 * READ THIS BEFORE WIRING A BUTTON TO IT.
 *
 * **This said "There are no accounts. There is no session store, no database".
 * That stopped being true when `apps/web` shipped them** — accounts, workspaces
 * and projects on Postgres, with sign-up open. What is still true is narrower
 * and is the reason nothing below changed: *this site* has no session. It is a
 * static build on another origin and reads nobody's cookie, so for the site the
 * only true viewer is `anonymous`, and `readViewer()` returns exactly that.
 * Billing still does not exist anywhere.
 *
 * The standing rule is unchanged — the interface must never simulate what is
 * not there — so nothing here pretends to authenticate anyone.
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
 * Whether **this site** has an account system to talk to.
 *
 * `'absent'` is not a placeholder to be flipped optimistically — it is the
 * assertion that no code path below may collect credentials, imply a session,
 * or report a plan. The accounts in `apps/web` do not change it: flipping it
 * means this site reading a session, which it does not do. Flip it only when
 * that is real.
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
