import { readFileSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guards the type scale.
 *
 * Before this existed, the interface carried 15 distinct hardcoded pixel sizes
 * across 256 occurrences — `text-[13px]`, `text-[14px]` and `text-[15px]` all in
 * heavy use at once. That is the signature of accretion rather than a system:
 * nothing stopped the next component inventing a sixteenth size, and nothing
 * did stop it.
 *
 * The scale is eight named steps (docs/design/09-app-design-direction.md §7).
 * Anything outside it is a defect.
 *
 * apps/site is deliberately out of scope: it is the editorial register, with a
 * legitimately different and larger scale, and migrating it carries regression
 * risk for a surface that already reads well. Tracked as follow-up.
 */
const REPO_ROOT = join(import.meta.dirname, '../../../..');

const SCANNED = [
  join(REPO_ROOT, 'packages/ui/src'),
  join(REPO_ROOT, 'apps/web/src'),
];

const AD_HOC_SIZE = /text-\[\d+px\]/g;

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...sourceFiles(path));
    } else if (['.ts', '.tsx'].includes(extname(entry.name))) {
      found.push(path);
    }
  }
  return found;
}

describe('type scale', () => {
  const files = SCANNED.flatMap(sourceFiles);

  it('scans the source it is meant to guard', () => {
    expect(files.length).toBeGreaterThan(30);
  });

  it('uses no ad-hoc pixel type sizes', () => {
    const offenders: string[] = [];

    for (const file of files) {
      // This test file necessarily contains the pattern it forbids.
      if (file.endsWith('type-scale.test.ts')) continue;

      const matches = readFileSync(file, 'utf8').match(AD_HOC_SIZE);
      if (matches) {
        offenders.push(
          `${file.replace(REPO_ROOT, '').replace(/\\/g, '/')}: ${[...new Set(matches)].join(', ')}`,
        );
      }
    }

    expect(offenders).toEqual([]);
  });

  it('defines every step of the scale as a token', () => {
    const tokens = readFileSync(
      join(REPO_ROOT, 'packages/ui/src/styles/tokens.css'),
      'utf8',
    );

    for (const step of [
      'micro',
      'caption',
      'small',
      'body',
      'subtitle',
      'title',
      'display',
      'display-lg',
    ]) {
      expect(tokens, `--text-${step}`).toContain(`--text-${step}:`);
      // A size without a line height is half a type step.
      expect(tokens, `--text-${step}--line-height`).toContain(
        `--text-${step}--line-height:`,
      );
    }
  });

  it('pairs a display face distinct from the interface face', () => {
    const tokens = readFileSync(
      join(REPO_ROOT, 'packages/ui/src/styles/tokens.css'),
      'utf8',
    );
    // Inter is the right UI face and the wrong display face; using it for both
    // is the default this pairing exists to avoid.
    expect(tokens).toContain('--font-display:');
    expect(tokens).toMatch(/--font-display:\s*var\(--font-archivo\)/);
  });
});
