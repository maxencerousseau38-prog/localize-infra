import { readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * That the shadcn shell stays on DESIGN.md's values.
 *
 * These components arrive from a generator. `globals.css` already bridges their
 * token *names* onto this product's palette, which is what keeps a shadcn
 * Sidebar graphite instead of blue — but the bridge cannot touch the numbers
 * baked into their class strings, and the generated defaults disagreed with the
 * contract in five places. The mobile sidebar animated at 500ms against a 200ms
 * budget; a button and an input carried shadows on a system where shadows are
 * for overlays; radii arrived as `rounded-[2px]` and `rounded-xs`, neither of
 * which exists in §5.1.
 *
 * Every one of those is restored, silently, by re-running `npx shadcn add` on
 * the component. That is the whole reason this file exists: the fix is a diff
 * somebody made once, and the generator is a command somebody runs later
 * without reading its output.
 *
 * Scoped to `components/ui` deliberately. `packages/ui` has its own guards —
 * `type-scale`, `glass`, `contrast`, `alert`, `toast` — and this is the one
 * directory in the repository whose contents are written by a tool.
 */

const SHELL = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../components/ui',
);

/**
 * Comments stripped before matching, and the reason is not tidiness.
 *
 * Each fix below is explained in a comment that quotes the value it replaced,
 * so a check reading the raw file matches its own explanation and reports the
 * defect it just fixed. That has now happened three times in this repository —
 * `--glass-shadow`, `role="alert"`, and the first run of this very check, which
 * reported `duration-500` and `shadow-lg` still present in a file where neither
 * survives outside prose.
 */
const strip = (text: string): string =>
  text
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');

const FILES = readdirSync(SHELL)
  .filter((name) => name.endsWith('.tsx'))
  .map((name) => ({
    name: basename(name, '.tsx'),
    code: strip(readFileSync(join(SHELL, name), 'utf8')),
  }));

/** Every duration utility the contract prices, §7.1. */
const DURATIONS = ['micro', 'standard', 'emphasis', '200'];

/** Every radius §5.1 names. `full` is permitted on avatars and dots. */
const RADII = ['sm', 'md', 'lg', 'xl', 'full', 'none'];

describe('the shadcn shell', () => {
  it('scans the directory it is meant to guard', () => {
    // A generator that renamed the directory would otherwise leave every
    // assertion below passing against nothing.
    expect(FILES.length).toBeGreaterThan(5);
    expect(FILES.map((f) => f.name)).toContain('sheet');
  });

  it.each(FILES.map((f) => f.name))(
    '%s spends no motion over 200ms',
    (name) => {
      const file = FILES.find((f) => f.name === name);
      const used = [...(file?.code.matchAll(/\bduration-([a-z0-9]+)\b/g) ?? [])]
        .map((m) => m[1] as string)
        .filter((value) => !DURATIONS.includes(value));
      expect(
        used,
        `§7.1 caps every transition at 200ms and names three tokens; duration-${used[0]} is neither`,
      ).toEqual([]);
    },
  );

  it.each(FILES.map((f) => f.name))('%s uses the contract easing', (name) => {
    // §7.1 fixes the curve at cubic-bezier(0.2, 0, 0, 1) — `ease-standard`.
    // `ease-linear` is left alone: the sidebar's width transition is a
    // geometric slide where a curve reads as a stutter.
    const file = FILES.find((f) => f.name === name);
    expect(file?.code).not.toMatch(/\bease-(in|out|in-out)\b/);
  });

  it.each(FILES.map((f) => f.name))('%s keeps shadows for overlays', (name) => {
    /*
     * §5.2: borders do the work, shadows are for overlays. Tailwind's own
     * scale is the tell — a component reaching for `shadow-xs` is decorating,
     * because the three shadows this system has are called e1, e2 and e3 and a
     * generator has never heard of them.
     */
    const file = FILES.find((f) => f.name === name);
    const used = [
      ...(file?.code.matchAll(/\bshadow-(2xs|xs|sm|md|lg|xl|2xl)\b/g) ?? []),
    ].map((m) => m[0] as string);
    expect(
      used,
      `${used[0]} is not on the e1/e2/e3 scale — and on a non-overlay the answer is no shadow at all`,
    ).toEqual([]);
  });

  it.each(FILES.map((f) => f.name))('%s rounds to a token', (name) => {
    const file = FILES.find((f) => f.name === name);
    const arbitrary = [
      ...(file?.code.matchAll(/\brounded(?:-[a-z]+)?-\[[^\]]+\]/g) ?? []),
    ].map((m) => m[0] as string);
    expect(arbitrary, '§16: a value absent from DESIGN.md').toEqual([]);

    const named = [...(file?.code.matchAll(/\brounded-([a-z0-9]+)\b/g) ?? [])]
      .map((m) => m[1] as string)
      .filter((value) => !RADII.includes(value));
    expect(
      named,
      `rounded-${named[0]} is Tailwind's default surviving — tokens.css extends the radius namespace, it does not replace it`,
    ).toEqual([]);
  });

  it('never paints a background with a text token', () => {
    /*
     * `--color-secondary` means `--text-secondary` here. shadcn's
     * `bg-secondary` therefore fills a surface with body-copy grey, which is
     * the mirror of the bug `globals.css` records in its own comment: it found
     * the collision from the other side, when defining --color-secondary as a
     * background turned every `text-secondary` in the application near-white.
     *
     * Both instances are fixed. This is what stops the third arriving.
     */
    const offenders = FILES.filter((f) => /\bbg-secondary\b/.test(f.code)).map(
      (f) => f.name,
    );
    expect(
      offenders,
      'bg-secondary resolves to a text colour in this application; --secondary is bg-surface',
    ).toEqual([]);
  });
});
