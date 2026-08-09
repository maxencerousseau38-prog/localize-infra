'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { cn } from '../lib/cn';
import {
  type Theme,
  applyTheme,
  setTheme as persistTheme,
  readTheme,
  subscribeToTheme,
} from './theme';

const OPTIONS: { value: Theme; label: string; Icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
];

/**
 * Three explicit states rather than a light/dark switch: a user whose OS is
 * dark may still want this product light, and a binary toggle silently removes
 * that choice.
 *
 * Built on native radio inputs rather than buttons with `role="radio"`. The
 * native element gives correct radiogroup semantics for free — arrow keys move
 * within the group, Tab moves past it, and screen readers announce "Light,
 * radio button, 1 of 3, selected". Reimplementing that with buttons means
 * hand-rolling roving tabindex and getting it subtly wrong.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system');
  const [mounted, setMounted] = useState(false);
  const name = useId();

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

  return (
    // `fieldset` alone maps to role="group". For a radio-only group,
    // role="radiogroup" is the more precise mapping and is what assistive
    // technology announces, so it is stated explicitly.
    <fieldset
      role="radiogroup"
      aria-label="Colour theme"
      className="inline-flex items-center gap-0.5 rounded-md border border-line bg-surface p-0.5"
    >
      <legend className="sr-only">Colour theme</legend>
      {OPTIONS.map(({ value, label, Icon }) => {
        // Before hydration the stored preference is unknown; showing nothing as
        // selected avoids briefly rendering the wrong state.
        const selected = mounted && theme === value;
        return (
          <div key={value} className="contents">
            <input
              type="radio"
              id={`${name}-${value}`}
              name={name}
              value={value}
              checked={selected}
              onChange={() => select(value)}
              className="peer sr-only"
            />
            <label
              htmlFor={`${name}-${value}`}
              title={label}
              className={cn(
                'inline-flex size-7 cursor-pointer items-center justify-center rounded-[4px]',
                'transition-colors duration-(--duration-micro)',
                'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-1 peer-focus-visible:outline-focus',
                selected
                  ? 'bg-canvas text-primary shadow-e1'
                  : 'text-tertiary hover:text-secondary',
              )}
            >
              {/* pointer-events-none so a click always lands on the label and
                  toggles the input, rather than being swallowed by the icon. */}
              <Icon
                className="pointer-events-none size-3.5"
                aria-hidden="true"
              />
              <span className="sr-only">{label}</span>
            </label>
          </div>
        );
      })}
    </fieldset>
  );
}
