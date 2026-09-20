import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Where the glass material is allowed, and what it owes when it is used.
 *
 * DESIGN.md §5.6 states both halves and, until this file, enforced neither.
 * The rule most worth a test is the second one: **a translucent surface must
 * state its opaque fallback.** `prefers-reduced-transparency` has no global
 * escape hatch the way reduced motion does — nothing can guess the right
 * background for an arbitrary surface — so a surface that forgets is not
 * degraded, it is unreadable for the reader who asked for it.
 *
 * The first half is enforced by listing the files that may use it. That list is
 * short on purpose: a material available everywhere is a background, and §5.6
 * exists to stop the dashboard becoming one.
 */

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.tsx?$/.test(entry.name) && !entry.name.includes('.test.')
      ? [path]
      : [];
  });
}

const FILES = sources(SRC).map((path) => ({
  path: path.slice(SRC.length + 1).replace(/\\/g, '/'),
  text: readFileSync(path, 'utf8'),
}));

const usesGlass = FILES.filter((f) => f.text.includes('backdrop-blur-glass'));

/** The surfaces §5.6 permits. Anything else using glass is a review question. */
const PERMITTED = [
  'primitives/menu.tsx',
  'primitives/dialog.tsx',
  'patterns/command-palette.tsx',
];

describe('glass', () => {
  it('scans the source it is meant to guard', () => {
    // A path change that silently empties this list would pass every
    // assertion below, which is the failure this guard exists for.
    expect(FILES.length).toBeGreaterThan(15);
    expect(usesGlass.length).toBeGreaterThan(0);
  });

  it.each(usesGlass.map((f) => f.path))(
    '%s states an opaque fallback for reduced transparency',
    (path) => {
      const file = usesGlass.find((f) => f.path === path);
      expect(
        file?.text,
        `${path} blurs its backdrop but never sets reduced-transparency:bg-*`,
      ).toMatch(/reduced-transparency:bg-/);
      expect(
        file?.text,
        `${path} must also drop the blur, not only repaint the ground`,
      ).toContain('reduced-transparency:backdrop-blur-none');
    },
  );

  it('is used only on surfaces that sit over content', () => {
    /*
     * Glass means something because you can see what it covers. On a card or a
     * table there is nothing behind it, so the effect is a tint and the cost is
     * a repaint. §5.6 lists popovers, menus, the command palette, sheets,
     * toasts and floating controls; this is that list, in code.
     */
    const unexpected = usesGlass
      .map((f) => f.path)
      .filter((p) => !PERMITTED.includes(p));
    expect(
      unexpected,
      'glass outside the surfaces DESIGN.md §5.6 permits',
    ).toEqual([]);
  });

  it('leaves the tooltip solid', () => {
    /*
     * A decision, not an oversight. §5.6 does not list tooltips, and a tooltip
     * is small, high-frequency and carries 13px text — blurring it spends GPU
     * on every hover to make a label harder to read.
     */
    const menu = FILES.find((f) => f.path === 'primitives/menu.tsx');
    const tooltip = menu?.text.slice(
      menu.text.indexOf('export function TooltipContent'),
    );
    expect(tooltip).toBeTruthy();
    expect(tooltip, 'TooltipContent must stay opaque').not.toContain(
      'bg-glass',
    );
  });

  it('never reaches for a shadow the token layer refuses to define', () => {
    // §5.6 has no --glass-shadow, so no component may invent one by name.
    for (const file of FILES) {
      expect(file.text, `${file.path}`).not.toContain('shadow-glass');
    }
  });
});
