import { Page, PageHeader, PageMeta } from '@/components/page';
import {
  findOrganization,
  findProject,
  listRunAmbiguities,
  listRunTranslations,
  listRuns,
  requireSession,
} from '@/lib/data/workspace';
import { isGitHubConfigured } from '@/lib/github/config';
import {
  installationIdFor,
  listInstallationRepositories,
} from '@/lib/github/repositories';
import { Badge } from '@localize-infra/ui';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RepositorySection } from './repository-section';
import { ReviewSection } from './review-section';
import { RunsSection } from './runs-section';

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

  /*
   * Repositories come from this workspace's own installation.
   *
   * The list used to be fetched only for an operator, against a shared
   * installation. It is now fetched only when this workspace has installed the
   * App itself — calling GitHub to render a section that will say "not
   * connected" is a network round trip to produce a sentence.
   */
  const gitHubConfigured = isGitHubConfigured();
  const installationId = gitHubConfigured
    ? await installationIdFor(organization.id)
    : null;
  const available = installationId
    ? await listInstallationRepositories(organization.id)
    : [];

  const runs = await listRuns(project.id);

  /*
   * The review gate only has a subject when a run is actually waiting on one.
   *
   * Scoped to the newest such run rather than every one of them: two runs
   * waiting at once would mean two proposals for the same locale files, and
   * answering questions on the older one would commit a diff nobody looked at.
   * The two extra queries are skipped entirely when nothing is waiting.
   */
  const awaiting = runs.find((r) => r.status === 'awaiting_review') ?? null;
  const [ambiguities, proposals] = awaiting
    ? await Promise.all([
        listRunAmbiguities(awaiting.id),
        listRunTranslations(awaiting.id),
      ])
    : [[], []];
  const connected = Boolean(
    project.repository_owner && project.repository_name,
  );
  const runReason = !gitHubConfigured
    ? 'This deployment has no GitHub App configured, so a run has nowhere to open a pull request.'
    : !installationId
      ? 'Install the Localize GitHub App on your account before running.'
      : !connected
        ? 'Connect a repository before running.'
        : null;

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
        hasInstallation={Boolean(installationId)}
        gitHubConfigured={gitHubConfigured}
      />

      {awaiting ? (
        <ReviewSection
          runId={awaiting.id}
          org={org}
          project={project.slug}
          ambiguities={ambiguities}
          proposals={proposals}
        />
      ) : null}

      <RunsSection
        orgSlug={org}
        projectSlug={project.slug}
        canRun={Boolean(installationId) && connected}
        reason={runReason}
        runs={runs.map((run) => ({
          id: run.id,
          status: run.status,
          stage: run.stage,
          framework: run.framework,
          keysExtracted: run.keys_extracted,
          keysTranslated: run.keys_translated,
          localesSucceeded: run.locales_succeeded,
          localesFailed: run.locales_failed,
          error: run.error,
          prUrl: run.pr_url,
          prNumber: run.pr_number,
          createdAt: run.created_at,
          progressAt: run.progress_at,
        }))}
      />
    </Page>
  );
}
