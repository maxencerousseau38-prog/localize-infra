import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { readSupabaseEnv } from './env';

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 *
 * Sessions live in cookies rather than in memory, which is what makes them
 * survive a reload and work across the server/client boundary. Server
 * Components cannot set cookies, so the write path is allowed to throw and is
 * swallowed: the proxy refreshes the session on every request, so a refresh
 * that cannot be persisted from inside a render is not lost, only deferred.
 */
export async function createClient() {
  const { url, publishableKey } = readSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // The proxy handles refresh; see the note above.
        }
      },
    },
  });
}
