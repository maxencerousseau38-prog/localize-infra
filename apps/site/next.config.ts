import { createHash } from 'node:crypto';
import type { NextConfig } from 'next';
import { THEME_SCRIPT } from './src/lib/theme-script';

/**
 * The pre-paint theme script is the only inline script on this site. Rather
 * than weakening the CSP with 'unsafe-inline', its SHA-256 is computed from
 * the source at build time and allowlisted explicitly.
 *
 * A nonce would also work but forces dynamic rendering on every route, which
 * costs the static-generation and LCP budget for a marketing site. Hashing a
 * constant keeps the pages static and the policy strict.
 */
const themeScriptHash = `'sha256-${createHash('sha256')
  .update(THEME_SCRIPT)
  .digest('base64')}'`;

const csp = [
  "default-src 'self'",
  // Next injects small inline bootstrap scripts for hydration; 'strict-dynamic'
  // lets our hashed script load them without a blanket 'unsafe-inline'.
  `script-src 'self' ${themeScriptHash} 'strict-dynamic'`,
  // Tailwind and next/font emit inline <style>. Style injection is not a script
  // execution vector, so this is a materially smaller concession than
  // 'unsafe-inline' on script-src would be.
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
