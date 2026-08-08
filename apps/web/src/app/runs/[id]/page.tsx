import { Page, PageHeader, PageMeta, PageSection } from '@/components/page';
import { RunPipeline } from '@/components/run-pipeline';
import { SampleBanner, SampleRegion } from '@/components/sample';
import { SAMPLE_RUN_DETAILS, type SampleLocaleResult } from '@/lib/sample';
import {
  Badge,
  Button,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  type Tone,
  localeDisplayName,
} from '@localize-infra/ui';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  return { title: `Run ${id}` };
}

const RUN_STATE: Record<string, { tone: Tone; label: string }> = {
  succeeded: { tone: 'confident', label: 'Succeeded' },
  partial: { tone: 'degraded', label: 'Partial' },
  failed: { tone: 'failed', label: 'Failed' },
};

const LOCALE_STATE: Record<
  SampleLocaleResult['state'],
  { tone: Tone; label: string }
> = {
  translated: { tone: 'confident', label: 'Translated' },
  escalated: { tone: 'ambiguous', label: 'Needs a decision' },
  failed: { tone: 'failed', label: 'Failed' },
};

function duration(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

export default async function RunDetailPage({ params }: Params) {
  const { id } = await params;
  const run = SAMPLE_RUN_DETAILS[id];

  // An unknown id is a 404, not an empty page pretending the run exists.
  if (!run) notFound();

  const state = RUN_STATE[run.state] ?? RUN_STATE.failed;
  const failed = run.localeResults.filter((l) => l.error);

  return (
    <Page>
      <div className="pt-6">
        <Button asChild variant="ghost" size="sm">
          <Link href="/runs">
            <ArrowLeft aria-hidden="true" />
            All runs
          </Link>
        </Button>
      </div>

      <PageHeader
        title={`Run ${id.replace('run-', '')}`}
        purpose={run.trigger}
        meta={
          <>
            <PageMeta label="Status">{state?.label}</PageMeta>
            <PageMeta label="Duration">{duration(run.durationMs)}</PageMeta>
            <PageMeta label="Strings">{run.strings || '—'}</PageMeta>
            <PageMeta label="Commit">
              <span className="font-mono">{run.commit}</span>
            </PageMeta>
            <PageMeta label="When">{run.when}</PageMeta>
          </>
        }
        action={
          run.prNumber ? (
            <Button variant="primary" size="sm" asChild>
              <a
                href="https://github.com/maxencerousseau38-prog/localize-infra-fixture-vite/pull/1"
                target="_blank"
                rel="noreferrer noopener"
              >
                Pull request #{run.prNumber}
                <ExternalLink aria-hidden="true" />
              </a>
            </Button>
          ) : null
        }
      />

      <div className="mt-6">
        <SampleBanner>
          This run did not happen. Real runs come from the CLI and nothing
          records them yet, so the stages and per-locale results below are
          illustrative.
        </SampleBanner>
      </div>

      <SampleRegion label={`Run ${id}`} className="mt-6">
        {/* The pipeline first: it answers "what happened and where did it
            stop?" before any table asks the reader to compare rows. */}
        <PageSection
          title="Pipeline"
          description="What this run did, in the order it did it."
          className="mt-0"
        >
          <div className="rounded-lg border border-subtle p-5">
            <RunPipeline stages={run.stages} />
          </div>
        </PageSection>

        <PageSection
          title="Locales"
          description="One row per target language, and what it produced."
        >
          <Table>
            <THead>
              <TR>
                <TH>Language</TH>
                <TH>Result</TH>
                <TH numeric>Strings</TH>
                <TH numeric>Escalated</TH>
              </TR>
            </THead>
            <TBody>
              {run.localeResults.map((locale) => {
                const tone = LOCALE_STATE[locale.state];
                return (
                  <TR key={locale.code}>
                    <TD>
                      <span className="font-medium text-primary">
                        {localeDisplayName(locale.code)}
                      </span>{' '}
                      <span className="font-mono text-caption text-tertiary">
                        {locale.code}
                      </span>
                    </TD>
                    <TD>
                      <Badge tone={tone.tone}>{tone.label}</Badge>
                    </TD>
                    <TD numeric>{locale.strings || '—'}</TD>
                    <TD numeric>{locale.escalated || '—'}</TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </PageSection>

        {/* Failures get their own section with the provider message verbatim.
            Paraphrasing it would destroy its only use: being searchable. */}
        {failed.length > 0 ? (
          <PageSection
            title="What failed"
            description="Reported exactly as the provider returned it."
          >
            <ul className="flex flex-col gap-2">
              {failed.map((locale) => (
                <li
                  key={locale.code}
                  className="rounded-lg border border-failed-border bg-failed-bg px-4 py-3"
                >
                  <p className="text-body font-medium text-failed-text">
                    {localeDisplayName(locale.code)}
                  </p>
                  <pre className="mt-1.5 overflow-x-auto font-mono text-caption leading-5 text-secondary">
                    {locale.error}
                  </pre>
                </li>
              ))}
            </ul>
          </PageSection>
        ) : null}
      </SampleRegion>
    </Page>
  );
}
