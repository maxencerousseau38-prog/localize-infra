import { readVersion } from '@/lib/version/version';
import { NextResponse } from 'next/server';

/**
 * Which commit this deployment is serving.
 *
 * Public on purpose, and the reason is that an authenticated answer would not
 * answer the question. The point is to check a deployment from outside — from
 * a terminal, from CI, while signed out — the way `apps/site` can already be
 * checked by comparing its public deployment URL to its alias. Requiring a
 * session would mean the one surface that can confirm what is live is itself
 * only reachable once you trust that it is live.
 *
 * The repository is public, so the commit sha discloses nothing: it names a
 * commit anyone can already read. No environment variable, no build path and
 * no dependency version is exposed here — only what `git log` shows.
 */
export const dynamic = 'force-dynamic';

export function GET() {
  // `no-store` rather than a max-age: the value is constant for the life of a
  // deployment, so any cache would be correct right up until the moment the
  // answer matters, which is immediately after a new deployment.
  return NextResponse.json(readVersion(), {
    headers: { 'cache-control': 'no-store' },
  });
}
