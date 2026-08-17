import { Page, PageHeader, PageMeta } from '@/components/page';
import {
  findOrganization,
  findProject,
  requireSession,
} from '@/lib/data/workspace';
import { Badge } from '@localize-infra/ui';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

export const metadata: Metadata = { title: 'Project' };

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ org: string; project: string }>;
}) {
  await requireSession();
  const { org, project: projectSlug } = await params;

  const organization = await findOrganization(org);
  if (!organization) notFound();

  const project = await findProject(organization.id, projectSlug);
  if (!project) notFound();

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

      {/*
       * The honest boundary. Everything above this line is real, persisted and
       * scoped to the caller; everything below it needs the GitHub App, which
       * does not exist yet — so the page says so rather than showing a
       * "Connect repository" button that cannot work.
       *
       * This is the sample-data contract applied to a capability rather than to
       * rows: a control that appears operational and is not is worse than an
       * empty section (DESIGN.md §11).
       */}
      <section
        aria-labelledby="repository"
        className="mt-8 rounded-lg border border-line bg-surface/40 px-5 py-6"
      >
        <h2
          id="repository"
          className="text-subtitle font-semibold text-primary"
        >
          Repository
        </h2>
        <p className="mt-2 max-w-[64ch] text-small leading-6 text-secondary">
          Connecting a repository needs the GitHub App, which has not been
          created yet. Until it exists there is no way to authorise access to
          your code, so this project cannot extract or open a pull request from
          this surface. The CLI still works against a local clone.
        </p>
      </section>
    </Page>
  );
}
