import { UnbuiltPage } from '@/components/page';
import { routeByHref } from '@/lib/nav';
import type { Metadata } from 'next';

const ROUTE = routeByHref('/review');

export const metadata: Metadata = { title: 'Review' };

export default function ReviewPage() {
  return (
    <UnbuiltPage
      title="Review"
      surface="The review surface"
      blockedBy={ROUTE?.blockedBy ?? ''}
    />
  );
}
