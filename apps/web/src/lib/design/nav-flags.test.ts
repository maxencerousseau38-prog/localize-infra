import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ALL_ROUTES } from '../nav';

/**
 * That a route's flags still describe the screen it points at.
 *
 * `built: false` puts "not built yet" in front of a reader and `sample: true`
 * puts a SAMPLE chip in the breadcrumb. Both are claims about a page, written
 * in a different file from the page, and nothing connected the two — so when
 * `/review`, `/runs` and `/locales` began reading Postgres in #19 to #22, the
 * flags stayed. `/runs` wore a SAMPLE chip over rows under RLS for months, and
 * its `blockedBy` read "Runs happen in your terminal today and are not recorded
 * anywhere a web page could read them" while the page was reading them.
 *
 * `/ambiguity` was corrected in the PR that made its own surface real. The
 * other three were not, which is the whole shape of the defect: a record
 * updated where somebody happened to be looking.
 *
 * It was found by an audit that opened the pages in a browser, not by reading
 * code — and `interaction.spec.ts` had already written "four of those five now
 * read Postgres and have no sample to declare" while this file still said
 * three of them did. Two descriptions of one fact, disagreeing, neither able to
 * see the other. This test is the thing that can.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '../../app');

/** The page file a nav href resolves to, or null for a route with no page. */
function pageFor(href: string): string | null {
  const path = join(APP, href === '/' ? '' : href, 'page.tsx');
  return existsSync(path) ? readFileSync(path, 'utf8') : null;
}

const ROUTES = ALL_ROUTES.map((route) => ({
  href: route.href,
  built: route.built,
  sample: route.sample ?? false,
  source: pageFor(route.href),
}));

describe('nav flags', () => {
  it('finds a page for every route it claims to describe', () => {
    // A moved page would otherwise make every assertion below vacuous — the
    // failure mode this repository keeps meeting, and the reason each of its
    // guards opens with a check that it is looking at something.
    expect(ROUTES.length).toBeGreaterThan(6);
    expect(ROUTES.filter((r) => r.source === null).map((r) => r.href)).toEqual(
      [],
    );
  });

  /**
   * `/` is `built: false` and renders no not-built screen, deliberately.
   *
   * What is unbuilt there is the dashboard's *content* — the runs, ambiguities
   * and reviews it summarises, none of which the summary reads. The page itself
   * renders `SampleBanner` and `SampleRegion`, and only ever to a visitor with
   * no database: a signed-in reader is redirected to their workspace before it
   * draws. So it declares its emptiness with the sample markers rather than
   * with a not-built screen, which is a different honest answer, not a missing
   * one.
   *
   * Named here rather than handled by loosening the rule, because a rule with a
   * gap wide enough for this case would have let the three stale flags through
   * as well.
   */
  const DECLARES_WITH_SAMPLE_MARKERS = ['/'];

  it.each(ROUTES.map((r) => r.href))(
    '%s renders a not-built screen only if it says it is not built',
    (href) => {
      const route = ROUTES.find((r) => r.href === href);
      const declaresUnbuilt =
        /NotBuiltYet|blockedBy=/.test(route?.source ?? '') ||
        (DECLARES_WITH_SAMPLE_MARKERS.includes(href) &&
          /SampleBanner/.test(route?.source ?? ''));
      expect(
        declaresUnbuilt,
        route?.built
          ? `${href} is marked built: true but renders a not-built screen`
          : `${href} is marked built: false and renders a real surface — the flag outlived the page`,
      ).toBe(!route?.built);
    },
  );

  it('marks a route sample only where a sample marker is rendered', () => {
    /*
     * The chip is one of three markers the contract requires together. A route
     * flagged `sample` whose page renders none of them puts the chip on real
     * data, which is the worse direction of this error: it tells a reader their
     * own rows are invented.
     */
    const lying = ROUTES.filter(
      (r) => r.sample && !/Sample|sample data/i.test(r.source ?? ''),
    ).map((r) => r.href);
    expect(
      lying,
      'these wear a SAMPLE chip over a page with no sample data',
    ).toEqual([]);
  });

  it('carries no hardcoded count', () => {
    /*
     * Both counts this nav ever had were literals — a number about one
     * workspace shown to every reader, and to signed-out visitors too while the
     * shell was drawn around the sign-in form. A real one needs a query per
     * render, which the sidebar does not do.
     */
    const counted = ALL_ROUTES.filter((route) => route.count !== undefined).map(
      (route) => route.href,
    );
    expect(counted, 'a count in nav.ts can only be a literal').toEqual([]);
  });
});
