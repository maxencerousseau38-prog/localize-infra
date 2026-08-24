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
 * screen or invented rows. That is no longer true of all of them, and this
 * comment claiming otherwise is how a stale flag survives: /ambiguity now
 * reads `run_ambiguities`, confined by RLS to the caller's workspaces.
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
   * Count shown in the sidebar. Only two routes ever carry one, and both mean
   * a human is blocked — a badge on Runs would be engagement bait.
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
  {
    href: '/review',
    sample: true,
    count: 3,
    label: 'Review',
    icon: FileText,
    built: false,
    blockedBy:
      'It would let a non-developer approve or edit suggested copy, which requires accounts, roles, and somewhere to record the decision.',
    keywords: 'approve suggestions copy editor',
  },
  {
    href: '/runs',
    sample: true,
    label: 'Runs',
    icon: History,
    built: false,
    blockedBy:
      'Runs happen in your terminal today and are not recorded anywhere a web page could read them.',
    keywords: 'history jobs activity log',
  },
  {
    href: '/locales',
    sample: true,
    label: 'Locales',
    icon: Languages,
    built: false,
    blockedBy:
      'Your locales live in your repository. Listing them here requires a project connected to this app.',
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
 * lookup returned nothing — which left run detail with no breadcrumb and, worse,
 * no `Sample` chip. Losing one of the three sample markers on a page full of
 * sample data is exactly what the contract exists to prevent.
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
