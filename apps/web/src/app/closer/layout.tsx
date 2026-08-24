import { hasCloser } from '@/lib/closer/access';
import { requireSession } from '@/lib/data/workspace';
import { CLOSER_NAV } from '@/lib/nav';
import { cn } from '@localize-infra/ui';
import Link from 'next/link';
import { notFound } from 'next/navigation';

/**
 * Closer's own shell, and the reason it is here rather than in the sidebar.
 *
 * The first attempt put a Closer group in the global sidebar and answered
 * `hasCloser()` in the root layout. It worked, and it cost a database round
 * trip on every render of every page for every reader — measured at 210–250 ms
 * against the development project. The acceptance suite went from 28.8 seconds
 * to 2.4 minutes and 26 of its 27 tests timed out waiting for a page that never
 * went idle. Production runs in `cdg1`, next door to the database, so the
 * latency there would be a tenth of that — but the shape is wrong at any
 * latency: it makes every customer's page render pay for a feature one operator
 * has.
 *
 * Nested here, the check runs only on Closer's own routes. The cost lands on
 * the reader who is using the thing.
 *
 * The trade is discoverability: there is no link into Closer from anywhere in
 * the application, so it is reached by URL. For a single internal user that is
 * a bookmark. Putting an entry in the global navigation would either show a
 * sales pipeline to customers or reintroduce the query this moved.
 */
export default async function CloserLayout({
  children,
}: { children: React.ReactNode }) {
  /*
   * The gate runs first, and the order is load-bearing rather than tidy.
   *
   * `requireSession()` builds a Supabase client, which throws when the
   * application is configured without a database — the preview build, and the
   * server the shell suite runs against. Asking it first turned what should be
   * a 404 into a 500. `hasCloser()` answers false in that case, and false for
   * an anonymous request too, because RLS returns nothing without a session.
   *
   * A 404 rather than a redirect or an explanation: it is the only answer that
   * does not confirm the route exists to somebody who should not see it.
   */
  if (!(await hasCloser())) notFound();
  await requireSession();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/*
       * Closer's own navigation, inside Closer's own area.
       *
       * A horizontal band rather than a second sidebar: the application
       * already has one, and two vertical rails competing for the same edge is
       * the shape that makes an embedded tool feel bolted on.
       */}
      <nav
        aria-label="Closer"
        className="flex items-center gap-1 border-b border-subtle px-4 pt-3 sm:px-6"
      >
        {CLOSER_NAV.map((route) =>
          /*
           * An unbuilt route is named, not linked.
           *
           * The first version linked every entry. Next prefetches a `<Link>` on
           * sight, so the tab for a route that does not exist yet fired a
           * request that could not succeed — and the page never reached network
           * idle, which failed every test that waits for it. A link to nothing
           * is also a lie to the reader; `blockedBy` says what is missing
           * instead.
           */
          route.built ? (
            <Link
              key={route.href}
              href={route.href}
              className={cn(
                'rounded-t-md px-3 py-2 text-small font-medium',
                'text-secondary hover:text-primary',
                'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
              )}
            >
              {route.label}
            </Link>
          ) : (
            <span
              key={route.href}
              title={route.blockedBy}
              className="cursor-default px-3 py-2 text-small font-medium text-tertiary"
            >
              {route.label}
            </span>
          ),
        )}
      </nav>
      {children}
    </div>
  );
}
