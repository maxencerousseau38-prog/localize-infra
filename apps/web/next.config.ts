import type { NextConfig } from 'next';

/**
 * Security headers.
 *
 * Content-Security-Policy is NOT set here. It is set per request in
 * `src/proxy.ts` with a fresh nonce, because this app will render user
 * data behind authentication and `'unsafe-inline'` is not an acceptable
 * concession on that surface.
 *
 * apps/site takes the opposite trade and documents why: it is a static
 * marketing site with no user input, where a per-request nonce would force
 * dynamic rendering and cost the LCP budget for no real reduction in risk.
 * That reasoning is specific to that app and deliberately does not transfer
 * here — see apps/site/next.config.ts.
 */
const config: NextConfig = {
  reactStrictMode: true,
  // @localize-infra/ui ships source, not a build artifact. A prebuilt dist/
  // consumed across packages caused a real production bug earlier in this repo
  // (a security fix present in source while the running server loaded a stale
  // build). Source-only removes that class of bug.
  transpilePackages: ['@localize-infra/ui'],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
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
