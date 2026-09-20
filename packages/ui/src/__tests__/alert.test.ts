import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * That the alert box stays one component.
 *
 * It was fifteen hand-written copies across ten files before this, all of which
 * had independently arrived at the same utilities. They agreed, which is
 * exactly why the duplication survived review fifteen times: nothing looked
 * wrong. A consolidation without this test is a consolidation that comes undone
 * the next time somebody needs a red box and does not know there is a
 * component.
 *
 * Scanning the applications from `packages/ui` follows `type-scale.test.ts`,
 * which does the same thing for ad-hoc type sizes — and `packages/ui/turbo.json`
 * already declares those directories as inputs, so the cache key moves when
 * they change.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../../..');
const APPS = [join(ROOT, 'apps/web/src'), join(ROOT, 'apps/site/src')];
const ALERT = readFileSync(join(HERE, '../primitives/alert.tsx'), 'utf8');

/**
 * The component's code with its prose removed.
 *
 * Asserting against the raw file is how the first version of this failed: the
 * doc comment explains *why* there is no `role="alert"`, and the assertion
 * matched that explanation. Second time in this design system — the glass test
 * did the same with `--glass-shadow`. A rule that documents itself must not
 * trip its own check, so the check reads the code.
 */
const ALERT_CODE = ALERT.replace(/\/\*[\s\S]*?\*\//g, '').replace(
  /\/\/.*$/gm,
  '',
);

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

const FILES = APPS.flatMap(sources);

const TONES = ['failed', 'confident', 'degraded', 'ambiguous'] as const;

/** A className that paints the alert shape by hand. */
function handRolled(text: string): string[] {
  const found: string[] = [];
  for (const [, cls] of text.matchAll(/className="([^"]*)"/g)) {
    if (!cls) continue;
    for (const tone of TONES) {
      // The signature is the trio: a state border, its background, and its
      // text colour on one element. Any two of them is something else — a
      // Badge, a section, a state rule.
      if (
        cls.includes(`border-${tone} `) &&
        cls.includes(`bg-${tone}-bg`) &&
        cls.includes(`text-${tone}-text`)
      ) {
        found.push(cls);
      }
    }
  }
  return found;
}

describe('Alert', () => {
  it('scans the applications it is meant to guard', () => {
    // A path change that empties this list would pass every assertion below.
    expect(FILES.length).toBeGreaterThan(40);
    expect(FILES.some((f) => f.text.includes('<Alert'))).toBe(true);
  });

  it('is the only way an alert box is drawn', () => {
    const offenders = FILES.flatMap((f) =>
      handRolled(f.text).map((cls) => `${f.path}: ${cls}`),
    );
    expect(
      offenders,
      'these paint the alert shape by hand instead of using <Alert>',
    ).toEqual([]);
  });

  it('covers every tone, so none can be silently unavailable', () => {
    // A missing tone sends the next caller straight back to hand-rolling it.
    for (const tone of [...TONES, 'neutral']) {
      expect(ALERT_CODE, `Alert must handle tone "${tone}"`).toContain(
        `${tone}:`,
      );
    }
  });

  it('does not announce itself', () => {
    /*
     * Most of these sit inside a caller-owned `<output aria-live="polite">`.
     * A `role="alert"` here would announce the same sentence twice, the second
     * time assertively — so the component stays presentational and the caller
     * keeps the live region it already owns.
     */
    expect(ALERT_CODE).not.toMatch(/role=["']alert["']/);
  });

  it('leaves the Danger Zone section alone', () => {
    /*
     * It carries a state border and background too, and it is not an alert: it
     * is a bordered section at `rounded-lg` with its own padding. Migrating it
     * would have changed a surface rather than consolidated a message, which
     * is the failure mode of a regex that matches on looks.
     */
    const danger = FILES.find((f) => f.path.endsWith('danger-section.tsx'));
    expect(danger?.text).toContain('rounded-lg border border-failed');
  });
});
