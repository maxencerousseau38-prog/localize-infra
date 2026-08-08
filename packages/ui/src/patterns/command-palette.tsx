'use client';

import type { LucideIcon } from 'lucide-react';
import { Dialog, VisuallyHidden } from 'radix-ui';
import * as React from 'react';
import { cn } from '../lib/cn';
import { fuzzyMatch, highlightRuns } from '../lib/fuzzy';

export interface CommandItem {
  id: string;
  label: string;
  /** Section heading, e.g. "Navigation", "Actions", "Recents". */
  section: string;
  icon?: LucideIcon;
  /** Extra matchable text (aliases, path) that is not displayed. */
  keywords?: string;
  /** Displayed at the end of the row, e.g. `⌘K`. */
  shortcut?: string;
  onSelect: () => void;
}

/**
 * Binds ⌘K / Ctrl+K. The callback should *toggle*, not open: the shortcut that
 * summons the palette is the one a reader reaches for to dismiss it, and a
 * shortcut that only opens leaves them pressing it with nothing happening.
 *
 * Exported separately so an app can own the open state — the palette is also
 * opened from the topbar button.
 */
export function useCommandPaletteHotkey(onToggle: () => void) {
  const handler = React.useRef(onToggle);
  handler.current = onToggle;

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== 'k') return;
      if (!event.metaKey && !event.ctrlKey) return;
      event.preventDefault();
      handler.current();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);
}

/**
 * Command palette (design system §4.6).
 *
 * A combobox over a listbox, not a menu: the reader types into a text field and
 * the list below it is filtered, which is what `aria-activedescendant` is for —
 * focus stays in the input while the active option moves.
 *
 * An empty query shows everything (recents first, by section order), never a
 * blank box: a palette that reveals nothing until you type teaches nobody what
 * it can do.
 */
export function CommandPalette({
  open,
  onOpenChange,
  items,
  placeholder = 'Search or jump to…',
  emptyMessage = 'No matches.',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CommandItem[];
  placeholder?: string;
  emptyMessage?: string;
}) {
  const [query, setQuery] = React.useState('');
  const [activeIndex, setActiveIndex] = React.useState(0);
  const listRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  // Focus restoration is handled here rather than left to Radix. Radix restores
  // to the element that had focus when its content mounted, and in this
  // component that restore lands on <body> — verified by an end-to-end test, not
  // assumed. Owning it also makes the hotkey path correct: the palette can be
  // opened from anywhere, and focus must come back to wherever it was.
  const returnFocusTo = React.useRef<HTMLElement | null>(null);

  const results = React.useMemo(() => {
    const scored = [];
    for (const item of items) {
      const labelMatch = fuzzyMatch(item.label, query);
      // Keywords are matchable but not displayed, so a keyword-only hit
      // highlights nothing — marking label characters it did not match would
      // make the result look arbitrary.
      const match =
        labelMatch ?? (item.keywords ? fuzzyMatch(item.keywords, query) : null);
      if (!match) continue;
      scored.push({
        item,
        score: match.score,
        indices: labelMatch?.indices ?? [],
      });
    }
    return query === '' ? scored : scored.sort((a, b) => b.score - a.score);
  }, [items, query]);

  // Grouped for display, but the active index walks the flat list — that is the
  // order the arrow keys move through.
  const sections = React.useMemo(() => {
    const grouped = new Map<string, typeof results>();
    for (const result of results) {
      const bucket = grouped.get(result.item.section);
      if (bucket) bucket.push(result);
      else grouped.set(result.item.section, [result]);
    }
    return [...grouped.entries()];
  }, [results]);

  const flat = React.useMemo(
    () => sections.flatMap(([, entries]) => entries),
    [sections],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset the cursor whenever the result set changes, not only when its length does.
  React.useEffect(() => setActiveIndex(0), [query]);

  React.useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: activeIndex is the trigger, not a value read in the body — the effect reads the DOM the render it produced.
  React.useEffect(() => {
    // Keeps the active option visible while the arrow keys move it — focus
    // never leaves the input, so the browser will not scroll for us.
    listRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  function select(index: number) {
    const chosen = flat[index]?.item;
    if (!chosen) return;
    onOpenChange(false);
    chosen.onSelect();
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((i) => (flat.length === 0 ? 0 : (i + 1) % flat.length));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) =>
        flat.length === 0 ? 0 : (i - 1 + flat.length) % flat.length,
      );
    } else if (event.key === 'Enter') {
      event.preventDefault();
      select(activeIndex);
    }
    // Esc is handled by Radix; focus restoration is handled in
    // onCloseAutoFocus above.
  }

  let cursor = -1;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            'fixed inset-0 z-50 bg-overlay',
            'data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out',
          )}
        />
        <Dialog.Content
          // The visually hidden Title below is the accessible name. An
          // aria-label here would silently override it, leaving two sources of
          // truth. aria-describedby opts out of Radix's Description requirement
          // — a palette needs no prose explanation.
          aria-describedby={undefined}
          className={cn(
            'fixed left-1/2 top-[20vh] z-50 w-[calc(100vw-2rem)] max-w-[40rem]',
            '-translate-x-1/2 overflow-hidden rounded-lg border border-line',
            'bg-canvas shadow-e3',
            'data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out',
          )}
          onOpenAutoFocus={(event) => {
            // Runs before focus moves, so this is the last moment the opener is
            // still the active element.
            returnFocusTo.current =
              document.activeElement as HTMLElement | null;
            // Focus the input, not the dialog: the reader is here to type.
            event.preventDefault();
            inputRef.current?.focus();
          }}
          onCloseAutoFocus={(event) => {
            const target = returnFocusTo.current;
            returnFocusTo.current = null;
            // Nothing to restore to when the palette was opened by the hotkey
            // from a page with no focused control — let Radix do as it will
            // rather than force focus somewhere arbitrary.
            if (!target || target === document.body) return;
            event.preventDefault();
            target.focus();
          }}
        >
          <VisuallyHidden.Root>
            <Dialog.Title>Command palette</Dialog.Title>
          </VisuallyHidden.Root>

          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={flat.length > 0}
            aria-controls="command-palette-list"
            aria-activedescendant={
              flat[activeIndex]
                ? `command-${flat[activeIndex].item.id}`
                : undefined
            }
            aria-autocomplete="list"
            autoComplete="off"
            placeholder={placeholder}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            className={cn(
              'h-12 w-full border-b border-subtle bg-transparent px-4',
              'text-subtitle text-primary outline-none placeholder:text-tertiary',
            )}
          />

          {/* biome-ignore lint/a11y/useFocusableInteractive: the ARIA combobox pattern keeps focus on the input; the listbox and its options are addressed by aria-activedescendant and must NOT be tabbable. */}
          <div
            ref={listRef}
            id="command-palette-list"
            // biome-ignore lint/a11y/useSemanticElements: a native <select> cannot host grouped, icon-bearing rows driven by a separate text input.
            role="listbox"
            aria-label="Results"
            className="max-h-[26rem] overflow-y-auto p-2 empty:hidden"
          >
            {/* A listbox may only own `option` and `group` elements, so each
                section is a real group and the empty message lives outside the
                listbox entirely. Neither is something axe checks. */}
            {sections.map(([section, entries]) => (
              <div
                key={section}
                // biome-ignore lint/a11y/useSemanticElements: <fieldset> groups form controls; this groups listbox options, where `group` is the only role a listbox may own besides `option`.
                role="group"
                aria-label={section}
                className="mb-1 last:mb-0"
              >
                <p
                  // The heading is presentational: the option's accessible
                  // name already reads its own label, and a listbox may not
                  // contain arbitrary text nodes as children.
                  aria-hidden="true"
                  className="px-2 py-1.5 text-micro font-medium uppercase tracking-wide text-tertiary"
                >
                  {section}
                </p>
                {entries.map(({ item, indices }) => {
                  cursor += 1;
                  const index = cursor;
                  const Icon = item.icon;
                  const active = index === activeIndex;
                  return (
                    // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard interaction lives on the combobox input, per the ARIA combobox pattern.
                    // biome-ignore lint/a11y/useFocusableInteractive: options in an aria-activedescendant combobox are deliberately not tabbable.
                    <div
                      key={item.id}
                      id={`command-${item.id}`}
                      // biome-ignore lint/a11y/useSemanticElements: an <option> element is only valid inside <select>, which cannot render this content.
                      role="option"
                      aria-selected={active}
                      data-active={active}
                      onClick={() => select(index)}
                      onMouseMove={() => setActiveIndex(index)}
                      className={cn(
                        'flex cursor-pointer items-center gap-2.5 rounded-[4px] px-2 py-2',
                        'text-body leading-5 text-primary',
                        active && 'bg-surface',
                      )}
                    >
                      {Icon ? (
                        <Icon
                          className="size-4 shrink-0 text-tertiary"
                          aria-hidden="true"
                        />
                      ) : null}
                      <span className="min-w-0 flex-1 truncate">
                        {highlightRuns(item.label, indices).map((run, i) => (
                          <span
                            // biome-ignore lint/suspicious/noArrayIndexKey: runs are positional slices of one string; there is no other stable identity.
                            key={i}
                            className={
                              run.matched ? 'font-semibold' : undefined
                            }
                          >
                            {run.text}
                          </span>
                        ))}
                      </span>
                      {item.shortcut ? (
                        <span className="shrink-0 font-mono text-caption text-tertiary">
                          {item.shortcut}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <output className="block px-2 py-6 text-center text-body text-tertiary empty:hidden empty:p-0">
            {flat.length === 0 ? emptyMessage : ''}
          </output>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
