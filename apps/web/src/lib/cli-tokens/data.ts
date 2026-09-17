import 'server-only';
import { createClient } from '@/lib/supabase/server';

/**
 * A token as a signed-in member may see it: everything except the hash, which
 * is not a readable column (migration 20260916000300).
 */
export interface CliTokenRecord {
  id: string;
  name: string;
  token_prefix: string;
  created_by: string | null;
  created_at: string;
  expires_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export type CliTokenState = 'active' | 'expired' | 'revoked';

export function tokenState(
  token: Pick<CliTokenRecord, 'expires_at' | 'revoked_at'>,
  now: Date = new Date(),
): CliTokenState {
  if (token.revoked_at) return 'revoked';
  if (new Date(token.expires_at) <= now) return 'expired';
  return 'active';
}

/** Every token issued in the workspace, newest first, under RLS. */
export async function listCliTokens(
  organizationId: string,
): Promise<CliTokenRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('cli_tokens')
    .select(
      'id,name,token_prefix,created_by,created_at,expires_at,last_used_at,revoked_at',
    )
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Could not load CLI tokens: ${error.message}`);
  return (data as CliTokenRecord[] | null) ?? [];
}
