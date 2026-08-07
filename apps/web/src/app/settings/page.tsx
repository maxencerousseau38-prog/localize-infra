import { UnbuiltPage } from '@/components/page';
import { routeByHref } from '@/lib/nav';
import type { Metadata } from 'next';

const ROUTE = routeByHref('/settings');

export const metadata: Metadata = { title: 'Settings' };

export default function SettingsPage() {
  return (
    <UnbuiltPage
      title="Settings"
      surface="Settings"
      blockedBy={ROUTE?.blockedBy ?? ''}
    />
  );
}
