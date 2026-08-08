import { Page, PageHeader, PageMeta } from '@/components/page';
import { SampleBanner, SampleRegion } from '@/components/sample';
import { SAMPLE_RUNS, type SampleRun } from '@/lib/sample';
import {
  Badge,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  type Tone,
} from '@localize-infra/ui';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Runs' };

const STATE: Record<SampleRun['state'], { tone: Tone; label: string }> = {
  succeeded: { tone: 'confident', label: 'Succeeded' },
  partial: { tone: 'degraded', label: 'Partial' },
  failed: { tone: 'failed', label: 'Failed' },
};

function duration(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

export default function RunsPage() {
  return (
    <Page>
      <PageHeader
        title="Runs"
        purpose="Every extraction and translation, what it produced, and what it cost you in time."
        meta={
          <>
            <PageMeta label="Last run">2 hours ago</PageMeta>
            <PageMeta label="Succeeded">1 of 3</PageMeta>
          </>
        }
      />

      <div className="mt-6">
        <SampleBanner>
          Real runs come from the CLI. Nothing records them yet, so these three
          illustrate the shape — a clean run, a partial one, and a failure.
        </SampleBanner>
      </div>

      {/* No chart. A run-history chart would be decoration; the table is the
          information, and it is scannable in one pass. */}
      <SampleRegion label="Run history" className="mt-6">
        <Table>
          <THead>
            <TR>
              <TH>Status</TH>
              <TH>Trigger</TH>
              <TH numeric>Locales</TH>
              <TH numeric>Strings</TH>
              <TH numeric>Duration</TH>
              <TH>Output</TH>
              <TH>When</TH>
            </TR>
          </THead>
          <TBody>
            {SAMPLE_RUNS.map((run) => {
              const state = STATE[run.state];
              return (
                <TR key={run.id}>
                  <TD>
                    <Badge tone={state.tone}>{state.label}</Badge>
                  </TD>
                  <TD>
                    <span className="font-mono text-caption text-secondary">
                      {run.trigger}
                    </span>
                  </TD>
                  <TD numeric>
                    {run.localesFailed > 0 ? (
                      <span className="text-degraded-text">
                        {run.locales - run.localesFailed}/{run.locales}
                      </span>
                    ) : (
                      `${run.locales}`
                    )}
                  </TD>
                  <TD numeric>{run.strings || '—'}</TD>
                  <TD numeric>{duration(run.durationMs)}</TD>
                  <TD>
                    {run.prNumber ? (
                      <span className="text-link">
                        #{run.prNumber}
                        {run.prMerged ? ' · merged' : ''}
                      </span>
                    ) : (
                      <span className="text-tertiary">None</span>
                    )}
                  </TD>
                  <TD>{run.when}</TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </SampleRegion>
    </Page>
  );
}
