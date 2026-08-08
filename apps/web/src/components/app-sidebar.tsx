'use client';

import { type NavRoute, PRIMARY_NAV, SECONDARY_NAV } from '@/lib/nav';
import { cn } from '@localize-infra/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

function NavLink({
  route,
  active,
  onNavigate,
}: {
  route: NavRoute;
  active: boolean;
  onNavigate?: () => void;
}) {
  const Icon = route.icon;
  return (
    <li>
      <Link
        href={route.href}
        aria-current={active ? 'page' : undefined}
        onClick={onNavigate}
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
 * The navigation itself, shared by the persistent sidebar and the sheet it
 * becomes below 1024px. One source: a mobile nav that drifts from the desktop
 * one is a bug that only ever gets caught on a phone.
 *
 * `onNavigate` lets the sheet close itself on selection. The persistent
 * sidebar passes nothing, because there is nothing to close.
 */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <>
      <ul className="flex flex-col gap-0.5 px-2">
        {PRIMARY_NAV.map((route) => (
          <NavLink
            key={route.href}
            route={route}
            active={isActive(route.href)}
            onNavigate={onNavigate}
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
            onNavigate={onNavigate}
          />
        ))}
      </ul>
    </>
  );
}

export function SidebarFootnote({ className }: { className?: string }) {
  return (
    <p className={cn('p-4 text-[12px] leading-5 text-tertiary', className)}>
      Pre-alpha. Most screens here have no backend behind them yet and say so.
    </p>
  );
}

/**
 * 240px persistent sidebar (layout contract, docs/product/04-wireframes.md §0).
 *
 * Hidden below 1024px, where the same navigation is presented as a sheet from
 * the topbar. Maximum two levels of nesting, ever: a sidebar that scrolls is a
 * sidebar that has failed.
 */
export function AppSidebar() {
  return (
    <nav
      aria-label="Main"
      className="hidden w-60 shrink-0 flex-col border-e border-line bg-surface lg:flex"
    >
      <div className="flex h-12 shrink-0 items-center px-4">
        <Link
          href="/"
          className="rounded-[4px] text-[14px] font-semibold text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          Localize Infra
        </Link>
      </div>

      <SidebarNav />

      <SidebarFootnote className="mt-auto" />
    </nav>
  );
}
