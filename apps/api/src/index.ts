import { serve } from '@hono/node-server';
import {
  createGitHubAppClient,
  openTranslationPr,
} from '@localize-infra/github-app';
import { Hono } from 'hono';
import {
  type GitHubAppOperations,
  openPrRouteHandler,
} from './open-pr/route.js';
import { getProvider } from './router/index.js';
import { translateRouteHandler } from './translate/route.js';

const ANTHROPIC_MODEL = process.env.API_ANTHROPIC_MODEL ?? 'claude-sonnet-5';
const OPENAI_MODEL = process.env.API_OPENAI_MODEL ?? 'gpt-4o';
const PORT = Number(process.env.PORT ?? 8787);

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
