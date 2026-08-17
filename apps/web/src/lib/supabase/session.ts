import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured, readSupabaseEnv } from './env';

/**
 * Routes a signed-out visitor may reach. Everything else redirects to /login.
 *
 * An allow-list, not a block-list. A block-list means every route added later
 * is public until someone remembers to protect it, and the failure is silent —
 * the page just works, for anyone. This way a new route is protected until
 * someone deliberately opens it.
 */
const PUBLIC_PATHS = ['/login', '/auth/callback'];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/**
 * Refreshes the session and enforces authentication, in that order.
 *
 * This runs in the proxy so that a expiring token is renewed once per request
 * rather than separately in every component that reads it, and so that an
 * unauthenticated request never reaches a page at all.
 *
 * `getUser()` rather than `getSession()`: getSession reads the cookie and
 * trusts it, getUser verifies it against the auth server. On a protected
 * surface the difference is the whole point — a forged cookie satisfies the
 * first and fails the second.
 */
export async function updateSession(
  request: NextRequest,
  response: NextResponse,
): Promise<NextResponse> {
  // No database configured (a preview build, a contributor's checkout): serve
  // the app rather than crashing, and let the pages say they are not connected.
  if (!isSupabaseConfigured()) return response;

  const { url, publishableKey } = readSupabaseEnv();

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublic(request.nextUrl.pathname)) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = '/login';
    // Carry the intended destination so sign-in returns the visitor to where
    // they were going rather than dumping them on a dashboard.
    redirect.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(redirect);
  }

  return response;
}
