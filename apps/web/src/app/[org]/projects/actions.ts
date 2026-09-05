'use server';

import { findOrganization, toSlug } from '@/lib/data/workspace';
import { confirmsDeletion } from '@/lib/projects/deletion';
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

export interface DeleteProjectState {
  error?: string;
}

/**
 * Delete a project, and everything recorded against it.
 *
 * This had no caller anywhere in the application until 2026-09-05 — the
 * function existed, was reachable as a server action, and no screen offered it.
 * Removing a project meant a direct `DELETE` against production, which is what
 * was done once, by hand.
 *
 * **The confirmation is checked here, not only in the form.** A server action is
 * a public endpoint: the input a page renders is a convenience for the person,
 * and anything that decides whether rows are destroyed has to hold when the
 * request does not come from that page.
 *
 * No organization check: the delete policy restricts this to owners and admins
 * of the project's own organization, so a project id from another workspace
 * matches no rows rather than deleting one. The slug is taken from the same
 * request, so it is checked against the project actually being deleted rather
 * than trusted.
 */
export async function deleteProject(
  orgSlug: string,
  projectId: string,
  _prev: DeleteProjectState,
  formData: FormData,
): Promise<DeleteProjectState> {
  const supabase = await createClient();

  // Read back the row being deleted rather than trusting a slug from the form:
  // the confirmation must match *this* project, and a caller that is not the
  // page can send any pair it likes. Under RLS this also answers "may you see
  // it at all", so a project id from another workspace stops here.
  const { data: project } = await supabase
    .from('projects')
    .select('slug')
    .eq('id', projectId)
    .maybeSingle();

  if (!project) return { error: 'That project is not available.' };

  // `FormData.get` returns a File for a file part, and `File` has no `.trim`.
  // Casting it to `string` would turn a hand-made request into a 500 instead of
  // a refusal, on an endpoint anyone can reach.
  const typed = formData.get('confirm');

  if (
    !confirmsDeletion(typeof typed === 'string' ? typed : null, project.slug)
  ) {
    return {
      error: `Type ${project.slug} exactly to confirm. Nothing has been deleted.`,
    };
  }

  /*
   * `select()` on the delete, so the rows that went are the answer.
   *
   * Reading the project above passes under the *select* policy, which admits
   * every member of the workspace; deleting passes under
   * `projects_delete_admin`, which admits owners and admins. A member therefore
   * gets past the confirmation, deletes nothing, and Postgres reports no error
   * — a redirect to the project list would tell them it worked. The count is
   * the only thing that distinguishes "deleted" from "was not allowed to".
   */
  const { data: deleted, error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId)
    .select('id');
  if (error) return { error: `Could not delete the project: ${error.message}` };

  if (!deleted || deleted.length === 0) {
    return {
      error:
        'Only an owner or an admin of this workspace can delete a project. Nothing has been deleted.',
    };
  }

  revalidatePath(`/${orgSlug}/projects`);
  redirect(`/${orgSlug}/projects`);
}
