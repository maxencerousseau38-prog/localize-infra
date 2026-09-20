import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * That the toast stays the exception it was introduced as.
 *
 * A toast library's failure mode is not a bug, it is a habit: once one exists,
 * every action gets one, and a product whose every click throws a card into the
 * corner has made its feedback ignorable. `docs/product/02-ux-and-flows.md`
 * says success is quiet and a toast "never confirms the obvious"; DESIGN.md
 * §7.2 names the ambiguity row's collapse as the feedback for that action. Both
 * are prose, and prose does not stop the second caller.
 *
 * So the callers are listed, the way `glass.test.ts` lists the surfaces glass
 * is permitted on. Adding one is a deliberate edit with a reviewer, which is
 * the whole point.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../../..');
const SOURCE = readFileSync(join(HERE, '../primitives/toast.tsx'), 'utf8');

/** The component's code with its prose removed — see `alert.test.ts`. */
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

function sources(dir: string): { path: string; text: string }[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    if (!/\.tsx?$/.test(entry.name) || entry.name.includes('.test.')) return [];
    return [
      {
        path: path.slice(ROOT.length + 1).replace(/\\/g, '/'),
        text: readFileSync(path, 'utf8'),
      },
    ];
  });
}

const APP = sources(join(ROOT, 'apps/web/src'));

/**
 * The one product surface that raises a toast, and the reason is in its own doc
 * comment: `deleteProject` redirects, so the surface that could have said it
 * inline is gone by the time the result exists.
 */
const PRODUCT_CONSUMERS = ['apps/web/src/app/[org]/projects/deleted-toast.tsx'];

/**
 * The gallery, kept separate on purpose.
 *
 * `/design` renders the library so a person can look at it, which is the only
 * way to see this component without deleting a project. Folding it into the
 * list above would let the guard read "two consumers" and stop meaning what it
 * says — the number that matters is how many places the *product* speaks.
 */
const DEMOS = ['apps/web/src/components/design-gallery.tsx'];

const CONSUMERS = [...PRODUCT_CONSUMERS, ...DEMOS];

describe('Toast', () => {
  it('scans the application it is meant to guard', () => {
    // A moved path that emptied this list would pass every assertion below.
    expect(APP.length).toBeGreaterThan(40);
    expect(APP.some((f) => f.text.includes('useToast'))).toBe(true);
  });

  it('is raised only from the surfaces that argued for it', () => {
    const callers = APP.filter((f) => /\buseToast\b/.test(f.text)).map(
      (f) => f.path,
    );
    expect(
      callers.filter((p) => !CONSUMERS.includes(p)),
      'a new toast caller — add it to PRODUCT_CONSUMERS only with the argument for why an inline message cannot carry this result',
    ).toEqual([]);
    // And the listed ones still call it: a consumer that quietly stopped would
    // otherwise leave this test guarding nothing.
    expect(callers.sort()).toEqual([...CONSUMERS].sort());
  });

  it('speaks from exactly one product surface', () => {
    /*
     * The number this file exists to hold. Prose in two product documents says
     * a toast never confirms the obvious, and prose does not stop the second
     * caller — every action acquiring one is how a product's feedback becomes
     * ignorable.
     */
    expect(PRODUCT_CONSUMERS).toHaveLength(1);
  });

  it('never dismisses an error on a timer', () => {
    /*
     * §4.8 of docs/design/05-design-system.md. A message that reports a failure
     * and then removes itself has told the reader something broke and taken
     * away the sentence saying what.
     */
    expect(CODE).toMatch(/error:\s*Number\.POSITIVE_INFINITY/);
  });

  it('passes the no-timer sentinel through instead of omitting the prop', () => {
    /*
     * `Toast.Root` reads `durationProp || context.duration`, so `undefined`
     * inherits the provider's 5s and the error dismisses after all. The bug is
     * invisible in review — the prop is present and the types are satisfied.
     */
    expect(CODE).toMatch(/duration=\{duration\}/);
    expect(CODE).not.toMatch(/duration=\{[^}]*undefined[^}]*\}/);
  });

  it('stacks no more than three', () => {
    // Same section. The cap drops the oldest, which is the one the reader has
    // had longest to read.
    expect(CODE).toMatch(/MAX_STACKED\s*=\s*3\b/);
    expect(CODE).toContain('.slice(-MAX_STACKED)');
  });

  it('takes its colour from the state tones and never from Iris', () => {
    /*
     * §1.4: Iris means "your judgement is required" and nothing else. A message
     * that disappears after four seconds cannot be where a judgement is asked
     * for, so `ambiguous` has no toast. The four public names map onto the
     * existing Tone union rather than starting a second palette.
     */
    const map = CODE.match(/const TONE: Record<ToastTone, Tone> = \{([^}]*)\}/);
    expect(map?.[1]).toBeTruthy();
    expect(map?.[1]).toContain("success: 'confident'");
    expect(map?.[1]).toContain("error: 'failed'");
    expect(map?.[1]).toContain("warning: 'degraded'");
    expect(map?.[1]).toContain("info: 'neutral'");
    expect(map?.[1], 'no toast may be Iris').not.toContain('ambiguous');
  });

  it('gives every tone an icon, so colour is never the only carrier', () => {
    // §8, and the same reason Badge bakes the icon into its API.
    for (const tone of ['success', 'error', 'warning', 'info']) {
      expect(
        CODE.match(/const TONE_ICON[\s\S]*?\n\};/)?.[0],
        `TONE_ICON must cover "${tone}"`,
      ).toContain(`${tone}:`);
    }
  });

  it('spends no motion the contract has not already priced', () => {
    /*
     * §7.1 caps everything at 200ms and §16 refuses a value this system has not
     * defined. Every duration here is a named token, so a 400ms ease-out cannot
     * arrive as a one-off literal.
     */
    // No space in the class: a greedy match ran past the utility and into the
    // next word of the same className string.
    const durations = [...CODE.matchAll(/duration-([a-z0-9[\].]+)/g)].map(
      (m) => m[1],
    );
    expect(durations.length).toBeGreaterThan(0);
    for (const value of durations) {
      expect(
        ['micro', 'standard', 'emphasis'],
        `duration-${value} is not one of the tokens in §7.1`,
      ).toContain(value);
    }
  });

  it('carries no decorative gradient', () => {
    // §6.3 and §7.2. The ground is glass and the state is the icon; a gradient
    // would be a third thing doing neither.
    expect(CODE).not.toMatch(/bg-gradient|bg-linear|from-\[|via-/);
  });
});
