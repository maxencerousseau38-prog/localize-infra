import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { getProvider } from './router/index.js';
import { translateRouteHandler } from './translate/route.js';

const ANTHROPIC_MODEL = process.env.API_ANTHROPIC_MODEL ?? 'claude-sonnet-5';
const OPENAI_MODEL = process.env.API_OPENAI_MODEL ?? 'gpt-4o';
const PORT = Number(process.env.PORT ?? 8787);

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
