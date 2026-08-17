import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { readGitHubConfig } from './config';

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
  const config = readGitHubConfig();
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
 * Exchanges the OAuth code and confirms the caller can reach the installation.
 *
 * `GET /user/installations` is the check that matters: it answers, as the user,
 * which installations they have access to. An id that is not in that list was
 * not theirs to connect, whatever the query string said.
 */
export async function verifyInstallationOwnership(
  code: string,
  installationId: number,
): Promise<VerifiedInstallation | null> {
  const oauth = readOAuthConfig();
  if (!oauth) return null;

  const tokenResponse = await fetch(
    'https://github.com/login/oauth/access_token',
    {
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
    },
  );

  if (!tokenResponse.ok) return null;
  const token = (await tokenResponse.json()) as { access_token?: string };
  if (!token.access_token) return null;

  const installationsResponse = await fetch(
    'https://api.github.com/user/installations',
    {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token.access_token}`,
      },
    },
  );

  if (!installationsResponse.ok) return null;
  const body = (await installationsResponse.json()) as {
    installations?: {
      id: number;
      account?: { login?: string; type?: string } | null;
    }[];
  };

  const match = body.installations?.find(
    (installation) => installation.id === installationId,
  );
  if (!match?.account?.login) return null;

  const accountType =
    match.account.type === 'Organization' ? 'Organization' : 'User';
  return {
    installationId: match.id,
    accountLogin: match.account.login,
    accountType,
  };
}
