import { Page, PageHeader, PageMeta } from '@/components/page';
import { RunsTable } from '@/components/runs-table';
import { SampleBanner, SampleRegion } from '@/components/sample';
import { SAMPLE_RUNS } from '@/lib/sample';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Runs' };

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

      <SampleRegion label="Run history" className="mt-6">
        <RunsTable runs={SAMPLE_RUNS} />
      </SampleRegion>
    </Page>
  );
}
