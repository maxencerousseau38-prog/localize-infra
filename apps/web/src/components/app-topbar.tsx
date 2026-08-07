'use client';

import { ALL_ROUTES, routeByHref } from '@/lib/nav';
import {
  type CommandItem,
  CommandPalette,
  ThemeToggle,
  cn,
  useCommandPaletteHotkey,
} from '@localize-infra/ui';
import { Search } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import * as React from 'react';

/**
 * 48px top bar (layout contract, docs/product/04-wireframes.md §2).
 *
 * Breadcrumb left, ⌘K search centre, theme control right. There is no global
 * "New" button: creation happens in the terminal, and a prominent web CTA would
 * contradict the product's shape.
 */
export function AppTopbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [paletteOpen, setPaletteOpen] = React.useState(false);

  useCommandPaletteHotkey(() => setPaletteOpen((open) => !open));

  const current = routeByHref(pathname);

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
    <header className="flex h-12 shrink-0 items-center gap-4 border-b border-line px-4">
      <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
        <ol className="flex items-center gap-1.5 text-[13px]">
          <li className="text-tertiary">Localize Infra</li>
          {current ? (
            <>
              <li aria-hidden="true" className="text-tertiary">
                /
              </li>
              <li className="truncate font-medium text-primary">
                {current.label}
              </li>
            </>
          ) : null}
        </ol>
      </nav>

      <button
        type="button"
        onClick={() => setPaletteOpen(true)}
        className={cn(
          'flex h-7 items-center gap-2 rounded-md border border-line bg-surface px-2.5',
          'text-[13px] text-tertiary',
          'transition-colors duration-(--duration-micro) hover:text-secondary',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
        )}
      >
        <Search className="size-3.5" aria-hidden="true" />
        <span>Search</span>
        {/* The shortcut is shown, not hidden: a palette nobody knows about is a
            palette nobody uses. */}
        <kbd className="font-mono text-[11px] text-tertiary">⌘K</kbd>
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
