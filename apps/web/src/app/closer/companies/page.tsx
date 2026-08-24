import { Page, PageHeader, PageMeta, PageSection } from '@/components/page';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { createClient } from '@/lib/supabase/server';
import { type CloserStage, STAGE_LABELS } from '@localize-infra/closer-core';
import { Badge, EmptyState } from '@localize-infra/ui';
import { Building2, ExternalLink } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DiscoverForm } from './discover-form';
import { ResearchButton } from './research-button';

export const metadata: Metadata = { title: 'Companies · Closer' };

interface CompanyRow {
  id: string;
  name: string;
  domain: string | null;
  repository: string | null;
  discovered_url: string | null;
  locales: string[];
  created_at: string;
  closer_leads: { stage: CloserStage }[];
  closer_evidence: { label: string; summary: string; kind: string }[];
  closer_scores: { kind: string; value: number; confidence: number }[];
}

/**
 * Every company discovery has recorded, with the evidence that got it here.
 *
 * The evidence is shown on the row rather than behind a click, because a list
 * of company names with scores beside them is the shape this system is
 * specified not to be. What justifies a row is the point of the row.
 *
 * Authorisation belongs to the layout above; this repeats only the cheap
 * environment precondition, because Next renders a layout and its page
 * concurrently and this would otherwise begin querying a database that is not
 * configured.
 */
export default async function CloserCompaniesPage() {
  if (!isSupabaseConfigured()) notFound();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('closer_companies')
    .select(
      'id,name,domain,repository,discovered_url,locales,created_at,closer_leads(stage),closer_evidence(label,summary,kind),closer_scores(kind,value,confidence)',
    )
    .order('created_at', { ascending: false })
    .limit(100);

  const companies = (data ?? []) as unknown as CompanyRow[];

  return (
    <Page>
      <PageHeader
        title="Companies"
        purpose="Public repositories that show real signs of localisation."
        meta={<PageMeta label="Recorded">{companies.length}</PageMeta>}
      />

      <PageSection
        title="Discover"
        description="Search GitHub, then read each repository before recording it."
      >
        <DiscoverForm />
      </PageSection>

      <PageSection
        title="Recorded"
        description="Newest first, with the evidence that qualified each one."
      >
        {error ? (
          <p className="text-small text-secondary">
            Could not read companies: {error.message}
          </p>
        ) : companies.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="Nothing discovered yet"
            description="Run a discovery above. Nothing is recorded until its repository has been read and found to carry real localisation."
          />
        ) : (
          <ul className="space-y-3">
            {companies.map((company) => {
              const stage = company.closer_leads[0]?.stage;
              return (
                <li
                  key={company.id}
                  className="rounded-lg border border-subtle px-4 py-3"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <span className="font-medium text-primary">
                      {company.name}
                      {company.domain ? (
                        <span className="ms-2 font-mono text-caption text-tertiary">
                          {company.domain}
                        </span>
                      ) : null}
                    </span>
                    <span className="flex flex-wrap items-center gap-2">
                      {/* Scores beside the stage, newest of each kind. A score
                          without its evidence below it would be the thing this
                          system is specified not to produce; both are here. */}
                      {['icp', 'pain'].map((kind) => {
                        const score = company.closer_scores.find(
                          (s) => s.kind === kind,
                        );
                        if (!score) return null;
                        return (
                          <span
                            key={kind}
                            className="font-mono text-caption text-secondary"
                          >
                            {kind === 'icp' ? 'fit' : 'pain'} {score.value}
                            <span className="text-tertiary">
                              {' '}
                              ({Math.round(score.confidence * 100)}%)
                            </span>
                          </span>
                        );
                      })}
                      {stage ? (
                        <Badge tone="neutral">
                          {STAGE_LABELS[stage].label}
                        </Badge>
                      ) : null}
                    </span>
                  </div>

                  {company.discovered_url ? (
                    <a
                      href={company.discovered_url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="mt-1 inline-flex items-center gap-1 font-mono text-caption text-secondary underline-offset-2 hover:underline"
                    >
                      {company.repository}
                      <ExternalLink className="size-3" aria-hidden="true" />
                    </a>
                  ) : null}

                  {company.locales.length > 0 ? (
                    <p className="mt-1 text-caption text-tertiary">
                      {company.locales.length} locale(s):{' '}
                      <span className="font-mono">
                        {company.locales.join(', ')}
                      </span>
                    </p>
                  ) : null}

                  {/* The evidence, on the row. A score without its reasons is
                      what this system is specified not to produce. */}
                  {company.closer_evidence.length > 0 ? (
                    <ul className="mt-2 space-y-0.5">
                      {company.closer_evidence.map((item) => (
                        <li
                          key={`${company.id}:${item.label}`}
                          className="text-caption text-secondary"
                        >
                          <span className="font-mono text-tertiary">
                            {item.label}
                          </span>{' '}
                          — {item.summary}
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {company.repository ? (
                    <ResearchButton companyId={company.id} />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </PageSection>
    </Page>
  );
}
