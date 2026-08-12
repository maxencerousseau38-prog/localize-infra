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
 * The scale is twelve named steps across two registers — eight the app uses
 * and four the site adds (docs/design/09-app-design-direction.md §7).
 * Anything outside them is a defect, in either direction.
 *
 * Tracking is now part of a step rather than a per-component decision, and is
 * guarded the same way the sizes are. It had drifted exactly as the sizes once
 * did: six hand-written values, section headings tracked in six places and
 * untracked in thirteen, and the eyebrow label written as both 0.14em and
 * 0.12em. Nothing would have caught a seventh value.
 *
 * apps/site is now in scope too. It carries the editorial register — three
 * further steps (prose, headline, display-xl) that the app never uses — but it
 * is the same system, and it had the same disease: section headings at 22px,
 * 26px and 28px doing one job, and body copy at 15/17/18px doing another.
 */
const REPO_ROOT = join(import.meta.dirname, '../../../..');

const SCANNED = [
  join(REPO_ROOT, 'packages/ui/src'),
  join(REPO_ROOT, 'apps/web/src'),
  join(REPO_ROOT, 'apps/site/src'),
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
      'prose',
      'eyebrow',
      'headline',
      'display-xl',
      'display-2xl',
    ]) {
      expect(tokens, `--text-${step}`).toContain(`--text-${step}:`);
      // A size without a line height is half a type step.
      expect(tokens, `--text-${step}--line-height`).toContain(
        `--text-${step}--line-height:`,
      );
    }
  });

  /*
   * Every step big enough to set headings carries its own tracking, because
   * letters read further apart as they grow and the correction belongs to the
   * size. The steps below `subtitle` deliberately do not: those sizes are
   * shared with code, key names and table cells, which must keep the face's
   * natural fit rather than inherit a heading's.
   */
  it('binds tracking to every step that sets headings', () => {
    const tokens = readFileSync(
      join(REPO_ROOT, 'packages/ui/src/styles/tokens.css'),
      'utf8',
    );

    for (const step of [
      'subtitle',
      'title',
      'display',
      'display-lg',
      'eyebrow',
      'headline',
      'display-xl',
      'display-2xl',
    ]) {
      expect(tokens, `--text-${step}--letter-spacing`).toContain(
        `--text-${step}--letter-spacing:`,
      );
    }
  });

  /**
   * Two exceptions, both because the element's size step is shared with text
   * that must not inherit its fit: the site wordmark sits at `body`, which is
   * every paragraph and button in both apps, and the app sidebar's uppercase
   * group label sits at `micro`, which carries row counts and numeric chips.
   *
   * Listed exactly rather than counted, so a new hand-written value fails here
   * instead of quietly becoming the seventh.
   */
  it('leaves no hand-written tracking outside the two documented exceptions', () => {
    const offenders: string[] = [];

    for (const file of files) {
      if (file.endsWith('type-scale.test.ts')) continue;
      const source = readFileSync(file, 'utf8');
      if (/tracking-\[/.test(source)) {
        offenders.push(file.replace(REPO_ROOT, '').replace(/\\/g, '/'));
      }
    }

    expect(offenders.sort()).toEqual([
      '/apps/site/src/components/site-header.tsx',
      '/apps/web/src/components/ui/sidebar.tsx',
    ]);
  });

  it('keeps the editorial steps out of the application', () => {
    // The registers share a system, not a scale. A 52px hero or a 1.65 prose
    // measure on a data surface would be the site's voice in the wrong room.
    const appFiles = sourceFiles(join(REPO_ROOT, 'apps/web/src'));
    const offenders: string[] = [];

    for (const file of appFiles) {
      const source = readFileSync(file, 'utf8');
      for (const step of [
        'text-prose',
        'text-headline',
        'text-display-xl',
        'text-display-2xl',
      ]) {
        // String.raw, because `\b` in an ordinary template literal is the
        // backspace character rather than a word boundary — which made this
        // check match nothing at all until a mutation test caught it.
        if (new RegExp(String.raw`\b${step}\b`).test(source)) {
          offenders.push(`${file.replace(REPO_ROOT, '')}: ${step}`);
        }
      }
    }

    expect(offenders).toEqual([]);
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
