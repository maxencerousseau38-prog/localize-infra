import { type NextRequest, NextResponse } from 'next/server';

/**
 * Per-request nonce CSP.
 *
 * Next's App Router emits inline bootstrap scripts whose content varies by
 * route and by build, so they cannot be enumerated as static hashes. The only
 * strict policy that works is a fresh nonce per request: Next reads the nonce
 * out of the CSP header on the incoming request and stamps it onto every script
 * tag it renders.
 *
 * `'strict-dynamic'` is included deliberately and is the reason `'self'` is
 * absent from `script-src`: by specification, `'strict-dynamic'` *invalidates*
 * host-source expressions, so listing `'self'` alongside it is not a safety net
 * — it is dead text that reads like one. Trust flows from the nonced bootstrap
 * to the chunks it loads, which is exactly the graph Next produces.
 *
 * This costs static generation on every route. That is the correct trade for an
 * authenticated surface rendering user data, and the opposite of the trade
 * apps/site makes. Both are documented where they are made.
 */
function contentSecurityPolicy(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'nonce-${nonce}' 'strict-dynamic' https: 'unsafe-inline'`,
    // 'unsafe-inline' and https: above are ignored by any browser that supports
    // nonces or 'strict-dynamic'; they are the specified fallback for older
    // browsers, not a relaxation for current ones.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    'upgrade-insecure-requests',
  ].join('; ');
}

export function proxy(request: NextRequest) {
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const csp = contentSecurityPolicy(nonce);

  // Next reads `x-nonce` to stamp its own script tags, and re-reads the CSP
  // header from the request. Both must be set on the *request* headers.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    // Static assets are served with their own headers and do not execute
    // scripts; running middleware over them would defeat caching for nothing.
    {
      source: '/((?!_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
