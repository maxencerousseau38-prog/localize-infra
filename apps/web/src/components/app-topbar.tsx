'use client';

import { SidebarFootnote, SidebarNav } from '@/components/app-sidebar';
import { SampleChip } from '@/components/sample';
import { ALL_ROUTES, resolveRoute } from '@/lib/nav';
import {
  type CommandItem,
  CommandPalette,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
  SheetContent,
  ThemeToggle,
  cn,
  useCommandPaletteHotkey,
} from '@localize-infra/ui';
import { Menu, Search } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import * as React from 'react';

/**
 * 48px top bar (layout contract, docs/product/04-wireframes.md §0).
 *
 * Breadcrumb left, ⌘K search centre, theme control right, plus the navigation
 * trigger below 1024px. There is no global "New" button: creation happens in
 * the terminal, and a prominent web CTA would contradict the product's shape.
 */
export function AppTopbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [navOpen, setNavOpen] = React.useState(false);

  useCommandPaletteHotkey(() => setPaletteOpen((open) => !open));

  const { route: current, detail } = resolveRoute(pathname);

  const items: CommandItem[] = React.useMemo(
    () =>
      ALL_ROUTES.map((route) => ({
        id: route.href,
        label: route.label,
        section: 'Navigation',
        icon: route.icon,
        keywords: route.keywords,
        onSelect: () => router.push(route.href),
      })),
    [router],
  );
  // Only navigation is listed. An "Actions" section would have to name actions
  // that do not exist yet, and a palette that offers a command it cannot run is
  // worse than one that offers fewer.

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line px-4">
      <DialogRoot open={navOpen} onOpenChange={setNavOpen}>
        <DialogTrigger
          className={cn(
            '-ms-1 rounded-md p-1.5 text-secondary lg:hidden',
            'transition-colors hover:bg-surface hover:text-primary',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
          )}
        >
          <Menu className="size-4" aria-hidden="true" />
          <span className="sr-only">Open navigation</span>
        </DialogTrigger>
        {/* Navigation comes from the leading edge, where a reader already
            expects it — and `side="start"` is logical, so it arrives from the
            right in an RTL interface. */}
        <SheetContent
          side="start"
          size="sm"
          aria-describedby={undefined}
          className="bg-surface"
        >
          <DialogTitle className="flex h-12 shrink-0 items-center px-4 text-body font-semibold text-primary">
            Localize Infra
          </DialogTitle>
          {/* The sheet IS the navigation landmark at this width; the persistent
              sidebar that normally carries that role is not rendered. */}
          <nav aria-label="Main">
            <SidebarNav onNavigate={() => setNavOpen(false)} />
          </nav>
          <SidebarFootnote className="mt-auto" />
        </SheetContent>
      </DialogRoot>

      <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
        <ol className="flex items-center gap-1.5 text-small">
          {/* The root segment is dropped on narrow screens rather than
              truncated: the last segment is the one that says where you are. */}
          <li className="hidden text-tertiary sm:block">Localize Infra</li>
          {current ? (
            <>
              <li aria-hidden="true" className="hidden text-tertiary sm:block">
                /
              </li>
              {/* On a detail page the parent stays a link, so the breadcrumb
                  is a way back rather than a label. */}
              <li className="truncate">
                {detail ? (
                  <Link
                    href={current.href}
                    className="rounded-sm text-secondary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                  >
                    {current.label}
                  </Link>
                ) : (
                  <span className="font-medium text-primary">
                    {current.label}
                  </span>
                )}
              </li>
              {detail ? (
                <>
                  <li aria-hidden="true" className="text-tertiary">
                    /
                  </li>
                  <li className="truncate font-mono font-medium text-primary">
                    {detail}
                  </li>
                </>
              ) : null}
              {/* Third of the three sample markers. Present on every sample
                  route, so a reader who lands mid-app still sees it. */}
              {current.sample ? (
                <li>
                  <SampleChip />
                </li>
              ) : null}
            </>
          ) : null}
        </ol>
      </nav>

      <button
        type="button"
        onClick={() => setPaletteOpen(true)}
        className={cn(
          'flex h-7 shrink-0 items-center gap-2 rounded-md border border-line bg-surface px-2.5',
          'text-small text-tertiary',
          'transition-colors duration-(--duration-micro) hover:text-secondary',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
        )}
      >
        <Search className="size-3.5" aria-hidden="true" />
        <span className="sr-only sm:not-sr-only">Search</span>
        {/* The shortcut is shown, not hidden: a palette nobody knows about is a
            palette nobody uses. Hidden where there is no keyboard to press it
            with. */}
        <kbd className="hidden font-mono text-micro text-tertiary sm:inline">
          ⌘K
        </kbd>
      </button>

      <ThemeToggle />

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        items={items}
      />
    </header>
  );
}
