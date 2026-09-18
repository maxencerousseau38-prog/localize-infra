'use server';

import { generateCliToken } from '@/lib/cli-tokens/token';
import { findOrganization, requireSession } from '@/lib/data/workspace';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export interface CreateTokenState {
  error?: string;
  /** The plaintext, returned exactly once and never stored. */
  token?: string;
  name?: string;
}

const LIFETIMES: Record<string, number> = { '30': 30, '90': 90, '365': 365 };

/**
 * Issue a personal CLI token in this workspace.
 *
 * A server action is a public endpoint, so everything is checked here rather
 * than trusted from the form: the workspace is re-read under RLS, the name and
 * lifetime are validated, and `create_cli_token` re-checks membership and its
 * own limits in the database.
 */
export async function createCliToken(
  orgSlug: string,
  _prev: CreateTokenState,
  formData: FormData,
): Promise<CreateTokenState> {
  await requireSession();
  const organization = await findOrganization(orgSlug);
  if (!organization) return { error: 'Workspace not found.' };

  const rawName = formData.get('name');
  const name = typeof rawName === 'string' ? rawName.trim() : '';
  if (name.length < 1 || name.length > 80) {
    return { error: 'Give the token a name between 1 and 80 characters.' };
  }

  const rawDays = formData.get('lifetime');
  const days = typeof rawDays === 'string' ? LIFETIMES[rawDays] : undefined;
  if (!days) return { error: 'Choose how long the token should last.' };

  const issued = generateCliToken();
  const supabase = await createClient();
  const { error } = await supabase.rpc('create_cli_token', {
    p_organization_id: organization.id,
    p_name: name,
    p_token_hash: issued.hash,
    p_token_prefix: issued.prefix,
    p_expires_at: new Date(Date.now() + days * 86_400_000).toISOString(),
  });

  // The database's own sentence — not a member, too many tokens — names the
  // reason better than a summary would (DESIGN.md §8).
  if (error) return { error: error.message };

  revalidatePath(`/${orgSlug}/tokens`);
  // The guided path counts active tokens, so its "Create a CLI token" step is
  // stale the moment one is issued from either surface.
  revalidatePath(`/${orgSlug}/start`);
  return { token: issued.token, name };
}

export interface RevokeTokenState {
  error?: string;
}

/**
 * Revoke one token. `revoke_cli_token` decides who may: the token's creator,
 * or an owner or admin of its workspace.
 */
export async function revokeCliToken(
  orgSlug: string,
  tokenId: string,
  _prev: RevokeTokenState,
  _formData: FormData,
): Promise<RevokeTokenState> {
  await requireSession();
  const supabase = await createClient();
  const { error } = await supabase.rpc('revoke_cli_token', {
    p_token_id: tokenId,
  });
  if (error) return { error: error.message };
  revalidatePath(`/${orgSlug}/tokens`);
  revalidatePath(`/${orgSlug}/start`);
  return {};
}
