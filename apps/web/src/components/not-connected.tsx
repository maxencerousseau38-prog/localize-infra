import { EmptyState } from '@localize-infra/ui';

/**
 * What a data surface shows when there is no database to read.
 *
 * This is production behaviour, not a test accommodation. These four routes
 * used to render fixtures and therefore could not fail; now that they read
 * Postgres, an unreachable or unconfigured database made them throw and the
 * page returned 500 with a minified React error. A customer whose deployment
 * loses its database should be told that, not shown a stack trace — and the
 * preview build, which runs with no database on purpose, should render rather
 * than break.
 *
 * Deliberately not a fallback to sample data. Showing invented rows when the
 * real ones cannot be read is worse than showing none: it is indistinguishable
 * from working, and the reader would act on numbers that describe nobody's
 * project.
 */
export function NotConnected({ noun }: { noun: string }) {
  return (
    <div className="mt-8">
      <EmptyState
        title={`No ${noun} to show`}
        description="This deployment has no database configured, so there is nothing to read. The CLI still works against a local clone."
      />
    </div>
  );
}
