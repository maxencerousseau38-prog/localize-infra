import { UnbuiltPage } from '@/components/page';
import { routeByHref } from '@/lib/nav';
import type { Metadata } from 'next';

const ROUTE = routeByHref('/runs');

export const metadata: Metadata = { title: 'Runs' };

export default function RunsPage() {
  return (
    <UnbuiltPage
      title="Runs"
      surface="Run history"
      blockedBy={ROUTE?.blockedBy ?? ''}
    />
  );
}
