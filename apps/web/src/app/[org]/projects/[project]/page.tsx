import { Page, PageHeader, PageMeta } from '@/components/page';
import {
  findOrganization,
  findProject,
  requireSession,
} from '@/lib/data/workspace';
import { isGitHubConfigured, isOperator } from '@/lib/github/config';
import { listInstallationRepositories } from '@/lib/github/repositories';
import { Badge } from '@localize-infra/ui';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RepositorySection } from './repository-section';

export const metadata: Metadata = { title: 'Project' };

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ org: string; project: string }>;
}) {
  const session = await requireSession();
  const { org, project: projectSlug } = await params;

  const organization = await findOrganization(org);
  if (!organization) notFound();

  const project = await findProject(organization.id, projectSlug);
  if (!project) notFound();

  // The list is only fetched for an operator on a configured deployment.
  // Calling GitHub to render a section that will say "not available" would be
  // a network round trip to produce a sentence.
  const gitHubConfigured = isGitHubConfigured();
  const operator = isOperator(session.email);
  const available =
    gitHubConfigured && operator ? await listInstallationRepositories() : [];

  return (
    <Page>
      <PageHeader
        title={project.name}
        purpose="What this project points at, and which locales it ships."
        meta={
          <>
            <PageMeta label="Workspace">{organization.name}</PageMeta>
            <PageMeta label="Source">{project.source_locale}</PageMeta>
          </>
        }
      />

      <dl className="mt-6 grid gap-px overflow-hidden rounded-lg border border-subtle bg-subtle sm:grid-cols-2">
        <div className="bg-canvas px-4 py-3">
          <dt className="text-eyebrow font-medium uppercase text-tertiary">
            Address
          </dt>
          <dd className="mt-1 font-mono text-caption text-primary">
            /{org}/projects/{project.slug}
          </dd>
        </div>
        <div className="bg-canvas px-4 py-3">
          <dt className="text-eyebrow font-medium uppercase text-tertiary">
            Target locales
          </dt>
          <dd className="mt-1 flex flex-wrap gap-1.5">
            {project.target_locales.length === 0 ? (
              <span className="text-small text-tertiary">None configured</span>
            ) : (
              project.target_locales.map((locale) => (
                <Badge key={locale} tone="neutral">
                  {locale}
                </Badge>
              ))
            )}
          </dd>
        </div>
      </dl>

      <RepositorySection
        orgSlug={org}
        projectSlug={project.slug}
        connected={
          project.repository_owner && project.repository_name
            ? {
                owner: project.repository_owner,
                name: project.repository_name,
                branch: project.repository_branch,
              }
            : null
        }
        available={available}
        isOperator={operator}
        gitHubConfigured={gitHubConfigured}
      />
    </Page>
  );
}
