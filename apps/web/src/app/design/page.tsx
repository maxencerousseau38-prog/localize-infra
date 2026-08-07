import { DesignGallery } from '@/components/design-gallery';
import { Page } from '@/components/page';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Design system' };

export default function DesignPage() {
  return (
    <Page
      title="Design system"
      description="Every component in packages/ui, rendered live. This page has no backend behind it and needs none — it shows the components themselves, not anyone's data."
    >
      <DesignGallery />
    </Page>
  );
}
