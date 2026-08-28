import { requireSession } from '@/lib/data/workspace';
import {
  exchangeCode,
  listUserInstallations,
  readOAuthConfig,
  verifyInstallationOwnership,
  verifyState,
} from '@/lib/github/install';
import { createClient } from '@/lib/supabase/server';
import { type NextRequest, NextResponse } from 'next/server';

/**
 * Where GitHub sends the customer after they authorize the App.
 *
 * Everything in the query string is untrusted. The installation this flow binds
 * is the credential it exists to establish, so it is never taken from the URL
 * as a fact — it is either confirmed against the user's own token, or
 * discovered from it.
 *
 * **`installation_id` is optional now, and that is the fix.** This route used
 * to refuse without one, which meant the only way in was a *fresh install*:
 * GitHub attaches `installation_id` when an install has just happened, and not
 * otherwise. For an account that already had the App, `installations/new`
 * redirected to the existing installation's settings page and this route was
 * never reached at all. The owner hit exactly that.
 *
 * Two shapes arrive here, and both are handled:
 *
 *   - **authorize** — `?code&state`. The ordinary path. Which installation to
 *     link is discovered by asking GitHub what this user can reach.
 *   - **install** — `?code&state&installation_id`. GitHub just created one, so
 *     the id is pinned rather than guessed among several.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;

  // A session is required before anything else: the callback writes a row
  // against a workspace, and there is no such thing as an anonymous workspace.
  await requireSession();

  const fail = (reason: string, org?: string) =>
    NextResponse.redirect(
      `${origin}/${org ?? ''}${org ? '/projects' : ''}?github=${reason}`,
    );

  const organizationId = verifyState(searchParams.get('state'));
  if (!organizationId) {
    // Covers a forged state, a tampered one, and one older than ten minutes.
    return fail('invalid-state');
  }

  const code = searchParams.get('code');
  if (!code) {
    /*
     * Reached when the user declined on GitHub's authorization screen, or when
     * the App is misconfigured. `oauth-not-configured` is still distinguished
     * because it is the one a deployment can fix.
     */
    return fail(readOAuthConfig() ? 'declined' : 'oauth-not-configured');
  }

  const rawInstallationId = searchParams.get('installation_id');

  /*
   * The pinned case: an install just happened and GitHub named it. Checking the
   * id against the user's own installations is stricter than discovery, so it
   * is kept for the case that can supply one.
   */
  if (rawInstallationId !== null) {
    const installationId = Number(rawInstallationId);
    if (!Number.isSafeInteger(installationId) || installationId <= 0) {
      return fail('missing-installation');
    }

    const verified = await verifyInstallationOwnership(code, installationId);
    if (!verified) {
      // The id was not among the installations this user can reach — which is
      // exactly what an attempt to bind somebody else's installation looks like.
      return fail('not-your-installation');
    }
    return link(request, organizationId, verified);
  }

  const token = await exchangeCode(code);
  if (!token) return fail('exchange-failed');

  const installations = await listUserInstallations(token);

  if (installations.length === 0) {
    /*
     * Authorized, but the App is not installed anywhere they can reach. This is
     * the one case that genuinely needs `installations/new`, and it is now
     * reached deliberately rather than by pointing every customer at it.
     */
    return fail('no-installation');
  }

  const only = installations[0];
  if (installations.length > 1 || !only) {
    /*
     * More than one account has the App. Picking the first would bind a
     * workspace to whichever account GitHub happened to list first, which is a
     * decision belonging to the person, not to an array index. Refused, with a
     * reason the panel explains, rather than guessed.
     */
    return fail('choose-installation');
  }

  return link(request, organizationId, only);
}

/** Writes the link and sends the customer back to their workspace. */
async function link(
  request: NextRequest,
  organizationId: string,
  verified: {
    installationId: number;
    accountLogin: string;
    accountType: 'User' | 'Organization';
  },
) {
  const { origin } = request.nextUrl;
  const supabase = await createClient();

  const { error } = await supabase.rpc('link_github_installation', {
    p_organization_id: organizationId,
    p_installation_id: verified.installationId,
    p_account_login: verified.accountLogin,
    p_account_type: verified.accountType,
  });

  if (error) {
    return NextResponse.redirect(`${origin}/?github=link-failed`);
  }

  // Redirect by slug rather than id: the id is not a URL the customer has ever
  // seen, and looking it up confirms they can still read the workspace.
  const { data: organization } = await supabase
    .from('organizations')
    .select('slug')
    .eq('id', organizationId)
    .maybeSingle();

  if (!organization)
    return NextResponse.redirect(`${origin}/?github=link-failed`);
  return NextResponse.redirect(
    `${origin}/${organization.slug}/projects?github=connected`,
  );
}

export const dynamic = 'force-dynamic';
