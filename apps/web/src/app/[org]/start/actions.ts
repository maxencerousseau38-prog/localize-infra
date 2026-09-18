'use server';

import { findOrganization, requireSession } from '@/lib/data/workspace';
import { checkInstallationHealth } from '@/lib/github/health';
import type { VerifyState } from './verify-state';

/**
 * Ask GitHub whether this workspace's installation still works.
 *
 * A server action is a public endpoint, so the workspace is re-read under RLS
 * here rather than trusted from the argument — a POST naming another
 * workspace's slug must not be able to probe that workspace's GitHub
 * connection. `findOrganization` returns null for a workspace the caller cannot
 * see, which is the same answer as one that does not exist.
 *
 * Read-only: it lists what the installation was granted and creates nothing, so
 * pressing the button repeatedly is safe. It is a button rather than something
 * the page does on render because the answer changes rarely and the question
 * costs a round trip to GitHub on a page people reload.
 */
export async function verifyInstallation(
  orgSlug: string,
  _prev: VerifyState,
  _formData: FormData,
): Promise<VerifyState> {
  await requireSession();
  const organization = await findOrganization(orgSlug);
  if (!organization) {
    return {
      checked: true,
      ok: false,
      problem: 'Workspace not found.',
      detail: null,
    };
  }

  const health = await checkInstallationHealth(organization.id);
  return { checked: true, ...health };
}
