import { requireSession } from '@/lib/data/workspace';
import {
  readOAuthConfig,
  verifyInstallationOwnership,
  verifyState,
} from '@/lib/github/install';
import { createClient } from '@/lib/supabase/server';
import { type NextRequest, NextResponse } from 'next/server';

/**
 * Where GitHub sends the customer after they install the App.
 *
 * Everything in the query string is untrusted. The installation id in
 * particular is the credential this whole flow exists to establish, and it
 * arrives as text anyone can type — so it is treated as a claim to be checked,
 * never as a fact to be stored.
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

  const installationId = Number(searchParams.get('installation_id'));
  if (!Number.isSafeInteger(installationId) || installationId <= 0) {
    return fail('missing-installation');
  }

  const code = searchParams.get('code');
  if (!code) {
    // GitHub only sends `code` when the App requests user authorization during
    // installation. Without it ownership cannot be established, and this
    // refuses rather than trusting the id.
    return fail(readOAuthConfig() ? 'missing-code' : 'oauth-not-configured');
  }

  const verified = await verifyInstallationOwnership(code, installationId);
  if (!verified) {
    // The id was not among the installations this user can reach — which is
    // exactly what an attempt to bind somebody else's installation looks like.
    return fail('not-your-installation');
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('link_github_installation', {
    p_organization_id: organizationId,
    p_installation_id: verified.installationId,
    p_account_login: verified.accountLogin,
    p_account_type: verified.accountType,
  });

  if (error) return fail('link-failed');

  // Redirect by slug rather than id: the id is not a URL the customer has ever
  // seen, and looking it up confirms they can still read the workspace.
  const { data: organization } = await supabase
    .from('organizations')
    .select('slug')
    .eq('id', organizationId)
    .maybeSingle();

  if (!organization) return fail('link-failed');
  return NextResponse.redirect(
    `${origin}/${organization.slug}/projects?github=connected`,
  );
}

export const dynamic = 'force-dynamic';
