/**
 * The Vercel entry point for apps/api.
 *
 * `src/index.ts` starts a Node server only when it is the invoked module, so
 * importing the built app here gives the configured Hono instance without also
 * binding a port — one module serves `npm run dev` locally and a function in
 * production, with no branch for which one is running.
 *
 * Exported as `fetch`, not as a default export, and that distinction is the
 * whole reason this file works. Vercel's Node runtime reads a default export
 * with the legacy `(req, res) => void` signature and *ignores the return
 * value*. `hono/vercel`'s `handle()` returns a `Response`, so the default-export
 * form accepted every request, discarded the response, wrote nothing, and let
 * the invocation run to the 300-second ceiling. Every route timed out; nothing
 * errored. The runtime log said so in as many words:
 *
 *   WARN: default export returned a `Response`. […] You likely meant the Web
 *   fetch-style API. Fix: export a `fetch` function.
 *
 * Everything that matters about this service is decided at import time by
 * `src/index.ts`: it throws unless `API_AUTH_TOKEN` is set. That fail-closed
 * check is why this deployment is safe to exist — the last time this project
 * was deployed the variable was missing, every route answered 500, and the
 * result was a dead public URL rather than an open translation API.
 */
import { app } from '../dist/index.js';

export const config = { runtime: 'nodejs' };

export function fetch(request: Request): Response | Promise<Response> {
  return app.fetch(request);
}
