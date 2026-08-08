import { UnbuiltPage } from '@/components/page';
import { routeByHref } from '@/lib/nav';
import type { Metadata } from 'next';

const ROUTE = routeByHref('/');

export const metadata: Metadata = { title: 'Home' };

export default function HomePage() {
  return (
    <UnbuiltPage
      title="Home"
      surface="The home screen"
      blockedBy={ROUTE?.blockedBy ?? ''}
    />
  );
}
