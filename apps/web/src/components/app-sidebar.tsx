'use client';

import { type NavRoute, PRIMARY_NAV, SECONDARY_NAV } from '@/lib/nav';
import { cn } from '@localize-infra/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

function NavLink({ route, active }: { route: NavRoute; active: boolean }) {
  const Icon = route.icon;
  return (
    <li>
      <Link
        href={route.href}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex h-8 items-center gap-2.5 rounded-md px-2',
          'text-[14px] leading-5',
          'transition-colors duration-(--duration-micro)',
          'focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-focus',
          active
            ? 'bg-surface font-medium text-primary'
            : 'text-secondary hover:bg-surface hover:text-primary',
        )}
      >
        <Icon className="size-4 shrink-0 text-tertiary" aria-hidden="true" />
        <span className="truncate">{route.label}</span>
        {/* No count badges. The IA reserves badges for ambiguity and pending
            suggestions only, and both counts would have to be invented today —
            a badge showing a fabricated number is worse than no badge. */}
      </Link>
    </li>
  );
}

/**
 * 240px persistent sidebar (layout contract, docs/product/04-wireframes.md).
 *
 * Maximum two levels of nesting, ever: a sidebar that scrolls is a sidebar that
 * has failed. There is no project switcher because there are no projects.
 */
export function AppSidebar() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <nav
      aria-label="Main"
      className="flex w-60 shrink-0 flex-col border-e border-line bg-surface"
    >
      <div className="flex h-12 shrink-0 items-center px-4">
        <Link
          href="/"
          className="rounded-[4px] text-[14px] font-semibold text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          Localize Infra
        </Link>
      </div>

      <ul className="flex flex-col gap-0.5 px-2">
        {PRIMARY_NAV.map((route) => (
          <NavLink
            key={route.href}
            route={route}
            active={isActive(route.href)}
          />
        ))}
      </ul>

      <hr className="mx-2 my-2 border-subtle" />

      <ul className="flex flex-col gap-0.5 px-2">
        {SECONDARY_NAV.map((route) => (
          <NavLink
            key={route.href}
            route={route}
            active={isActive(route.href)}
          />
        ))}
      </ul>

      <p className="mt-auto p-4 text-[12px] leading-5 text-tertiary">
        Pre-alpha. Most screens here have no backend behind them yet and say so.
      </p>
    </nav>
  );
}
