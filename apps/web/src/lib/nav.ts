import {
  Boxes,
  Building2,
  FileText,
  History,
  Inbox,
  Languages,
  LayoutGrid,
  MessageSquare,
  Radar,
  Settings,
  TriangleAlert,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * The application's routes.
 *
 * `built` and `sample` were both written when there was no database, no
 * accounts and no organisations, and every route rendered either a not-built
 * screen or invented rows.
 *
 * **One route still carries `sample`, and one still carries `built: false`.**
 * `/` keeps both because its dashboard summarises runs, ambiguities and reviews
 * that nothing records — and it is reached only by a signed-out preview build,
 * since a signed-in reader is redirected to their workspace. `/settings` keeps
 * `built: false` because its controls would not work.
 *
 * Every other entry lost them, and they were lost late: `/ambiguity` in the PR
 * that made its surface real, `/review`, `/runs` and `/locales` on 2026-09-20,
 * by reading the screens rather than the file. A flag describing a screen has
 * no way to notice the screen changed, so it survives until somebody looks —
 * which is why the audit that found them looked at pixels, not at code.
 *
 * The information architecture (docs/product/03-information-architecture.md
 * §2) scopes these under `/{org}/{project}`. They are still flat because they
 * are inboxes — "what is waiting on me" spans workspaces, and the answering
 * happens on the project page where the run and its proposal are in view.
 */
export interface NavRoute {
  href: string;
  label: string;
  icon: LucideIcon;
  built: boolean;
  /**
   * Content is sample data, not this user's. Drives the breadcrumb chip.
   * Settings is deliberately false: it has controls that would not work, so
   * there is nothing to demonstrate.
   */
  sample?: boolean;
  /**
   * Count shown in the sidebar.
   *
   * **No route carries one today, and the field is kept rather than deleted so
   * the next one has a shape to fill.** Both routes that ever did — Ambiguity,
   * then Review — carried a literal, which is a number about somebody else's
   * workspace shown to everybody, and they were removed one at a time as each
   * was noticed. A real count needs a query per render and the sidebar does
   * none; whoever adds the query may have this back.
   *
   * The rule that outlives the field: a badge on Runs would be engagement bait.
   * Only a route where a human is blocked has earned one.
   */
  count?: number;
  /** What must exist before this screen can show anything real. */
  blockedBy?: string;
  /** Keywords for the command palette that are not in the label. */
  keywords?: string;
}

export const PRIMARY_NAV: NavRoute[] = [
  {
    href: '/',
    // Still sample, and still unbuilt — but for a narrower reason than before.
    //
    // Accounts and persisted projects now exist, so `/` no longer renders this
    // dashboard for a signed-in user: it routes them to their workspace. What
    // is unbuilt is the dashboard's *content* — the runs, ambiguities and
    // reviews it summarises — none of which is recorded anywhere yet.
    //
    // The sample dashboard survives for the preview build, where there is no
    // database at all. Marking this `built: true` on the strength of the
    // redirect would claim a screen that still has nothing real to show.
    sample: true,
    label: 'Home',
    icon: LayoutGrid,
    built: false,
    blockedBy:
      'Workspaces and projects exist now, so this routes you to yours. The summary itself needs runs, ambiguities and reviews, none of which are recorded yet.',
    keywords: 'overview dashboard start workspace',
  },
  {
    href: '/ambiguity',
    // No `count`. It was a hardcoded 3 rendered as a badge in the sidebar —
    // an invented number on every account, including one with nothing
    // waiting. A real count needs a query per render, which the sidebar does
    // not do; no badge is honest, a fixed one is not.
    label: 'Ambiguity',
    icon: TriangleAlert,
    built: true,
    keywords: 'questions decisions blocked unclear',
  },
  /*
   * The three entries below were `sample: true, built: false` until the visual
   * audit of 2026-09-20 read them off the screen.
   *
   * All three call `requireSession` and a query — `listReviewItemsForViewer`,
   * `listRunsForViewer`, `listLocaleCoverage` — and none renders `NotBuiltYet`.
   * `/runs` was wearing a SAMPLE chip over rows read from Postgres under RLS,
   * and its `blockedBy` read "Runs happen in your terminal today and are not
   * recorded anywhere a web page could read them" on a page that was reading
   * them. The flags outlived the screens they described, by PRs #19 to #22.
   *
   * `/ambiguity`, one entry above, was corrected when its own surface became
   * real and the other three were not. That is the shape of this defect: a
   * record updated where somebody looked, and left everywhere else.
   */
  {
    href: '/review',
    // No `count`. It was a hardcoded 3, rendered as the sidebar badge on every
    // account including one with nothing waiting — and until 2026-09-20 it was
    // also rendered to visitors with no session at all, because the shell was
    // drawn around the sign-in form. The comment on `/ambiguity` above rejected
    // exactly this number for exactly this reason, and the entry below it kept
    // it. A real count needs a query per render, which the sidebar does not do.
    label: 'Review',
    icon: FileText,
    built: true,
    keywords: 'approve suggestions copy editor',
  },
  {
    href: '/runs',
    label: 'Runs',
    icon: History,
    built: true,
    keywords: 'history jobs activity log',
  },
  {
    href: '/locales',
    label: 'Locales',
    icon: Languages,
    built: true,
    keywords: 'languages translations targets',
  },
];

export const SECONDARY_NAV: NavRoute[] = [
  {
    href: '/design',
    label: 'Design system',
    icon: Boxes,
    built: true,
    keywords: 'components gallery ui primitives tokens',
  },
  {
    href: '/settings',
    label: 'Settings',
    icon: Settings,
    built: false,
    blockedBy:
      'There is no account, organisation, or project to configure yet.',
    keywords: 'preferences configuration account',
  },
];

/**
 * Closer — the operator's own sales tooling.
 *
 * A group of its own rather than entries mixed into `PRIMARY_NAV`, and it is
 * rendered only for a workspace that has Closer. Two reasons, and the second is
 * the one that matters: mixing "Leads" in beside "Runs" would tell a customer
 * that their localisation product has a sales pipeline, and the entries would
 * be present in the markup of every signed-in page whether or not the reader
 * may use them.
 *
 * Not in `ALL_ROUTES`. That list feeds the command palette and the breadcrumb,
 * both of which render for everybody — a Closer route surfacing in a customer's
 * ⌘K is the same leak by a quieter route.
 */
export const CLOSER_NAV: NavRoute[] = [
  {
    href: '/closer',
    label: 'Overview',
    icon: Radar,
    built: true,
    keywords: 'closer sales pipeline prospects',
  },
  {
    href: '/closer/companies',
    label: 'Companies',
    icon: Building2,
    built: true,
    keywords: 'closer prospects accounts discovery',
  },
  {
    href: '/closer/approvals',
    label: 'Approvals',
    icon: Inbox,
    built: true,
    keywords: 'closer outreach drafts approve review send',
  },
  {
    href: '/closer/replies',
    label: 'Replies',
    icon: MessageSquare,
    built: true,
    keywords: 'closer replies answers classify intent opt out',
  },
];

export const ALL_ROUTES = [...PRIMARY_NAV, ...SECONDARY_NAV];

export function routeByHref(href: string): NavRoute | undefined {
  return ALL_ROUTES.find((route) => route.href === href);
}

/**
 * Resolves any path, including a detail page, to the nav entry it belongs under.
 *
 * A detail route like `/runs/run-7c1b` is not in the nav list, so an exact
 * lookup returned nothing — which left run detail with no breadcrumb and, at the
 * time, no `Sample` chip either, on a page that was then full of sample data.
 *
 * The chip is gone from that path now: `/runs` reads Postgres, so the run and
 * its detail carry no marker. The breadcrumb reason stands on its own, and it
 * is the durable one — a detail page with no way back is a dead end whatever
 * its data is.
 *
 * Returns the deepest matching parent plus the trailing segment, so the
 * breadcrumb can read `Runs / 7c1b` and stay a way back rather than a label.
 */
export function resolveRoute(pathname: string): {
  route: NavRoute | undefined;
  detail?: string;
} {
  const exact = routeByHref(pathname);
  if (exact) return { route: exact };

  const parent = ALL_ROUTES.filter(
    (route) => route.href !== '/' && pathname.startsWith(`${route.href}/`),
  )
    // Deepest wins, so a future nested route does not resolve to a shallower one.
    .sort((a, b) => b.href.length - a.href.length)[0];

  if (!parent) return { route: undefined };

  const trailing = pathname.slice(parent.href.length + 1).split('/')[0];
  return { route: parent, detail: trailing?.replace(/^run-/, '') };
}
