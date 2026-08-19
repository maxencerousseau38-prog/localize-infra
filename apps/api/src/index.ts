import { readFileSync } from 'node:fs';
import { serve } from '@hono/node-server';
import {
  createGitHubAppClient,
  openTranslationPr,
} from '@localize-infra/github-app';
import { Hono } from 'hono';
import { createAuthMiddleware } from './auth.js';
import {
  type GitHubAppOperations,
  openPrRouteHandler,
} from './open-pr/route.js';
import { getConfiguredProviders } from './router/index.js';
import { translateRouteHandler } from './translate/route.js';

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
export function readGitHubAppConfig(): {
  appId: string;
  privateKey: string;
  installationId: number;
} | null {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = readPrivateKey();
  const installationId = process.env.GITHUB_APP_INSTALLATION_ID;
  if (!appId || !privateKey || !installationId) return null;
  const parsedInstallationId = Number(installationId);
  // A non-numeric GITHUB_APP_INSTALLATION_ID (e.g. a typo, or an accidentally
  // pasted URL fragment) makes `installationId` truthy as a STRING, so the
  // check above alone wouldn't catch it. Number(...) on such a value produces
  // NaN, which would otherwise flow all the way to getInstallationOctokit(NaN)
  // and fail there with a confusing, indirect error. Treat it the same as a
  // missing env var: fail closed with the same 501 "not configured" response.
  if (Number.isNaN(parsedInstallationId)) return null;
  return { appId, privateKey, installationId: parsedInstallationId };
}

// The only place in apps/api that touches the real @localize-infra/github-app
// implementation — route.ts itself only sees the GitHubAppOperations interface.
const githubAppOperations: GitHubAppOperations = {
  createClient: createGitHubAppClient,
  openPr: openTranslationPr,
};

export const app = new Hono();

// Applies to /v1/translate and /v1/open-pr but not /health: health checks
// are conventionally public and carry no sensitive capability.
app.use('/v1/*', createAuthMiddleware(API_AUTH_TOKEN));

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

app.post('/v1/open-pr', async (c) => {
  const body = await c.req.json().catch(() => null);
  const { status, body: responseBody } = await openPrRouteHandler(
    body,
    readGitHubAppConfig(),
    githubAppOperations,
  );
  return c.json(
    responseBody as Record<string, unknown>,
    status as 200 | 400 | 501 | 502,
  );
});

app.get('/health', (c) => c.json({ ok: true }));

const invokedPath = process.argv[1]?.replace(/\\/g, '/');
const modulePath = new URL(import.meta.url).pathname.replace(
  /^\/([A-Za-z]:)/,
  '$1',
);
if (invokedPath === modulePath) {
  serve({ fetch: app.fetch, port: PORT });
  console.log(`apps/api listening on http://localhost:${PORT}`);
}
