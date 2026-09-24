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
function scale(selector: ':root' | '.dark' | '.oled'): Map<string, string> {
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
/*
 * OLED is `.dark` with the ground replaced, because that is literally how it is
 * applied: `applyTheme('oled')` sets both classes, so the cascade a reader sees
 * is dark's scale overridden by oled's. Testing `.oled` alone would test a
 * scheme nobody can select and would report every inherited state colour as
 * missing. DESIGN.md §6.4.
 */
const oled = new Map([...dark, ...scale('.oled')]);

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
  ['oled', oled],
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

  it('defines no token in oled that dark does not already define', () => {
    /*
     * The other direction from the check above, and it catches a different
     * mistake: a name that exists only in `.oled` is a typo, because oled
     * overrides an existing ground rather than inventing one. It would render
     * as an unresolved var() in dark and be invisible until somebody switched.
     */
    const onlyInOled = [...scale('.oled').keys()].filter((k) => !dark.has(k));
    expect(onlyInOled, 'tokens defined in .oled but not in .dark').toEqual([]);
  });

  it('gives oled a genuinely darker ground than dark', () => {
    // Otherwise the scheme is a rename. Canvas must actually be black.
    expect(oled.get('graphite-1')).toBe('#000000');
    expect(luminance(oled.get('graphite-1') as string)).toBeLessThan(
      luminance(dark.get('graphite-1') as string),
    );
  });

  it('leaves every state colour to the dark scale', () => {
    /*
     * The rule that makes oled cheap: it overrides the ground and nothing
     * else, so a badge means the same thing in both dark schemes. A state hue
     * appearing here is the start of two palettes.
     */
    const stateish = [...scale('.oled').keys()].filter((k) =>
      /^(iris|jade|amber|crimson|azure)-/.test(k),
    );
    expect(stateish, 'oled must not redefine a state hue').toEqual([]);
  });

  it('uses no full-width or non-ASCII characters in hex values', () => {
    // A full-width digit inside a hex value is invisible in review and silently
    // breaks the colour. This caught a real typo during implementation.
    for (const [, hex] of TOKENS.matchAll(/:\s*(#[^\s;]+)\s*;/g)) {
      expect(hex).toMatch(/^#[0-9a-fA-F]{3,8}$/);
    }
  });
});

describe('glass', () => {
  /** Every `--glass-*` declaration in the file, with the selector it sits in. */
  function glassIn(selector: string): string[] {
    const blocks = TOKENS.split(/(?=^[.:][a-z]+\s*\{)/m).filter((b) =>
      b.trimStart().startsWith(selector),
    );
    return [
      ...new Set(
        blocks.flatMap((b) =>
          [...b.matchAll(/--(glass-[a-z-]+):/g)].map((m) => m[1] as string),
        ),
      ),
    ].sort();
  }

  it('defines exactly the three tokens the contract allows', () => {
    expect(glassIn(':root')).toEqual([
      'glass-bg',
      'glass-blur',
      'glass-border',
    ]);
  });

  it('has no shadow token, which is the rule rather than an omission', () => {
    /*
     * DESIGN.md §5.2 and §5.6: borders do the work on glass, shadows stay for
     * overlays. A panel that blurs *and* casts a shadow asks two materials to
     * do one job, and the shadow is the half that reads as a template. This
     * was proposed and rejected; the test is what stops it returning quietly.
     */
    // The *declaration*, not the string: the token file documents this absence
    // in a comment, and the first version of this assertion matched that
    // comment and failed. A rule explaining itself must not trip its own test.
    expect(TOKENS).not.toMatch(/--glass-shadow\s*:/);
  });

  it('adapts the material to each dark scheme rather than assuming one', () => {
    // A single hard-coded translucency would be wrong in at least two of the
    // three schemes — over white it would be a grey film.
    expect(glassIn('.dark')).toContain('glass-bg');
    expect(glassIn('.oled')).toContain('glass-bg');
  });

  it('derives the material from the neutral scale, never from a literal', () => {
    // Same rule as every other token: layer 2 references layer 1. A literal
    // here would freeze the material to whichever scheme it was written for.
    for (const [, value] of TOKENS.matchAll(
      /--glass-(?:bg|border):\s*([^;]+);/g,
    )) {
      expect(value, `--glass-* must reference the palette: ${value}`).toContain(
        'var(--graphite-',
      );
    }
  });

  it('exposes the blur as a token so no component writes a radius', () => {
    // `--blur-glass` in @theme inline generates `backdrop-blur-glass`.
    expect(TOKENS).toContain('--blur-glass: var(--glass-blur)');
  });
});

describe('borders on OLED', () => {
  /**
   * Which graphite step a semantic border token resolves to, per scheme.
   *
   * `scale()` above only captures hex declarations, and every border token is
   * `var(--graphite-N)` — so this reads the reference instead. That is the
   * point of the token layering (§6.1) and the reason this check exists at all:
   * the value never appears in the semantic layer, so nothing that compares
   * hexes can see a scheme weakening one.
   */
  function borderStep(
    selector: ':root' | '.oled',
    name: string,
  ): string | null {
    const blocks = TOKENS.split(/(?=^[.:][a-z]+\s*\{)/m).filter((b) =>
      b.trimStart().startsWith(selector),
    );
    let step: string | null = null;
    for (const block of blocks) {
      // `String.raw`, because the escapes matter: written as a plain template
      // literal, `\s` is the letter s and `\d` the letter d, and the pattern
      // silently matches nothing at all rather than failing to compile.
      const found = block.match(
        new RegExp(String.raw`--${name}:\s*var\(--(graphite-\d+)\)`),
      );
      if (found) step = found[1] as string;
    }
    return step;
  }

  /** The contrast a border draws against its own scheme's canvas. */
  function separatorRatio(tokens: Map<string, string>, step: string): number {
    const canvas = tokens.get('graphite-1');
    const border = tokens.get(step);
    expect(canvas, 'canvas must resolve').toBeDefined();
    expect(border, `${step} must resolve`).toBeDefined();
    return contrast(border as string, canvas as string);
  }

  it('reads the reference, not a hex, so the check is possible at all', () => {
    // Guards the regex: a renamed token would otherwise leave every assertion
    // below comparing null to null and passing.
    expect(borderStep(':root', 'border-subtle')).toMatch(/^graphite-\d+$/);
    expect(borderStep('.oled', 'border-subtle')).toMatch(/^graphite-\d+$/);
  });

  /**
   * How close OLED has to get to dark, and why the number is 0.92.
   *
   * It was chosen from the measurements, not picked and then justified — which
   * matters, because a threshold set after seeing the answer is a threshold
   * that proves nothing. The four readings, as ratios of dark's contrast:
   *
   * | token            | corrected | left inherited |
   * |------------------|-----------|----------------|
   * | `border-subtle`  | 0.961     | 0.907          |
   * | `border-default` | 0.947     | 0.825          |
   *
   * So a bar has to sit above 0.907 — or reverting `border-subtle` would pass
   * — and at or below 0.947, or the correction to `border-default` would fail.
   * 0.92 is inside that window with room on both sides. The window exists at
   * all because the neutral scale has twelve fixed steps and neither token
   * lands on an exact match; 0.947 is the closest the scale offers, not a
   * compromise someone accepted.
   */
  const PARITY = 0.92;

  it.each([['border-subtle'], ['border-default']])(
    '%s is as visible on OLED as it is in dark',
    (token) => {
      /*
       * §6.4 gives elevation to surface lightness *and* border. OLED compresses
       * the first — #000000, #050505, #0a0a0a — so the border carries more, on
       * the ground where it has least to work with.
       *
       * A ratio against dark, not an absolute threshold: 3:1 is for a boundary
       * that carries meaning, and these are a row separator and a component
       * edge (§5.2). Holding them to the boundary rule would turn every table
       * into a grid.
       */
      const base = borderStep(':root', token) as string;
      const oledStep = borderStep('.oled', token) ?? base;
      const inDark = separatorRatio(dark, base);
      const inOled = separatorRatio(oled, oledStep);
      expect(
        inOled,
        `${token} reads ${inOled.toFixed(2)} on OLED against ${inDark.toFixed(2)} in dark — ${(inOled / inDark).toFixed(3)} of it`,
      ).toBeGreaterThanOrEqual(inDark * PARITY);
    },
  );

  it('keeps the three border steps distinct on OLED', () => {
    /*
     * §5.2 has three border roles, and the cheap way to hit the parity bar
     * above is to promote each token to the next role's step — which would
     * leave OLED with subtle == default == strong and a scale that has lost its
     * shape in one scheme only.
     *
     * `StateRule` makes that concrete: it paints neutral with `--border-default`
     * and its own emphasis with `--border-strong`, so collapsing the two would
     * erase the difference between "no claim" and "look here" on the signature
     * element itself.
     */
    const steps = ['border-subtle', 'border-default', 'border-strong'].map(
      (token) =>
        borderStep('.oled', token) ?? (borderStep(':root', token) as string),
    );
    expect(new Set(steps).size, `OLED border steps: ${steps.join(' < ')}`).toBe(
      3,
    );
  });
});
