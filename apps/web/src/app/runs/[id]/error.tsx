'use client';

import { Page, PageHeader } from '@/components/page';
import { Button, ErrorState } from '@localize-infra/ui';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';

/**
 * What one run's page shows when it cannot be read.
 *
 * Distinct from the list's boundary in one way that matters: this segment can
 * fail with the reader deep in a link somebody sent them, so the way out is
 * part of the state. `All runs` is the same control the loaded page carries in
 * the same position, which is what stops the error screen reading as a dead end.
 *
 * A run that does not exist is **not** this: `findRun` returns null and the
 * page calls `notFound()`. That distinction is deliberate — "this run is not
 * yours or not here" and "the database would not answer" are different facts,
 * and collapsing them would tell a reader to retry something that will never
 * succeed.
 */
export default function RunDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('run detail failed to load:', error);
  }, [error]);

  return (
    <Page>
      <div className="pt-6">
        <Button asChild variant="ghost" size="sm">
          <Link href="/runs">
            <ArrowLeft aria-hidden="true" />
            All runs
          </Link>
        </Button>
      </div>

      <PageHeader title="Run" />

      <div className="mt-8">
        <ErrorState
          title="Could not load this run"
          description="Nothing was changed. The run, its translations and its questions are read together on every visit, so a retry costs nothing."
          detail={
            error.digest
              ? `${error.message} (digest ${error.digest})`
              : error.message
          }
          onRetry={reset}
        />
      </div>
    </Page>
  );
}
