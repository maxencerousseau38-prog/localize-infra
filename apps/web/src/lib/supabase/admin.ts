import 'server-only';
import { type SupabaseClient, createClient } from '@supabase/supabase-js';
import { readSupabaseEnv } from './env';

/**
 * The service-role key, or null.
 *
 * This key bypasses row-level security, so it is used for exactly one write:
 * binding a GitHub installation to a workspace, after the OAuth callback has
 * asked GitHub — with the user's own token — whether that user can reach the
 * installation. The database refuses that write from any signed-in user, because
 * a direct RPC call would skip the question (migration 20260916000200).
 *
 * Present means non-empty, the same rule as every other variable here: an empty
 * value in a Vercel project is a variable somebody meant to fill in.
 */
export function readServiceRoleKey(): string | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return key ? key : null;
}

/**
 * A client that acts as the service role. Server-only, never persisted.
 *
 * Throws by name when the key is absent. Callers are expected to check
 * `readServiceRoleKey()` first and present the missing configuration as a
 * reason; this throw is the backstop for one that did not.
 */
export function createAdminClient(): SupabaseClient {
  const key = readServiceRoleKey();
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  const { url } = readSupabaseEnv();
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
