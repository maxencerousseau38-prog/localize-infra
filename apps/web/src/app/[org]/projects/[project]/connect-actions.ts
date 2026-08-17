'use server';

import {
  findOrganization,
  findProject,
  requireSession,
} from '@/lib/data/workspace';
import { isOperator } from '@/lib/github/config';
import { canReachRepository } from '@/lib/github/repositories';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export interface ConnectState {
  error?: string;
}

/**
 * Points a project at a repository.
 *
 * Three checks, in this order, all server-side:
 *  1. the caller is an operator — the installation is shared, so this is the
 *     gate that stops one tenant reaching another's repositories;
 *  2. the caller can see the project — RLS does this, via findProject;
 *  3. the installation can actually reach the repository — so a crafted post
 *     cannot record a pointer to something that was never granted.
 *
 * The form only ever offers reachable repositories, but a form is a
 * convenience and not a control.
 */
export async function connectRepository(
  orgSlug: string,
  projectSlug: string,
  _prev: ConnectState,
  formData: FormData,
): Promise<ConnectState> {
  const session = await requireSession();

  if (!isOperator(session.email)) {
    return {
      error:
        'Connecting a repository is limited to this deployment’s operators while the GitHub App installation is shared.',
    };
  }

  const selection = String(formData.get('repository') ?? '').trim();
  const [owner, name] = selection.split('/');
  if (!owner || !name) return { error: 'Choose a repository.' };

  const organization = await findOrganization(orgSlug);
  if (!organization) return { error: 'That workspace is not available.' };

  const project = await findProject(organization.id, projectSlug);
  if (!project) return { error: 'That project is not available.' };

  const repository = await canReachRepository(owner, name, organization.id);
  if (!repository) {
    return {
      error: `The GitHub App installation cannot reach ${owner}/${name}.`,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('projects')
    .update({
      repository_owner: repository.owner,
      repository_name: repository.name,
      repository_branch: repository.defaultBranch,
      repository_connected_at: new Date().toISOString(),
    })
    .eq('id', project.id);

  if (error)
    return { error: `Could not save the connection: ${error.message}` };

  revalidatePath(`/${orgSlug}/projects/${projectSlug}`);
  return {};
}

export async function disconnectRepository(
  orgSlug: string,
  projectSlug: string,
): Promise<void> {
  const session = await requireSession();
  if (!isOperator(session.email)) return;

  const organization = await findOrganization(orgSlug);
  if (!organization) return;
  const project = await findProject(organization.id, projectSlug);
  if (!project) return;

  const supabase = await createClient();
  await supabase
    .from('projects')
    .update({
      repository_owner: null,
      repository_name: null,
      repository_branch: null,
      repository_connected_at: null,
    })
    .eq('id', project.id);

  revalidatePath(`/${orgSlug}/projects/${projectSlug}`);
}
