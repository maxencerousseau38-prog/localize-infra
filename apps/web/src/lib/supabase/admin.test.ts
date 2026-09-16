import { afterEach, describe, expect, it } from 'vitest';
import { createAdminClient, readServiceRoleKey } from './admin';

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
