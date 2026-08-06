import type { NextConfig } from 'next';

/**
 * Content-Security-Policy.
 *
 * `script-src` carries 'unsafe-inline', which is a deliberate, scoped decision
 * rather than an oversight. Two earlier attempts failed for instructive reasons,
 * both caught by a browser test that asserted the page actually hydrates:
 *
 *  1. `'self' <hash> 'strict-dynamic'` — 'strict-dynamic' *invalidates* host
 *     sources by specification, so every Next.js chunk was blocked and the site
 *     shipped completely non-interactive while still building green and passing
 *     an accessibility audit on the static markup.
 *  2. `'self' <hash>` alone — Next's App Router emits per-page inline bootstrap
 *     scripts (the flight payload). Their content varies per route and per
 *     build, so they cannot be enumerated as hashes in a static header.
 *
 * The correct strict answer is a per-request nonce set in middleware. That
 * forces dynamic rendering on every route, which costs static generation and
 * the LCP budget on the one surface whose entire job is fast first paint.
 *
 * For THIS app the trade is clear: it is a static marketing site with no user
 * input, no authentication, and no user-generated content, so the injection
 * surface 'unsafe-inline' protects against does not meaningfully exist. Every
 * other directive stays strict, and those are the ones carrying real weight
 * here (frame-ancestors, object-src, base-uri, form-action, connect-src).
 *
 * This reasoning does NOT transfer to apps/web. That app will render user data
 * behind authentication, where the trade flips and a nonce-based policy with
 * dynamic rendering is required.
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  // Tailwind and next/font emit inline <style>. Style injection is not a script
  // execution vector, so this is a materially smaller concession.
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

const config: NextConfig = {
  reactStrictMode: true,
  // @localize-infra/ui ships source, not a build artifact. This is deliberate:
  // a prebuilt dist/ consumed across packages caused a real production bug
  // earlier in this repo (a security fix that existed only in source while the
  // running server loaded a stale build). Source-only removes that class of bug.
  transpilePackages: ['@localize-infra/ui'],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
};

export default config;
