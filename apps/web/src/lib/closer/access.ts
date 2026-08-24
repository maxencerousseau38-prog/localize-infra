import 'server-only';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { createClient } from '@/lib/supabase/server';

/**
 * Whether the person reading this page has Closer.
 *
 * Closer is the operator's own sales tooling living inside the customer
 * application, so the question "should this exist for you" has to be answered
 * on every render rather than assumed once. One query against
 * `closer_workspaces` answers it: RLS scopes the row to workspaces the caller
 * belongs to, so an anonymous request and a customer's request both come back
 * empty without either learning that the table has other rows.
 *
 * **No `auth.getUser()` here, and that absence is the fix rather than an
 * omission.** The first version called it first, meaning to skip a round trip
 * on anonymous pages. But `getUser()` is itself a network call to Supabase's
 * auth endpoint, and this function runs in the root layout — so every page
 * render made two auth calls instead of one. Across a parallel test suite that
 * was enough to break every seeded page: 26 of 27 timed out waiting for a page
 * that never went idle. The repository had already paid for this once, when
 * signing in per test rate-limited the token endpoint partway through a run.
 *
 * The remaining cost is one PostgREST read per render, including on `/login`.
 * That is a table lookup rather than an auth round trip, and it is the price of
 * a gate that cannot be forgotten.
 */
export async function hasCloser(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('closer_workspaces')
    .select('organization_id')
    .limit(1)
    .maybeSingle();

  // A failure is a false, not a throw. The sidebar renders on every page, and a
  // transient database error should cost the reader a missing section rather
  // than the whole application.
  if (error) return false;
  return data !== null;
}
