import { createRequire } from 'node:module';
import { afterEach, describe, expect, it } from 'vitest';
import { createAdminClient, readServiceRoleKey } from './admin';

/*
 * The runtime this client is built in has a WebSocket; plain Node 20 does not.
 *
 * supabase-js constructs its realtime client eagerly and throws "Node.js
 * detected but native WebSocket not found" below Node 22. CI runs Node 20, and
 * this test failed there while passing locally on a newer Node. The app itself
 * is unaffected: Next installs `next/dist/compiled/ws` as the global WebSocket
 * when Node lacks one (next/dist/server/node-environment-baseline.js), which is
 * why `@supabase/ssr` — the same createClient underneath — already works under
 * Node 20 in the e2e job. So the test installs the same thing Next does, rather
 * than the production code growing a transport option only a test needs.
 */
if (typeof globalThis.WebSocket !== 'function') {
  const require = createRequire(import.meta.url);
  globalThis.WebSocket = require('next/dist/compiled/ws').WebSocket;
}

/**
 * The service-role key is the one credential in this app that bypasses RLS,
 * so the two things worth pinning are that its absence is reported rather
 * than guessed at, and that a client is never built without it.
 */
const VARS = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_URL',
  'SUPABASE_PUBLISHABLE_KEY',
] as const;

const saved = new Map<string, string | undefined>();
for (const key of VARS) saved.set(key, process.env[key]);

function env(values: Partial<Record<(typeof VARS)[number], string>>) {
  for (const key of VARS) delete process.env[key];
  for (const [key, value] of Object.entries(values)) process.env[key] = value;
}

afterEach(() => {
  for (const [key, value] of saved) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('readServiceRoleKey', () => {
  it('returns the key when it is set', () => {
    env({ SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_x' });
    expect(readServiceRoleKey()).toBe('sb_secret_x');
  });

  it('treats an absent or blank value as not configured', () => {
    env({});
    expect(readServiceRoleKey()).toBeNull();
    env({ SUPABASE_SERVICE_ROLE_KEY: '   ' });
    expect(readServiceRoleKey()).toBeNull();
  });
});

describe('createAdminClient', () => {
  it('refuses to build a client without the key, by name', () => {
    env({
      SUPABASE_URL: 'http://127.0.0.1:54321',
      SUPABASE_PUBLISHABLE_KEY: 'pk',
    });
    expect(() => createAdminClient()).toThrow(
      'SUPABASE_SERVICE_ROLE_KEY is not set',
    );
  });

  it('builds one when the key and the URL are present', () => {
    env({
      SUPABASE_URL: 'http://127.0.0.1:54321',
      SUPABASE_PUBLISHABLE_KEY: 'pk',
      SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_x',
    });
    expect(typeof createAdminClient().rpc).toBe('function');
  });
});
