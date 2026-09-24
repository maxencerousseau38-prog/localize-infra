import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * That the command palette offers every colour scheme the toggle does.
 *
 * These two controls sit a few pixels apart in the same topbar, and they
 * disagreed: `ThemeToggle` has offered four schemes since OLED shipped, the
 * palette offered three. The one it omitted was the newest, which is the one a
 * reader is least likely to know exists — so the scheme was reachable only by
 * finding a small icon button, on a surface whose own design document calls the
 * palette the primary navigation.
 *
 * Nothing could have caught it. Both lists are hand-written arrays of objects,
 * neither imports the other, and adding a scheme to `packages/ui` compiles
 * perfectly without touching `apps/web`. A type cannot help either: `setTheme`
 * takes a `Theme`, and calling it three times out of four is not a type error.
 *
 * So the check compares the two lists directly. It is the only thing that
 * turns "somebody must remember" into "the build remembers".
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const TOPBAR = readFileSync(
  join(HERE, '../../components/app-topbar.tsx'),
  'utf8',
);
const THEME = readFileSync(
  join(HERE, '../../../../../packages/ui/src/theme/theme.ts'),
  'utf8',
);

/** The `Theme` union, read from its declaration rather than duplicated here. */
function themes(): string[] {
  const union = THEME.match(/export type Theme =([^;]+);/);
  expect(union?.[1], 'the Theme union must be readable').toBeTruthy();
  return [...(union?.[1] ?? '').matchAll(/'([a-z]+)'/g)].map(
    (m) => m[1] as string,
  );
}

describe('the theme commands', () => {
  it('reads the union it is meant to compare against', () => {
    // A renamed type would otherwise leave the assertion below comparing an
    // empty list to an empty list, which passes and proves nothing.
    const all = themes();
    expect(all.length).toBeGreaterThanOrEqual(4);
    expect(all).toContain('oled');
    expect(all).toContain('system');
  });

  it('offers one palette command per scheme', () => {
    const missing = themes().filter(
      (theme) => !TOPBAR.includes(`setTheme('${theme}')`),
    );
    expect(
      missing,
      'the command palette does not offer these schemes, and ThemeToggle does',
    ).toEqual([]);
  });

  it('gives OLED the same icon in both controls', () => {
    /*
     * Not cosmetic. The toggle and the palette are two doors to one setting; a
     * reader who learns the glyph in one place should recognise it in the
     * other. `Contrast` is what `theme-toggle.tsx` uses.
     */
    const toggle = readFileSync(
      join(HERE, '../../../../../packages/ui/src/theme/theme-toggle.tsx'),
      'utf8',
    );
    const icon = toggle.match(/value: 'oled'[^}]*Icon: (\w+)/)?.[1];
    expect(icon, 'ThemeToggle must name an icon for oled').toBeTruthy();
    expect(TOPBAR).toMatch(
      new RegExp(String.raw`id: 'theme-oled'[\s\S]{0,200}icon: ${icon}`),
    );
  });
});
