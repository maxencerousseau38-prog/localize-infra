'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '../lib/cn';
import {
  MenuContent,
  MenuRadioGroup,
  MenuRadioItem,
  MenuRoot,
  MenuTrigger,
} from '../primitives/menu';
import {
  type Theme,
  applyTheme,
  setTheme as persistTheme,
  readTheme,
  subscribeToTheme,
} from './theme';

type Option = { value: Theme; label: string; Icon: typeof Sun };

/** Named rather than reached for by index, so the fallback below is total. */
const SYSTEM: Option = { value: 'system', label: 'System', Icon: Monitor };

const OPTIONS: Option[] = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  SYSTEM,
];

/**
 * Three explicit states rather than a light/dark switch: a user whose OS is
 * dark may still want this product light, and a binary toggle silently removes
 * that choice. That has not changed — what changed is how much room the three
 * states are allowed to take.
 *
 * This shipped as a three-segment radiogroup pinned to the topbar of every
 * page, which DESIGN.md §9 named as an open defect in its own words: a
 * settings-level concern wearing navigation-level prominence, on the most
 * expensive real estate in the product, while no surface offers a global
 * primary action at all. Chrome is ranked by frequency of use, and a control
 * most people touch once outranked the work on every screen forever.
 *
 * It is now one 28px control that shows the current choice and opens the same
 * three options. All three survive; the cost falls from three segments to one.
 * Radix's radio group supplies `menuitemradio`, roving tabindex and type-ahead
 * — the same reasoning that put the old version on native radio inputs rather
 * than hand-rolled buttons, applied to a menu.
 *
 * The trigger carries the current theme in its accessible name rather than
 * only in its icon, because the menu's items do not exist in the DOM while it
 * is closed. Another surface — the command palette — can change the
 * preference, and the trigger has to be able to report that on its own.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setTheme(readTheme());
    // Another surface — the command palette — can change the preference too.
    return subscribeToTheme(setTheme);
  }, []);

  // Follow the OS while in system mode, so the page updates if the user changes
  // their preference in another window.
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  function select(next: Theme) {
    setTheme(next);
    persistTheme(next);
  }

  // Before hydration the stored preference is unknown. `system` is the default
  // the theme script assumes, so rendering its icon is the honest placeholder
  // rather than briefly showing a state the user did not choose.
  const current = OPTIONS.find((o) => o.value === theme) ?? SYSTEM;
  const Icon = mounted ? current.Icon : Monitor;

  return (
    <MenuRoot>
      <MenuTrigger
        aria-label={mounted ? `Colour theme: ${current.label}` : 'Colour theme'}
        className={cn(
          'inline-flex size-7 items-center justify-center rounded-md',
          'border border-line bg-surface text-tertiary',
          'transition-colors duration-(--duration-micro)',
          'hover:text-secondary active:bg-raised',
          'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus',
          'data-[state=open]:bg-raised data-[state=open]:text-primary',
        )}
      >
        <Icon className="size-3.5" aria-hidden="true" />
      </MenuTrigger>

      <MenuContent align="end" className="min-w-[9rem]">
        <MenuRadioGroup
          value={theme}
          onValueChange={(next) => select(next as Theme)}
        >
          {OPTIONS.map(({ value, label, Icon: OptionIcon }) => (
            <MenuRadioItem key={value} value={value}>
              <OptionIcon aria-hidden="true" />
              {label}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuContent>
    </MenuRoot>
  );
}
