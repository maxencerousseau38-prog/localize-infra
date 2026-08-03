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
import { getProvider } from './router/index.js';
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

function readGitHubAppConfig(): {
  appId: string;
  privateKey: string;
  installationId: number;
} | null {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;
  const installationId = process.env.GITHUB_APP_INSTALLATION_ID;
  if (!appId || !privateKey || !installationId) return null;
  return { appId, privateKey, installationId: Number(installationId) };
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
    { anthropic: getProvider('anthropic'), openai: getProvider('openai') },
    { anthropic: ANTHROPIC_MODEL, openai: OPENAI_MODEL },
  );
  return c.json(
    responseBody as Record<string, unknown>,
    status as 200 | 400 | 502,
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
