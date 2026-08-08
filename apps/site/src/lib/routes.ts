/**
 * Every public route, in one place.
 *
 * The sitemap is generated from this list rather than maintained beside it, so
 * a new page cannot be added to the navigation and quietly left out of the
 * sitemap — which is the usual way sitemaps rot.
 */
export const PUBLIC_ROUTES = [
  { path: '/', priority: 1 },
  { path: '/docs', priority: 0.9 },
  { path: '/benchmarks', priority: 0.8 },
  { path: '/quality', priority: 0.8 },
  { path: '/security', priority: 0.7 },
  { path: '/pricing', priority: 0.7 },
  { path: '/roadmap', priority: 0.5 },
] as const;

export const SITE_URL = 'https://localize-infra.dev';
