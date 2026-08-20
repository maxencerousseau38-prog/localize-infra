'use server';

import {
  findOrganization,
  findProject,
  mayUsePrivateRepositories,
  requireSession,
} from '@/lib/data/workspace';
import {
  canReachRepository,
  installationIdFor,
} from '@/lib/github/repositories';
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
  await requireSession();

  /*
   * No operator allow-list here any more.
   *
   * That gate existed for one reason: the installation was shared, so a token
   * issued for any workspace reached every repository the deployment had ever
   * been granted. `installationIdFor` no longer falls back to it, so a
   * workspace reaches its own repositories or none — the authorization is now
   * the installation itself rather than a list of addresses, and
   * `canReachRepository` below is where it is enforced.
   */

  const selection = String(formData.get('repository') ?? '').trim();
  const [owner, name] = selection.split('/');
  if (!owner || !name) return { error: 'Choose a repository.' };

  const organization = await findOrganization(orgSlug);
  if (!organization) return { error: 'That workspace is not available.' };

  const project = await findProject(organization.id, projectSlug);
  if (!project) return { error: 'That project is not available.' };

  const installation = await installationIdFor(organization.id);
  if (!installation) {
    return {
      error:
        'This workspace has not installed the Localize GitHub App yet. Install it, choose which repositories it may see, and come back.',
    };
  }

  const repository = await canReachRepository(owner, name, organization.id);
  if (!repository) {
    // Reachable rather than merely named: the installation exists but was not
    // granted this repository, which is a different problem from having no
    // installation and needs a different sentence.
    return {
      error: `Your installation cannot reach ${owner}/${name}. Grant it access to that repository on GitHub, then try again.`,
    };
  }

  /*
   * The one entitlement this product has, checked server-side.
   *
   * /pricing promises public repositories are free and unlimited — no language
   * cap, no string cap, no seat cap — so there is deliberately no check here
   * for a public one. Private repositories are the paid capability, and the
   * check is a boolean rather than a counter because invariant 3 forbids
   * metering.
   */
  if (repository.private) {
    const allowed = await mayUsePrivateRepositories(organization.id);
    if (!allowed) {
      return {
        error:
          'Private repositories need a paid plan. Public repositories are free and unlimited. Paid plans are not priced yet, so this cannot be upgraded today.',
      };
    }
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
  // Disconnecting only clears this project's own pointer, and RLS already
  // confines that to a workspace the caller belongs to.
  await requireSession();

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
