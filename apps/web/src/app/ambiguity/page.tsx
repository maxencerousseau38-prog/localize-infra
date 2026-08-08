import { AmbiguityQueue } from '@/components/ambiguity-queue';
import { Page, PageHeader, PageMeta } from '@/components/page';
import { SampleBanner, SampleRegion } from '@/components/sample';
import { SAMPLE_AMBIGUITIES } from '@/lib/sample';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Ambiguity' };

export default function AmbiguityPage() {
  return (
    <Page>
      <PageHeader
        title="Ambiguity"
        purpose="Strings the agent would not guess at. Each one is a judgement call it escalated rather than getting wrong quietly."
        meta={
          <>
            <PageMeta label="Waiting">{SAMPLE_AMBIGUITIES.length}</PageMeta>
            <PageMeta label="Blocking">1 pull request</PageMeta>
          </>
        }
      />

      <div className="mt-6">
        <SampleBanner>
          These escalations are illustrative. Real ones would come from your own
          runs, and resolving one here changes nothing — there is no project
          connected and no run to unblock.
        </SampleBanner>
      </div>

      <SampleRegion label="Ambiguity queue" className="mt-6">
        <AmbiguityQueue items={SAMPLE_AMBIGUITIES} />
      </SampleRegion>
    </Page>
  );
}
