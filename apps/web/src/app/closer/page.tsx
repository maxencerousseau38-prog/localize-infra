import { Page, PageHeader, PageMeta, PageSection } from '@/components/page';
import { loadCloserOverview } from '@/lib/closer/overview';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { STAGE_LABELS, summarisePipeline } from '@localize-infra/closer-core';
import { Badge } from '@localize-infra/ui';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

export const metadata: Metadata = { title: 'Closer' };

/**
 * Closer's overview: what the system holds, and what it cannot do yet.
 *
 * The data model exists and nothing has run through it, so every number below
 * is zero. They are read from the real tables rather than omitted, because a
 * screen that hides its counts until they are interesting is a screen that
 * cannot tell "nothing has happened" from "this is not wired up".
 *
 * Authorisation is the layout's job, not this page's — asking twice would
 * double the query that had to be moved out of the root layout in the first
 * place. But Next renders a layout and its page **concurrently**, so this
 * begins before the layout's gate has resolved: on a build with no database it
 * reached `loadCloserOverview` and threw `SUPABASE_URL is not set`. The 404 was
 * still correct, because the layout's `notFound()` won, and the error was
 * logged from a render nobody would ever see.
 *
 * So the precondition is repeated and the authorisation is not.
 * `isSupabaseConfigured()` reads two environment variables and costs nothing.
 */
export default async function CloserOverviewPage() {
  if (!isSupabaseConfigured()) notFound();

  const overview = await loadCloserOverview();
  const pipeline = summarisePipeline(overview.stages);

  return (
    <Page>
      <PageHeader
        title="Closer"
        purpose="Find companies with a localisation problem, and talk to them."
        meta={
          <>
            <PageMeta label="Companies">{overview.companies}</PageMeta>
            <PageMeta label="In pipeline">{pipeline.activeTotal}</PageMeta>
            <PageMeta label="Customers">{pipeline.won}</PageMeta>
          </>
        }
      />

      {/*
       * Stated once, at the top, rather than left for the reader to infer from
       * a page of zeros. The screens below are real and read real tables; what
       * does not exist is anything that would put a row in them.
       */}
      <div className="mt-6 rounded-lg border border-line bg-surface/40 px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-subtitle font-semibold text-primary">
            The data model exists. Nothing discovers, researches or sends yet.
          </h2>
          <Badge tone="neutral">Phase 2 of 5</Badge>
        </div>
        <p className="mt-2 max-w-[68ch] text-small leading-6 text-secondary">
          Companies, leads, evidence, scores, suppressions and jobs are real
          tables with a funnel the database enforces. The agents that fill them
          are not built. Every count on this page is read from those tables, so
          a zero means nothing has happened rather than that nothing is wired.
        </p>
      </div>

      <PageSection
        title="Pipeline"
        description="Where leads are, including the stages nothing has reached."
      >
        <ul>
          {pipeline.active.map(({ stage, count }) => (
            <li
              key={stage}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-subtle py-2.5 first:border-t-0"
            >
              <span className="font-medium text-primary">
                {STAGE_LABELS[stage].label}
              </span>
              <span className="min-w-0 flex-1 truncate text-caption text-tertiary">
                {STAGE_LABELS[stage].meaning}
              </span>
              <span className="font-mono text-caption tabular-nums text-secondary">
                {count}
              </span>
            </li>
          ))}
        </ul>
      </PageSection>

      <PageSection
        title="Stopped"
        description="Leads that left the funnel, most common first."
      >
        <ul>
          {pipeline.stopped.map(({ stage, count }) => (
            <li
              key={stage}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-subtle py-2.5 first:border-t-0"
            >
              <span className="font-medium text-primary">
                {STAGE_LABELS[stage].label}
              </span>
              <span className="min-w-0 flex-1 truncate text-caption text-tertiary">
                {STAGE_LABELS[stage].meaning}
              </span>
              <span className="font-mono text-caption tabular-nums text-secondary">
                {count}
              </span>
            </li>
          ))}
        </ul>
      </PageSection>

      <PageSection
        title="Work and evidence"
        description="What the system has recorded and what it has queued."
      >
        <dl className="grid gap-px overflow-hidden rounded-lg border border-subtle bg-subtle sm:grid-cols-3">
          {[
            ['Contacts', overview.contacts],
            ['Evidence', overview.evidence],
            ['Model calls', overview.aiExecutions],
            ['Jobs queued', overview.jobs.queued],
            ['Jobs running', overview.jobs.running],
            ['Jobs failed', overview.jobs.failed],
          ].map(([label, value]) => (
            <div key={String(label)} className="bg-canvas px-4 py-3">
              <dt className="text-eyebrow font-medium uppercase text-tertiary">
                {label}
              </dt>
              <dd className="mt-1 font-mono text-subtitle tabular-nums text-primary">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </PageSection>

      {/*
       * Named rather than left absent. An operator who cannot see why nothing
       * is sending will look for a bug; §45 of the brief asks for NOT
       * CONNECTED over a control that pretends.
       */}
      <PageSection
        title="Integrations"
        description="What would have to be connected before a message could leave."
      >
        <dl className="grid gap-px overflow-hidden rounded-lg border border-subtle bg-subtle sm:grid-cols-2">
          <div className="bg-canvas px-4 py-3">
            <dt className="text-eyebrow font-medium uppercase text-tertiary">
              Outbound email
            </dt>
            <dd className="mt-1 flex items-baseline gap-2">
              <Badge tone="neutral">Not connected</Badge>
              <span className="text-small text-secondary">
                No provider and no verified domain.
              </span>
            </dd>
          </div>
          <div className="bg-canvas px-4 py-3">
            <dt className="text-eyebrow font-medium uppercase text-tertiary">
              Inbound replies
            </dt>
            <dd className="mt-1 flex items-baseline gap-2">
              <Badge tone="neutral">Not connected</Badge>
              <span className="text-small text-secondary">
                Replies will be logged by hand until a webhook exists.
              </span>
            </dd>
          </div>
        </dl>
      </PageSection>
    </Page>
  );
}
