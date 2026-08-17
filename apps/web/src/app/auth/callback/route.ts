import { createClient } from '@/lib/supabase/server';
import { type NextRequest, NextResponse } from 'next/server';

/**
 * Email confirmation lands here.
 *
 * Supabase sends a one-time `code`; exchanging it sets the session cookies.
 * A missing or spent code is a normal event — a re-clicked link, an expired
 * invitation — so it redirects to /login with a message rather than erroring.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const next = searchParams.get('next');
  const destination =
    next?.startsWith('/') && !next.startsWith('//') ? next : '/';

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing-code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=expired-link`);
  }

  return NextResponse.redirect(`${origin}${destination}`);
}
