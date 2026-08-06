import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Machine-verified colour contrast.
 *
 * docs/design/05-design-system.md §5 requires "every token pair machine-verified
 * in CI, not eyeballed". This is that check. It parses the real token file — not
 * a duplicated copy of the values — so a palette change that drops a pair below
 * threshold fails the build, in the same spirit as the existing 99.5%
 * placeholder/ICU gate on the translation pipeline.
 *
 * Thresholds are WCAG 2.2 AA: 4.5:1 for body text, 3:1 for large text, UI
 * boundaries and focus indicators.
 */

const TOKENS = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../styles/tokens.css'),
  'utf-8',
);

/** Extract a `--name: #hex;` declaration from a given selector block. */
function scale(selector: ':root' | '.dark'): Map<string, string> {
  const found = new Map<string, string>();
  // Both selectors appear more than once in the file (raw palette, then
  // semantic aliases), so every matching block is scanned.
  const blocks = TOKENS.split(/(?=^[.:][a-z]+\s*\{)/m).filter((b) =>
    b.trimStart().startsWith(selector),
  );
  for (const block of blocks) {
    for (const [, name, hex] of block.matchAll(
      /--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g,
    )) {
      if (name && hex) found.set(name, hex);
    }
  }
  return found;
}

function luminance(hex: string): number {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const r = channel(Number.parseInt(hex.slice(1, 3), 16));
  const g = channel(Number.parseInt(hex.slice(3, 5), 16));
  const b = channel(Number.parseInt(hex.slice(5, 7), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (hi + 0.05) / (lo + 0.05);
}

const light = scale(':root');
const dark = scale('.dark');

/** [foreground, background, minimum ratio, description] */
const PAIRS: [string, string, number, string][] = [
  ['graphite-12', 'graphite-1', 4.5, 'primary text on canvas'],
  ['graphite-11', 'graphite-1', 4.5, 'secondary text on canvas'],
  ['graphite-9', 'graphite-1', 4.5, 'tertiary text on canvas'],
  ['graphite-12', 'graphite-2', 4.5, 'primary text on surface'],
  ['graphite-11', 'graphite-2', 4.5, 'secondary text on surface'],
  ['iris-9', 'graphite-1', 3, 'focus ring / ambiguity solid on canvas'],
  ['iris-11', 'iris-3', 4.5, 'ambiguity text on its own background'],
  ['jade-11', 'jade-3', 4.5, 'confident text on its own background'],
  ['amber-11', 'amber-3', 4.5, 'degraded text on its own background'],
  ['crimson-11', 'crimson-3', 4.5, 'failed text on its own background'],
  ['azure-9', 'graphite-1', 4.5, 'link on canvas'],
  ['graphite-8', 'graphite-1', 3, 'strong border on canvas'],
];

describe.each([
  ['light', light],
  ['dark', dark],
])('%s theme contrast', (themeName, tokens) => {
  it('parsed the token file', () => {
    // Guards against a silent regex failure quietly passing every assertion.
    expect(tokens.size).toBeGreaterThan(50);
  });

  it.each(PAIRS)('%s on %s meets %s:1 (%s)', (fg, bg, min, _description) => {
    const fgHex = tokens.get(fg);
    const bgHex = tokens.get(bg);
    expect(fgHex, `missing token --${fg} in ${themeName}`).toBeDefined();
    expect(bgHex, `missing token --${bg} in ${themeName}`).toBeDefined();

    const ratio = contrast(fgHex as string, bgHex as string);
    expect(
      Number(ratio.toFixed(2)),
      `--${fg} (${fgHex}) on --${bg} (${bgHex}) is ${ratio.toFixed(2)}:1, needs ${min}:1`,
    ).toBeGreaterThanOrEqual(min);
  });
});

describe('palette integrity', () => {
  it('defines the same token names in both themes', () => {
    // A token present in one theme but not the other renders as an unresolved
    // var() — usually invisible text — so the two scales must stay in lockstep.
    const missingInDark = [...light.keys()].filter((k) => !dark.has(k));
    expect(missingInDark, 'tokens missing from .dark').toEqual([]);
  });

  it('uses no full-width or non-ASCII characters in hex values', () => {
    // A full-width digit inside a hex value is invisible in review and silently
    // breaks the colour. This caught a real typo during implementation.
    for (const [, hex] of TOKENS.matchAll(/:\s*(#[^\s;]+)\s*;/g)) {
      expect(hex).toMatch(/^#[0-9a-fA-F]{3,8}$/);
    }
  });
});
