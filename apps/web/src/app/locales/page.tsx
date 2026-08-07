import { UnbuiltPage } from '@/components/page';
import { routeByHref } from '@/lib/nav';
import type { Metadata } from 'next';

const ROUTE = routeByHref('/locales');

export const metadata: Metadata = { title: 'Locales' };

export default function LocalesPage() {
  return (
    <UnbuiltPage
      title="Locales"
      surface="The locale list"
      blockedBy={ROUTE?.blockedBy ?? ''}
    />
  );
}
