'use client';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar';
import { type NavRoute, PRIMARY_NAV, SECONDARY_NAV } from '@/lib/nav';
import { FlaskConical } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * The application shell's navigation, built on shadcn's Sidebar.
 *
 * This replaces a hand-rolled 240px column plus a separate sheet in the topbar
 * that duplicated the same links. What the shadcn component brings is not
 * styling — every colour here is a Localize Infra token — but behaviour that
 * was never going to be written by hand and kept correct: collapse to an icon
 * rail, a ⌘B shortcut, the collapsed state persisted across sessions, the rail
 * as a drag target, and an automatic Sheet presentation below the mobile
 * breakpoint with its own focus management.
 *
 * The identity work is in the mapping: `--sidebar` resolves to our surface,
 * `--sidebar-accent` to our active ground, `--sidebar-ring` to the Iris focus
 * ring. shadcn's generated defaults shipped a blue ring, which this product's
 * colour discipline does not allow.
 */
function NavItem({
  route,
  collapsedLabel,
}: { route: NavRoute; collapsedLabel: string }) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const active =
    route.href === '/' ? pathname === '/' : pathname.startsWith(route.href);
  const Icon = route.icon;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={active}
        tooltip={collapsedLabel}
        className="data-[active=true]:font-medium"
      >
        <Link
          href={route.href}
          aria-current={active ? 'page' : undefined}
          // On a phone the navigation is a sheet over the page. shadcn does not
          // dismiss it on selection, so without this the reader arrives at the
          // new route with the menu still covering it.
          onClick={() => setOpenMobile(false)}
        >
          <Icon aria-hidden="true" />
          <span className="truncate">{route.label}</span>
          {/* Only ambiguity and review carry a count, and both mean a human is
              blocked. Still dashed rather than a solid badge: the number is
              sample data like the surface it points at, and the dashed chrome
              is the third of this product's three sample markers. It is hidden
              when the rail collapses, where the tooltip carries it instead. */}
          {route.count !== undefined ? (
            <span className="ms-auto rounded-sm border border-dashed border-strong px-1.5 font-mono text-micro tabular-nums text-tertiary group-data-[collapsible=icon]:hidden">
              {route.count}
            </span>
          ) : null}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AppSidebar() {
  return (
    <Sidebar collapsible="icon" className="border-e border-line">
      <SidebarHeader className="h-12 justify-center px-3">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-md text-body font-semibold text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          {/* The mark: three rules of descending width, echoing the State Rule
              the product uses to carry confidence. Graphite throughout — Iris
              means one thing here and chrome does not get to borrow it. */}
          <span
            aria-hidden="true"
            className="flex size-4 shrink-0 flex-col justify-between py-[1px]"
          >
            <span className="block h-[2px] w-full rounded-full bg-primary" />
            <span className="block h-[2px] w-3/4 rounded-full bg-strong" />
            <span className="block h-[2px] w-1/2 rounded-full bg-line" />
          </span>
          <span className="truncate group-data-[collapsible=icon]:hidden">
            Localize&nbsp;Infra
          </span>
        </Link>
      </SidebarHeader>

      {/* shadcn's SidebarContent is a plain div, so wrapping the groups in a
          nav restores the single "Main" landmark this application has always
          exposed. Without it the sidebar is a pile of links with no landmark
          to jump to, which is a regression a screen-reader user would feel
          immediately and a sighted reviewer would never see. */}
      <SidebarContent>
        <nav aria-label="Main" className="flex min-h-0 flex-1 flex-col gap-2">
          <SidebarGroup>
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {PRIMARY_NAV.map((route) => (
                  <NavItem
                    key={route.href}
                    route={route}
                    collapsedLabel={
                      route.count !== undefined
                        ? `${route.label} (${route.count})`
                        : route.label
                    }
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarSeparator />

          <SidebarGroup>
            <SidebarGroupLabel>System</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {SECONDARY_NAV.map((route) => (
                  <NavItem
                    key={route.href}
                    route={route}
                    collapsedLabel={route.label}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </nav>
      </SidebarContent>

      {/*
       * Scoped to the screens listed above, because it stopped being true of
       * the application as a whole.
       *
       * It read "No project connected. Everything shown is sample data." That
       * was correct when nothing was real. It is now a false claim on four
       * surfaces — the workspace, its projects, a project's runs and billing —
       * which read from the database, are scoped to the caller and persist. A
       * banner asserting that real data is invented is the same defect as
       * presenting invented data as real, pointing the other way, and this
       * product cannot afford either.
       *
       * The routes in the nav above genuinely are still stubs, so the sentence
       * survives with its subject narrowed rather than being deleted.
       */}
      <SidebarFooter className="group-data-[collapsible=icon]:hidden">
        <div className="flex items-start gap-2 rounded-md border border-dashed border-strong px-2.5 py-2">
          <FlaskConical
            className="mt-0.5 size-3.5 shrink-0 text-tertiary"
            aria-hidden="true"
            strokeWidth={1.5}
          />
          <p className="text-micro leading-4 text-tertiary">
            The screens listed above show sample data. Your workspace, projects
            and runs are real.
          </p>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
