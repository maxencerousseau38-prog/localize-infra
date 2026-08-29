'use server';

import { findOrganization, toSlug } from '@/lib/data/workspace';
import { createClient } from '@/lib/supabase/server';
import { InvalidLocales, parseTargetLocales } from '@localize-infra/schemas';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export interface ProjectState {
  error?: string;
}

/**
 * Creating a project.
 *
 * The organization is resolved from its slug and the insert is scoped to the
 * id that comes back. Both steps go through RLS, so a caller who is not a
 * member gets null from the lookup and never reaches the insert — the
 * authorization check is the database's, not a condition written here that a
 * future edit could drop.
 */
export async function createProject(
  orgSlug: string,
  _prev: ProjectState,
  formData: FormData,
): Promise<ProjectState> {
  const name = String(formData.get('name') ?? '').trim();
  const sourceLocale = String(formData.get('source_locale') ?? 'en').trim();

  /*
   * The languages to translate into, settable for the first time.
   *
   * This insert used to omit `target_locales` entirely. The column defaulted to
   * `'{}'`, nothing else in the app ever wrote it, and so every project created
   * through the product had zero target locales — which made every run over one
   * iterate its locale loop zero times and fail with "Every target locale
   * failed. Last error: unknown". Empty is still allowed here, because a
   * project can be created before that decision is made; what is no longer true
   * is that it can never be anything else.
   */
  let targetLocales: string[];
  try {
    targetLocales = parseTargetLocales(
      formData.get('target_locales') as string,
      {
        sourceLocale,
      },
    );
  } catch (error) {
    if (error instanceof InvalidLocales) return { error: error.message };
    throw error;
  }

  if (!name) return { error: 'Give the project a name.' };
  if (name.length > 80) return { error: 'Keep the name under 80 characters.' };

  const slug = toSlug(name);
  if (!slug) {
    return {
      error: 'That name has no letters or digits to build a URL from.',
    };
  }

  if (!/^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/.test(sourceLocale)) {
    return {
      error: `"${sourceLocale}" is not a language tag. Try "en" or "en-GB".`,
    };
  }

  const organization = await findOrganization(orgSlug);
  if (!organization) redirect('/');

  const supabase = await createClient();
  const { error } = await supabase.from('projects').insert({
    organization_id: organization.id,
    name,
    slug,
    source_locale: sourceLocale,
    target_locales: targetLocales,
  });

  if (error) {
    if (error.code === '23505') {
      return {
        error: `This workspace already has a project at "${slug}".`,
      };
    }
    return { error: `Could not create the project: ${error.message}` };
  }

  revalidatePath(`/${orgSlug}/projects`);
  return {};
}

export async function deleteProject(
  orgSlug: string,
  projectId: string,
): Promise<void> {
  const supabase = await createClient();

  // No organization check here on purpose: the delete policy already restricts
  // this to owners and admins of the project's own organization, so a project
  // id from another workspace matches no rows rather than deleting one.
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId);
  if (error) throw new Error(`Could not delete the project: ${error.message}`);

  revalidatePath(`/${orgSlug}/projects`);
}
