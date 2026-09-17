import { readFileSync } from 'node:fs';
import { serve } from '@hono/node-server';
import {
  checkRepositoryAccess,
  createGitHubAppClient,
  openTranslationPr,
} from '@localize-infra/github-app';
import { Hono } from 'hono';
import { createCallerMiddleware } from './auth.js';
import {
  type Caller,
  createPostgrestResolver,
  readTokenResolverConfig,
} from './callers.js';
import {
  type GitHubAppOperations,
  openPrRouteHandler,
  preflightRouteHandler,
} from './open-pr/route.js';
import { getConfiguredProviders } from './router/index.js';
import { translateRouteHandler } from './translate/route.js';
import { readVersion } from './version.js';

const ANTHROPIC_MODEL = process.env.API_ANTHROPIC_MODEL ?? 'claude-sonnet-5';
const OPENAI_MODEL = process.env.API_OPENAI_MODEL ?? 'gpt-4o';
const PORT = Number(process.env.PORT ?? 8787);

// Fail closed: refuse to start rather than silently run every /v1/* route
// unauthenticated. Mirrors router/index.ts's getProvider(), which throws
// clearly rather than proceeding when an API key is missing.
const API_AUTH_TOKEN = process.env.API_AUTH_TOKEN;
if (!API_AUTH_TOKEN) {
  throw new Error('API_AUTH_TOKEN is not set');
}

// Standard GitHub App config: the private key can be supplied either as the
// raw PEM content directly (GITHUB_APP_PRIVATE_KEY) or, more commonly in
// practice since GitHub's App-creation flow downloads a .pem file rather
// than a copy-pasteable string, as a path to that file
// (GITHUB_APP_PRIVATE_KEY_PATH). If both are set, the inline value wins.
// Returns null (not a thrown error) on any read failure, matching this
// function's existing "treat any config problem as not-configured, respond
// 501" contract — a malformed path shouldn't crash the server any more than
// a missing env var should.
function readPrivateKey(): string | null {
  const inline = process.env.GITHUB_APP_PRIVATE_KEY;
  if (inline) return inline;
  const path = process.env.GITHUB_APP_PRIVATE_KEY_PATH;
  if (!path) return null;
  try {
    return readFileSync(path, 'utf-8');
  } catch {
    return null;
  }
}

// Exported for direct unit testing (see index.test.ts), in addition to being
// reachable indirectly through the /v1/open-pr route.
//
// This was one function, `readGitHubAppConfig`, returning the credentials and
// the installation id together and returning null unless all three were set.
// Fusing them is what forced every caller of /v1/open-pr through the same
// installation: a request had no way to name its own, so a multi-tenant caller
// could resolve an installation per workspace for reads and had nowhere to put
// it for writes.
//
// Split, `GITHUB_APP_INSTALLATION_ID` becomes what it should always have been
// on a service that serves more than one tenant: a default for deployments that
// have exactly one installation, not the only installation there is.
export function readGitHubAppCredentials(): {
  appId: string;
  privateKey: string;
} | null {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = readPrivateKey();
  if (!appId || !privateKey) return null;
  return { appId, privateKey };
}

export function readDefaultInstallationId(): number | null {
  const installationId = process.env.GITHUB_APP_INSTALLATION_ID;
  if (!installationId) return null;
  const parsed = Number(installationId);
  // A non-numeric GITHUB_APP_INSTALLATION_ID (e.g. a typo, or an accidentally
  // pasted URL fragment) makes `installationId` truthy as a STRING, so the
  // check above alone wouldn't catch it. Number(...) on such a value produces
  // NaN, which would otherwise flow all the way to getInstallationOctokit(NaN)
  // and fail there with a confusing, indirect error. Treat it the same as a
  // missing env var: no default, so a request that names no installation is
  // refused rather than served with NaN.
  if (Number.isNaN(parsed)) return null;
  return parsed;
}

// The only place in apps/api that touches the real @localize-infra/github-app
// implementation — route.ts itself only sees the GitHubAppOperations interface.
const githubAppOperations: GitHubAppOperations = {
  createClient: createGitHubAppClient,
  openPr: openTranslationPr,
  checkAccess: checkRepositoryAccess,
};

// Personal CLI tokens need the database; without it, only the operator token
// is accepted and personal ones are refused with that reason.
const tokenResolverConfig = readTokenResolverConfig();

export const app = new Hono<{ Variables: { caller: Caller } }>();

// Applies to every /v1/* route but not /health or /api/version: those are
// public and carry no capability.
app.use(
  '/v1/*',
  createCallerMiddleware({
    operatorToken: API_AUTH_TOKEN,
    resolver: tokenResolverConfig
      ? createPostgrestResolver(tokenResolverConfig)
      : null,
  }),
);

/**
 * Who the API thinks is calling. The CLI asks before writing or spending
 * anything, so a bad token costs one sentence and nothing else.
 */
app.get('/v1/whoami', (c) => {
  const caller = c.get('caller');
  if (caller.kind === 'operator') return c.json({ kind: 'operator' });
  return c.json({
    kind: 'workspace',
    workspace: caller.organizationSlug,
    githubConnected: caller.installationId !== null,
  });
});

app.post('/v1/translate', async (c) => {
  const body = await c.req.json().catch(() => null);
  const { status, body: responseBody } = await translateRouteHandler(
    body,
    // Built per request, and only for the providers this process holds a key
    // for. Constructing both eagerly threw `OPENAI_API_KEY is not set` on a
    // deployment configured with Anthropic alone, so every translate call
    // answered 500 in a quarter of a second without reaching any model.
    getConfiguredProviders(),
    { anthropic: ANTHROPIC_MODEL, openai: OPENAI_MODEL },
  );
  return c.json(
    responseBody as Record<string, unknown>,
    status as 200 | 400 | 502 | 503,
  );
});

app.post('/v1/open-pr/preflight', async (c) => {
  const body = await c.req.json().catch(() => null);
  const { status, body: responseBody } = await preflightRouteHandler(
    body,
    {
      app: readGitHubAppCredentials(),
      defaultInstallationId: readDefaultInstallationId(),
    },
    githubAppOperations,
    c.get('caller'),
  );
  return c.json(
    responseBody as Record<string, unknown>,
    status as 200 | 400 | 403 | 404 | 412 | 422 | 501 | 502,
  );
});

app.post('/v1/open-pr', async (c) => {
  const body = await c.req.json().catch(() => null);
  const { status, body: responseBody } = await openPrRouteHandler(
    body,
    {
      app: readGitHubAppCredentials(),
      defaultInstallationId: readDefaultInstallationId(),
    },
    githubAppOperations,
    c.get('caller'),
  );
  return c.json(
    responseBody as Record<string, unknown>,
    status as 200 | 400 | 403 | 404 | 409 | 412 | 422 | 501 | 502,
  );
});

app.get('/health', (c) => c.json({ ok: true }));

/**
 * Which commit this deployment is running.
 *
 * Registered *below* `app.use('/v1/*', …)` with the rest of the public
 * surface. It would be public wherever it sat — the middleware only matches
 * `/v1/*` — but index.test.ts asserts against this file's real wiring
 * precisely because a route added above that line would silently bypass auth,
 * and a public route placed there teaches the next reader the wrong habit.
 *
 * This service needs the endpoint more than `apps/web` did, because it is not
 * connected to Git: merging to `master` deploys the site and the web app, and
 * this one only moves when somebody runs `npx vercel deploy --prod`. The commit
 * on `master` is therefore not evidence about what is deployed here — a gap
 * already observed on 2026-08-23, when PR #33 was merged while the last API
 * production build still dated from the previous day.
 *
 * `no-store` for the same reason as `apps/web`: the value is constant for the
 * life of a deployment, so any cache would be correct right up until the moment
 * the answer matters.
 */
app.get('/api/version', (c) => {
  c.header('cache-control', 'no-store');
  return c.json(readVersion());
});

const invokedPath = process.argv[1]?.replace(/\\/g, '/');
const modulePath = new URL(import.meta.url).pathname.replace(
  /^\/([A-Za-z]:)/,
  '$1',
);
if (invokedPath === modulePath) {
  serve({ fetch: app.fetch, port: PORT });
  console.log(`apps/api listening on http://localhost:${PORT}`);
}
