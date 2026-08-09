import { LocalesTable } from '@/components/locales-table';
import { Page, PageHeader, PageMeta } from '@/components/page';
import { SampleBanner, SampleRegion } from '@/components/sample';
import { SAMPLE_LOCALES, SAMPLE_SOURCE_STRINGS } from '@/lib/sample';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Locales' };

export default function LocalesPage() {
  const behind = SAMPLE_LOCALES.filter((l) => l.translated < l.total).length;

  return (
    <Page>
      <PageHeader
        title="Locales"
        purpose="Which languages are current, which are behind, and which are waiting on a human."
        meta={
          <>
            <PageMeta label="Languages">{SAMPLE_LOCALES.length}</PageMeta>
            <PageMeta label="Source strings">{SAMPLE_SOURCE_STRINGS}</PageMeta>
            <PageMeta label="Behind">{behind}</PageMeta>
          </>
        }
      />

      <div className="mt-6">
        <SampleBanner>
          Your locales live in your repository. Listing them here needs a
          connected project, so these five show the shape instead.
        </SampleBanner>
      </div>

      <SampleRegion label="Locale coverage" className="mt-6">
        <LocalesTable locales={SAMPLE_LOCALES} />
      </SampleRegion>
    </Page>
  );
}
