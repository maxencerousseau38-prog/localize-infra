'use server';

import { toSlug } from '@/lib/data/workspace';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export interface WorkspaceState {
  error?: string;
}

export async function createWorkspace(
  _prev: WorkspaceState,
  formData: FormData,
): Promise<WorkspaceState> {
  const name = String(formData.get('name') ?? '').trim();
  if (!name) return { error: 'Give the workspace a name.' };
  if (name.length > 80) return { error: 'Keep the name under 80 characters.' };

  const slug = toSlug(name);
  if (!slug) {
    return {
      error:
        'That name has no letters or digits to build a URL from. Add some.',
    };
  }

  const supabase = await createClient();

  // The RPC, not an INSERT. A bare `insert ... select` is denied here: the
  // SELECT policy is evaluated against the returned row and the creator is not
  // a member until the AFTER INSERT trigger has run. See
  // supabase/migrations/…create_organization_rpc.sql.
  const { data, error } = await supabase.rpc('create_organization', {
    p_name: name,
    p_slug: slug,
  });

  if (error) {
    // 23505 is unique_violation: the slug is global, so it can collide with a
    // workspace the caller cannot see. Say what to do, not what went wrong.
    if (error.code === '23505') {
      return {
        error: `The address "${slug}" is taken. Try a different name.`,
      };
    }
    return { error: `Could not create the workspace: ${error.message}` };
  }

  revalidatePath('/', 'layout');
  redirect(`/${data.slug}/projects`);
}
