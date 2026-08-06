import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * Zero axe violations is a merge gate, not a report (see the cross-cutting
 * definition of done in docs/frontend/07-milestones.md).
 *
 * Both colour schemes are checked: the dark palette is a distinct scale, not an
 * inversion, so light passing tells us nothing about dark.
 */
const ROUTES = ['/', '/pricing', '/quality', '/security', '/roadmap'];

for (const route of ROUTES) {
  for (const scheme of ['light', 'dark'] as const) {
    test(`${route} has no axe violations (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(route);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();

      expect(
        results.violations.map((v) => `${v.id}: ${v.nodes.length} node(s)`),
      ).toEqual([]);
    });
  }
}

test('every page has exactly one h1 and no skipped heading levels', async ({
  page,
}) => {
  for (const route of ROUTES) {
    await page.goto(route);
    const levels = await page.$$eval('h1,h2,h3,h4,h5,h6', (nodes) =>
      nodes.map((n) => Number(n.tagName[1])),
    );
    expect(
      levels.filter((l) => l === 1),
      `${route}: h1 count`,
    ).toHaveLength(1);
    for (let i = 1; i < levels.length; i++) {
      const prev = levels[i - 1] as number;
      const cur = levels[i] as number;
      expect(
        cur - prev,
        `${route}: jump from h${prev} to h${cur}`,
      ).toBeLessThanOrEqual(1);
    }
  }
});
