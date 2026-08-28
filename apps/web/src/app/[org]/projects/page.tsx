import { Page, PageHeader, PageMeta } from '@/components/page';
import {
  currentRole,
  findGitHubInstallation,
  findOrganization,
  listProjects,
  requireSession,
} from '@/lib/data/workspace';
import { readGitHubApp } from '@/lib/github/config';
import { loadFunnel } from '@/lib/metrics/load';
import { Badge } from '@localize-infra/ui';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Activation } from './activation';
import { GitHubConnection } from './github-connection';
import { GitHubResult } from './github-result';
import { NewProject } from './new-project';

export const metadata: Metadata = { title: 'Projects' };

/**
 * The first real data surface in this application.
 *
 * Everything on it comes from the database and is scoped by RLS. There is no
 * sample banner because there is no sample data: an empty workspace shows an
 * empty state, not three invented projects.
 */
export default async function ProjectsPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  // The GitHub callback redirects back here with its outcome. Every refusal
  // was previously silent: a rejected install and one that did nothing looked
  // exactly alike.
  searchParams: Promise<{ github?: string }>;
}) {
  await requireSession();
  const { org } = await params;
  const { github } = await searchParams;

  const organization = await findOrganization(org);
  // Not found rather than forbidden: a workspace that exists but is not yours
  // must be indistinguishable from one that does not exist.
  if (!organization) notFound();

  const [projects, role, installation, funnel] = await Promise.all([
    listProjects(organization.id),
    currentRole(organization.id),
    findGitHubInstallation(organization.id),
    /*
     * Derived from rows this workspace already has — no events table is read,
     * because none is written. Four queries in total on this page, all under
     * RLS.
     */
    loadFunnel(organization.id, organization.created_at),
  ]);

  // The slug is public (it is in the install URL), so reading it from the App
  // rather than hardcoding it keeps the two from drifting.
  /*
   * The origin this request arrived on, so the OAuth `redirect_uri` matches the
   * callback GitHub has registered. Taken from the request rather than from a
   * constant: a preview deployment and production do not share an origin, and a
   * hardcoded one would send every preview's callback to production.
   */
  const headerList = await headers();
  const host = headerList.get('x-forwarded-host') ?? headerList.get('host');
  const proto = headerList.get('x-forwarded-proto') ?? 'https';
  const appOrigin = host ? `${proto}://${host}` : '';

  const appSlug = readGitHubApp()
    ? (process.env.GITHUB_APP_SLUG ?? null)
    : null;

  return (
    <Page>
      <PageHeader
        title={organization.name}
        purpose="Each project points at one repository and the locales it ships."
        meta={
          <>
            <PageMeta label="Projects">{projects.length}</PageMeta>
            <PageMeta label="Your role">{role ?? 'unknown'}</PageMeta>
          </>
        }
        action={<NewProject orgSlug={org} />}
      />

      <GitHubResult reason={github} />

      <GitHubConnection
        organizationId={organization.id}
        appSlug={appSlug}
        appOrigin={appOrigin}
        connected={installation}
      />

      <Activation funnel={funnel} />

      {projects.length === 0 ? (
        // Names what is missing and offers exactly one way to create it
        // (DESIGN.md §8).
        <div className="mt-6 rounded-lg border border-line bg-surface/40 px-6 py-12 text-center">
          <p className="text-subtitle font-semibold text-primary">
            No projects yet
          </p>
          <p className="mx-auto mt-2 max-w-[46ch] text-small leading-6 text-secondary">
            A project is one repository and the locales it ships. Create one to
            connect a repository and run your first extraction.
          </p>
          <div className="mt-6 flex justify-center">
            <NewProject orgSlug={org} />
          </div>
        </div>
      ) : (
        <ul className="mt-6 border-t border-subtle">
          {projects.map((project) => (
            <li key={project.id} className="border-b border-subtle">
              <Link
                href={`/${org}/projects/${project.slug}`}
                className="flex items-baseline gap-4 px-1 py-3.5 transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-body font-medium text-primary">
                    {project.name}
                  </span>
                  <span className="mt-0.5 block font-mono text-caption text-tertiary">
                    {project.slug}
                  </span>
                </span>
                <span className="shrink-0">
                  <Badge tone="neutral">{project.source_locale}</Badge>
                </span>
                <span className="hidden shrink-0 font-mono text-micro text-tertiary sm:inline">
                  {project.target_locales.length} target
                  {project.target_locales.length === 1 ? '' : 's'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
