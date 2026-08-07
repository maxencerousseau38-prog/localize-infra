import { UnbuiltPage } from '@/components/page';
import { routeByHref } from '@/lib/nav';
import type { Metadata } from 'next';

const ROUTE = routeByHref('/ambiguity');

export const metadata: Metadata = { title: 'Ambiguity' };

export default function AmbiguityPage() {
  return (
    <UnbuiltPage
      title="Ambiguity"
      surface="The ambiguity queue"
      blockedBy={ROUTE?.blockedBy ?? ''}
    />
  );
}
