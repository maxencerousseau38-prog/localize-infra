/**
 * Supabase connection, read once and validated.
 *
 * Deliberately *not* `NEXT_PUBLIC_`. Every Supabase call in this app happens on
 * the server — sign-in and sign-up are Server Actions, session refresh happens
 * in the proxy — so the browser never needs the URL or the key, and shipping
 * them in the client bundle would widen `connect-src` in the CSP for no gain.
 *
 * The publishable key is not a secret (RLS is what protects the data), but it
 * is also not needed client-side here, and the tightest thing that works is the
 * right default.
 */
export interface SupabaseEnv {
  url: string;
  publishableKey: string;
}

export function readSupabaseEnv(): SupabaseEnv {
  const url = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  // Fail loudly and by name. A missing variable that surfaces as "fetch failed"
  // three layers down costs an hour; this costs a line.
  if (!url) throw new Error('SUPABASE_URL is not set');
  if (!publishableKey) throw new Error('SUPABASE_PUBLISHABLE_KEY is not set');

  return { url, publishableKey };
}

/**
 * Whether the app is configured to talk to a database at all.
 *
 * Used by surfaces that must degrade honestly rather than crash: a build with
 * no Supabase configured still renders, and says it is not connected, instead
 * of throwing on import.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY,
  );
}
