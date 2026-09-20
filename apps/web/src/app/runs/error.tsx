'use client';

import { Page, PageHeader } from '@/components/page';
import { ErrorState } from '@localize-infra/ui';
import { useEffect } from 'react';

/**
 * What `/runs` shows when its query throws.
 *
 * DESIGN.md §8: an error state says what failed, why, and what to do, and
 * **reproduces machine output verbatim**. `listRunsForViewer` throws
 * `Could not load runs: <postgres message>` — that sentence is the diagnosis,
 * and paraphrasing it into "Something went wrong" would throw away the only
 * thing a reader could act on or paste into a report.
 *
 * Before this file, that throw reached Next's default error boundary: a blank
 * page with a generic sentence, no header, no navigation, and no way back
 * except the browser's own button.
 *
 * `reset` re-runs the segment, which is the right retry here — the failure a
 * query like this actually has is transient (a dropped connection, a paused
 * Supabase project), so trying again is a real remedy rather than a gesture.
 *
 * ## What `error.message` contains in production
 *
 * Next replaces a server error's message with a generic string plus a digest
 * before it reaches the client, so this cannot leak a connection string or a
 * stack. The verbatim requirement and that redaction do not conflict: the page
 * shows exactly what it was given, and says so by showing the digest too when
 * there is one.
 */
export default function RunsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The browser console is the only place the full client-side error exists;
    // the server one is already in the platform's logs under this digest.
    console.error('runs failed to load:', error);
  }, [error]);

  return (
    <Page>
      <PageHeader
        title="Runs"
        purpose="Every extraction and translation, what it produced, and what it cost you in time."
      />
      <div className="mt-8">
        <ErrorState
          title="Could not load your runs"
          description="Nothing was changed. The run history is read on every visit, so if this was a dropped connection, trying again is enough."
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
