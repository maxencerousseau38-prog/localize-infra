import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { readGitHubApp } from './config';

/**
 * Per-customer installation of the GitHub App.
 *
 * The dangerous part of this flow is not the redirect out, it is the redirect
 * back. GitHub returns `installation_id` in a query string, and a query string
 * is something anyone can type. Storing it because it arrived would let a user
 * bind their workspace to somebody else's installation and then read that
 * account's repositories through it — the whole isolation guarantee, undone by
 * a URL.
 *
 * So two independent things are checked, and both must hold:
 *
 *  1. `state` is an HMAC over the organization id and a timestamp, signed with
 *     a server-held secret. That proves the callback belongs to a flow this
 *     server started, for that workspace, recently. It does not prove anything
 *     about the installation.
 *
 *  2. The user completes GitHub's OAuth step, and we ask GitHub — with the
 *     user's own token — which installations *they* can access. The id in the
 *     query string must be in that list. That is the part that proves
 *     ownership, and there is no way to establish it without asking GitHub as
 *     the user.
 *
 * Without an OAuth client secret the second check cannot run, so the flow is
 * unavailable rather than partially enforced. A half-checked install is worse
 * than none: it looks like a product feature and is an account takeover.
 */

const STATE_TTL_MS = 10 * 60 * 1000;

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
}

export function readOAuthConfig(): OAuthConfig | null {
  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

/**
 * The secret used to sign `state`.
 *
 * Derived from the App private key, which is already required for anything in
 * this module to work and never leaves the server. A dedicated variable would
 * be one more thing to configure and forget; deriving it means the signature is
 * available exactly when the rest of the flow is.
 */
function stateSecret(): string | null {
  const config = readGitHubApp();
  return config ? config.privateKey : null;
}

export function signState(organizationId: string): string | null {
  const secret = stateSecret();
  if (!secret) return null;

  const issued = Date.now().toString();
  const payload = `${organizationId}.${issued}`;
  const signature = createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}.${signature}`;
}

/** Returns the organization id the state was issued for, or null. */
export function verifyState(state: string | null): string | null {
  const secret = stateSecret();
  if (!secret || !state) return null;

  const parts = state.split('.');
  if (parts.length !== 3) return null;
  const [organizationId, issued, signature] = parts as [string, string, string];

  const expected = createHmac('sha256', secret)
    .update(`${organizationId}.${issued}`)
    .digest('hex');

  // Constant-time: a byte-by-byte comparison on a signature leaks how much of a
  // forgery was correct, one request at a time.
  const a = Buffer.from(signature, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const age = Date.now() - Number(issued);
  if (!Number.isFinite(age) || age < 0 || age > STATE_TTL_MS) return null;

  return organizationId;
}

/** Where to send someone to install the App on their own account. */
export function installUrl(appSlug: string, state: string): string {
  const url = new URL(`https://github.com/apps/${appSlug}/installations/new`);
  url.searchParams.set('state', state);
  return url.toString();
}

export interface VerifiedInstallation {
  installationId: number;
  accountLogin: string;
  accountType: 'User' | 'Organization';
}

/**
 * Where "Connect GitHub" sends the customer.
 *
 * **Authorization, not installation.** The button used to point at
 * `installations/new`, which is a different thing wearing the same name: it
 * starts an *install*, and GitHub only attaches an OAuth `code` to the way back
 * if the App happens to have "Request user authorization during installation"
 * switched on — a setting no API can read.
 *
 * Worse, and this is what the owner hit: for an account that **already has the
 * App**, `installations/new` does not run an install at all. GitHub redirects
 * to the existing installation's settings page, the callback is never reached,
 * and nothing happens. Every workspace after the first one on a given account
 * would have died there.
 *
 * Authorizing first works in both cases, because it does not care whether the
 * App is installed. The installation is discovered afterwards, from the user's
 * own token.
 */
export function authorizeUrl(
  clientId: string,
  state: string,
  redirectUri: string,
): string {
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('state', state);
  url.searchParams.set('redirect_uri', redirectUri);
  return url.toString();
}

/**
 * The OAuth code for a user token, or null.
 *
 * Split out of `verifyInstallationOwnership` so the callback can exchange once
 * and then ask what the token can reach, instead of having to name an
 * installation before it has any way of knowing one.
 */
export async function exchangeCode(code: string): Promise<string | null> {
  const oauth = readOAuthConfig();
  if (!oauth) return null;

  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: oauth.clientId,
      client_secret: oauth.clientSecret,
      code,
    }),
  });

  if (!response.ok) return null;
  const body = (await response.json()) as { access_token?: string };
  return body.access_token ?? null;
}

/**
 * Every installation this user can reach, as themselves.
 *
 * This is the check the whole flow rests on. An installation absent from this
 * list was not the caller's to connect, whatever any query string claimed —
 * and now that the callback discovers rather than accepts an id, it is also
 * how the flow learns which installation to link.
 *
 * Installations whose account GitHub does not name are dropped: without a login
 * there is nothing to show a person deciding whether this is the right account.
 */
export async function listUserInstallations(
  token: string,
): Promise<VerifiedInstallation[]> {
  const response = await fetch('https://api.github.com/user/installations', {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) return [];
  const body = (await response.json()) as {
    installations?: {
      id: number;
      account?: { login?: string; type?: string } | null;
    }[];
  };

  return (body.installations ?? [])
    .filter((installation) => Boolean(installation.account?.login))
    .map((installation) => ({
      installationId: installation.id,
      accountLogin: installation.account?.login as string,
      accountType:
        installation.account?.type === 'Organization'
          ? ('Organization' as const)
          : ('User' as const),
    }));
}

/**
 * Confirms the caller can reach a specific installation.
 *
 * Kept, and now built on the two functions above rather than repeating them.
 * Still the right check for the case where GitHub *did* hand back an
 * `installation_id` — a fresh install — because it pins the answer to the id
 * that arrived instead of guessing among several.
 */
export async function verifyInstallationOwnership(
  code: string,
  installationId: number,
): Promise<VerifiedInstallation | null> {
  const token = await exchangeCode(code);
  if (!token) return null;

  const installations = await listUserInstallations(token);
  return (
    installations.find(
      (installation) => installation.installationId === installationId,
    ) ?? null
  );
}

/**
 * Why self-serve installation is switched off, named precisely.
 *
 * The connection panel used to end its explanation with "The CLI still works
 * against a local clone." That was the only exit it offered, and it is not a
 * door: `packages/cli` is not published to npm, so a developer who is not
 * already inside this repository cannot take it. CLAUDE.md records the same
 * dead end from the other direction.
 *
 * A reason lives here rather than in the component so it can be tested. What it
 * returns is the list of environment variables that are actually missing, which
 * is both the honest answer and the only actionable one — every other
 * prerequisite for the flow is present and verified.
 *
 * Empty means the flow is available.
 */
export function installBlockers(): string[] {
  const missing: string[] = [];
  if (!process.env.GITHUB_APP_SLUG) missing.push('GITHUB_APP_SLUG');
  if (!process.env.GITHUB_OAUTH_CLIENT_ID)
    missing.push('GITHUB_OAUTH_CLIENT_ID');
  if (!process.env.GITHUB_OAUTH_CLIENT_SECRET) {
    missing.push('GITHUB_OAUTH_CLIENT_SECRET');
  }
  /*
   * The state signature reuses the App private key rather than carrying a
   * secret of its own, so its absence is the App being unconfigured rather
   * than a separate omission. Named as the key, because that is the variable
   * somebody would have to set.
   */
  if (!readGitHubApp()) missing.push('GITHUB_APP_PRIVATE_KEY');
  return missing;
}
