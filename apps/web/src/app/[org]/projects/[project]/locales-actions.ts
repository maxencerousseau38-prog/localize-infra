'use server';

import {
  findOrganization,
  findProject,
  requireSession,
} from '@/lib/data/workspace';
import { createClient } from '@/lib/supabase/server';
import { InvalidLocales, parseTargetLocales } from '@localize-infra/schemas';
import { revalidatePath } from 'next/cache';

export interface LocalesState {
  error?: string;
  saved?: boolean;
}

/**
 * Changing which languages a project translates into.
 *
 * There was no way to do this at all. `target_locales` was read in ten places
 * and written in none, so the value every project had was the column default
 * and the only screen that mentioned it said "None configured" with nothing to
 * press. A run over such a project fails before it reaches a model.
 *
 * Authorization is RLS's: `findOrganization` and `findProject` both go through
 * it, so a caller who is not a member gets null from the lookup and never
 * reaches the update. Nothing is re-checked here that the database is not
 * already checking, because a condition written twice is a condition that can
 * disagree with itself.
 */
export async function setTargetLocales(
  orgSlug: string,
  projectSlug: string,
  _previous: LocalesState,
  formData: FormData,
): Promise<LocalesState> {
  await requireSession();

  const organization = await findOrganization(orgSlug);
  if (!organization) return { error: 'That workspace is not available.' };

  const project = await findProject(organization.id, projectSlug);
  if (!project) return { error: 'That project is not available.' };

  let targetLocales: string[];
  try {
    // Parsed against the project's *stored* source locale, not against
    // anything in this form: the two are decided on different screens, and
    // reading the source from the request would let a crafted post smuggle in
    // a target equal to the real source.
    targetLocales = parseTargetLocales(
      formData.get('target_locales') as string,
      { sourceLocale: project.source_locale },
    );
  } catch (error) {
    if (error instanceof InvalidLocales) return { error: error.message };
    throw error;
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('projects')
    .update({ target_locales: targetLocales })
    .eq('id', project.id);

  if (error) return { error: `Could not save the languages: ${error.message}` };

  revalidatePath(`/${orgSlug}/projects/${projectSlug}`);
  return { saved: true };
}
