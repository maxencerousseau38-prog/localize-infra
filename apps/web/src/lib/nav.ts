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
  /** What must exist before this screen can show anything real. */
  blockedBy?: string;
  /** Keywords for the command palette that are not in the label. */
  keywords?: string;
}

export const PRIMARY_NAV: NavRoute[] = [
  {
    href: '/',
    label: 'Home',
    icon: LayoutGrid,
    built: false,
    blockedBy:
      'It would show what needs your attention across your projects, which requires accounts and persisted projects.',
    keywords: 'overview dashboard start',
  },
  {
    href: '/ambiguity',
    label: 'Ambiguity',
    icon: TriangleAlert,
    built: false,
    blockedBy:
      'The agent already surfaces ambiguity in the terminal and in pull requests. Reviewing it here requires a place to store the questions and your answers.',
    keywords: 'questions decisions blocked unclear',
  },
  {
    href: '/review',
    label: 'Review',
    icon: FileText,
    built: false,
    blockedBy:
      'It would let a non-developer approve or edit suggested copy, which requires accounts, roles, and somewhere to record the decision.',
    keywords: 'approve suggestions copy editor',
  },
  {
    href: '/runs',
    label: 'Runs',
    icon: History,
    built: false,
    blockedBy:
      'Runs happen in your terminal today and are not recorded anywhere a web page could read them.',
    keywords: 'history jobs activity log',
  },
  {
    href: '/locales',
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
