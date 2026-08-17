import {
  Boxes,
  FileText,
  History,
  Languages,
  LayoutGrid,
  Settings,
  TriangleAlert,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * The application's routes.
 *
 * `built` is the load-bearing field. Every route below except the design
 * gallery renders a screen that says it is not built, because the backend those
 * screens would read from does not exist (see CLAUDE.md — no database, no
 * accounts, no organisations, no persisted projects). The shell is real; the
 * data is absent, and the UI says so rather than inventing it.
 *
 * The information architecture (docs/product/03-information-architecture.md
 * §2) scopes these under `/{org}/{project}`. They are flat here because there
 * are no organisations or projects to scope them to yet — a URL containing a
 * fabricated org slug would be exactly the kind of invented reality the shell
 * is built to avoid.
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
    sample: true,
    count: 3,
    label: 'Ambiguity',
    icon: TriangleAlert,
    built: false,
    blockedBy:
      'The agent already surfaces ambiguity in the terminal and in pull requests. Reviewing it here requires a place to store the questions and your answers.',
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
