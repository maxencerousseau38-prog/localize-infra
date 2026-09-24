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

import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Activation } from './activation';
import { DeletedToast } from './deleted-toast';
import { GitHubConnection } from './github-connection';
import { GitHubResult } from './github-result';
import { NewProject } from './new-project';
import { ProjectList } from './project-list';

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
  // `deleted` is set by `deleteProject`, which redirects here — see
  // deleted-toast.tsx for why the result is announced rather than left implicit.
  searchParams: Promise<{ github?: string; deleted?: string }>;
}) {
  await requireSession();
  const { org } = await params;
  const { github, deleted } = await searchParams;

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

      <DeletedToast slug={deleted} />
      <GitHubResult reason={github} />

      {/*
        The page leads with its subject.
        ────────────────────────────────
        It used to open with the GitHub panel, then two link paragraphs, then an
        activation funnel, and reach the projects fourth — three bordered
        surfaces at one weight before the thing the page is named after. §4.6
        prices vertical density; the cost here was ordering, paid on every visit
        by every reader who already finished setup.

        Setup now sits below the work, and the activation funnel below that.
        Nothing is deleted: every number the page reported, it still reports.
      */}
      {projects.length === 0 ? (
        // Names what is missing and offers exactly one way to create it
        // (DESIGN.md §8).
        <div className="mt-8 rounded-lg border border-line bg-surface/40 px-6 py-12 text-center">
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
        <ProjectList orgSlug={org} projects={projects} />
      )}

      {/*
        One line where there were two paragraphs.
        ─────────────────────────────────────────
        `Working from the command line?` and `Usage —` were separate blocks of
        body copy, each carrying a link and an explanation, stacked between
        panels. §9 charges rent for chrome on every screen forever, and prose is
        the most expensive way to offer a link. Same destinations, same
        conditions, one scannable row.
      */}
      <nav
        aria-label="Workspace"
        className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-subtle pt-4 text-small"
      >
        {funnel.activated ? (
          <Link
            href={`/${org}/tokens`}
            className="text-link underline-offset-4 hover:underline"
          >
            Create a CLI token
          </Link>
        ) : (
          <Link
            href={`/${org}/start`}
            data-testid="start-here"
            className="text-link underline-offset-4 hover:underline"
          >
            Follow the guided path to your first pull request
          </Link>
        )}
        <Link
          href={`/${org}/usage`}
          className="text-link underline-offset-4 hover:underline"
        >
          Usage against the daily ceiling
        </Link>
      </nav>

      <GitHubConnection
        organizationId={organization.id}
        appSlug={appSlug}
        appOrigin={appOrigin}
        connected={installation}
      />

      <Activation funnel={funnel} />
    </Page>
  );
}
