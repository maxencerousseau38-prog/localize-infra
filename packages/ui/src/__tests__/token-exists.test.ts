import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * That every colour class names a token the build actually emits.
 *
 * `border-ambiguous-border` was written in six places across three files,
 * including `ErrorState`, which ships. The token does not exist: `tokens.css`
 * defines `--color-ambiguous`, `--color-ambiguous-bg` and
 * `--color-ambiguous-text`, and nothing called `--color-ambiguous-border`.
 *
 * Nothing caught it, and nothing could have. A Tailwind class naming a token
 * that does not exist is not an error — it is simply not emitted, so the class
 * lands in the HTML and matches no rule. The `border` utility beside it still
 * sets a 1px width, and Tailwind's reset declares `border: 0 solid`, which
 * leaves `border-color` at its initial value of `currentColor`. So those boxes
 * drew a border in the inherited *text* colour: near-black on a tinted
 * background in light mode, near-white in dark. Heavier than intended, present,
 * and plausible enough that six reviews passed it.
 *
 * This is the failure mode a design system is least equipped to see: not a
 * wrong value, an absent one. Contrast tests check the tokens that exist. The
 * type-scale test checks sizes that are used. Neither can notice a name nobody
 * defined.
 *
 * So the check runs the other way — from the classes back to the token file.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../../..');
const TOKENS = readFileSync(join(HERE, '../styles/tokens.css'), 'utf8');

const ROOTS = [
  join(ROOT, 'apps/web/src'),
  join(ROOT, 'apps/site/src'),
  join(ROOT, 'packages/ui/src'),
];

function sources(dir: string): { path: string; text: string }[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    if (!/\.tsx$/.test(entry.name) || entry.name.includes('.test.')) return [];
    return [
      {
        path: path.slice(ROOT.length + 1).replace(/\\/g, '/'),
        text: readFileSync(path, 'utf8'),
      },
    ];
  });
}

const FILES = ROOTS.flatMap(sources);

/** Every `--color-*` name `@theme inline` exposes to Tailwind. */
const DEFINED = new Set(
  [...TOKENS.matchAll(/--color-([a-z0-9-]+):/g)].map((m) => m[1] as string),
);

/**
 * The state families, and only those.
 *
 * Scoped deliberately rather than checking every colour utility in the
 * codebase: `bg-white`, `text-inherit`, `border-transparent` and Tailwind's
 * whole default palette are legitimate and would drown the result. These four
 * are where this system's meaning lives (§6.2), they are the ones a reader
 * invents a suffix for, and they are where the bug was.
 *
 * `iris` is not among them, and its absence is the rule rather than an
 * oversight: the hue reaches components only as `ambiguous`. `--color-iris`
 * does not exist, `bg-iris-9` is emitted by nothing, and no file uses one —
 * checked. §6.1 says a component referencing a raw palette value is a defect,
 * so a class that named the hue directly would be wrong even if it rendered.
 *
 * Listing it here was this file's own first mistake, and the self-check below
 * caught it before the guard ran once.
 */
const FAMILIES = ['ambiguous', 'confident', 'degraded', 'failed'];

const PATTERN = new RegExp(
  `\\b(?:bg|text|border|ring|fill|stroke|outline|decoration|from|via|to)-(${FAMILIES.join('|')})((?:-[a-z0-9]+)*)\\b`,
  'g',
);

describe('colour classes', () => {
  it('scans the source it is meant to guard', () => {
    // A path change that emptied this list would pass the assertion below.
    expect(FILES.length).toBeGreaterThan(60);
    expect(DEFINED.size).toBeGreaterThan(20);
    // And the families really are defined, so a typo in FAMILIES cannot make
    // every lookup below vacuously succeed.
    for (const family of FAMILIES) {
      expect(DEFINED, `--color-${family} must exist`).toContain(family);
    }
  });

  it('name a token that tokens.css defines', () => {
    const missing: string[] = [];
    for (const file of FILES) {
      for (const [whole, family, suffix] of file.text.matchAll(PATTERN)) {
        const token = `${family}${suffix ?? ''}`;
        // An opacity modifier (`bg-failed/40`) is Tailwind syntax, not part of
        // the token name, and the regex already stops before the slash.
        if (!DEFINED.has(token)) {
          missing.push(`${file.path}: ${whole} → --color-${token}`);
        }
      }
    }
    expect(
      [...new Set(missing)],
      'these classes name a token nothing defines, so Tailwind emits no rule and the property silently falls back',
    ).toEqual([]);
  });
});
