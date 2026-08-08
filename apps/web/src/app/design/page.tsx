import { DesignGallery } from '@/components/design-gallery';
import { Page, PageHeader } from '@/components/page';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Design system' };

export default function DesignPage() {
  return (
    <Page>
      <PageHeader
        title="Design system"
        purpose="Every component in packages/ui, rendered live. This page needs no backend and has none — it shows the components themselves, not anyone's data."
      />
      <div className="mt-8">
        <DesignGallery />
      </div>
    </Page>
  );
}
