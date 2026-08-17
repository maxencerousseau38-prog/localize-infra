import { listOrganizations, requireSession } from '@/lib/data/workspace';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { WorkspaceForm } from './workspace-form';

export const metadata: Metadata = { title: 'Create a workspace' };

/**
 * The first screen after a first sign-in.
 *
 * A workspace owns every repository, project and run, so there is nothing to
 * show until one exists — which is why this is a required step rather than an
 * empty dashboard with a call to action. Anyone who already has one is sent to
 * it: this page is a gate, not a destination.
 */
export default async function OnboardingPage() {
  await requireSession();

  const organizations = await listOrganizations();
  const existing = organizations[0];
  if (existing) redirect(`/${existing.slug}/projects`);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-16">
      <p className="text-eyebrow font-medium uppercase text-tertiary">
        First step
      </p>
      <h1 className="mt-3 font-display text-display font-semibold text-primary">
        Create a workspace
      </h1>
      <p className="mt-3 text-body leading-6 text-secondary">
        A workspace holds your projects and the repositories they point at. Most
        people name it after their company or their team.
      </p>

      <WorkspaceForm />
    </main>
  );
}
