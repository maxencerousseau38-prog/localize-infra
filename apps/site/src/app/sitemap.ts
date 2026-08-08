import { PUBLIC_ROUTES, SITE_URL } from '@/lib/routes';
import type { MetadataRoute } from 'next';

/**
 * Generated from the route list, never hand-maintained.
 *
 * `lastModified` is deliberately absent: Next would stamp build time, which
 * tells a crawler a page changed every time the site is redeployed even when
 * its content did not. A wrong signal is worse than no signal.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_ROUTES.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    changeFrequency: 'monthly' as const,
    priority: route.priority,
  }));
}
