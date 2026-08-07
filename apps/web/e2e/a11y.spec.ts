import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * Zero axe violations is a merge gate, not a report (cross-cutting definition
 * of done, docs/frontend/07-milestones.md).
 *
 * Both colour schemes are checked: the dark palette is a distinct scale, not an
 * inversion, so light passing tells us nothing about dark.
 */
const ROUTES = [
  '/',
  '/ambiguity',
  '/review',
  '/runs',
  '/locales',
  '/settings',
  '/design',
];

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

for (const route of ROUTES) {
  for (const scheme of ['light', 'dark'] as const) {
    test(`${route} has no axe violations (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(route, { waitUntil: 'networkidle' });
      const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();

      expect(
        results.violations.map((v) => `${v.id}: ${v.nodes.length} node(s)`),
      ).toEqual([]);
    });
  }
}

/**
 * Overlays are audited open. A closed dialog is not in the DOM, so auditing the
 * page without opening it proves nothing about the component that is hardest to
 * get right.
 */
test('the open dialog has no axe violations', async ({ page }) => {
  await page.goto('/design', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Open dialog' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();

  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(
    results.violations.map((v) => `${v.id}: ${v.nodes.length} node(s)`),
  ).toEqual([]);
});

test('the open command palette has no axe violations', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.keyboard.press('ControlOrMeta+k');
  await expect(page.getByRole('combobox')).toBeFocused();

  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(
    results.violations.map((v) => `${v.id}: ${v.nodes.length} node(s)`),
  ).toEqual([]);
});

test('every page has exactly one h1 and no skipped heading levels', async ({
  page,
}) => {
  for (const route of ROUTES) {
    await page.goto(route, { waitUntil: 'networkidle' });
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

/**
 * Translated copy must carry `lang` and `dir`. Without them the browser picks
 * the wrong font and a screen reader announces Japanese with an English voice —
 * the most visible competence failure available to a localization product.
 */
test('translated strings declare their language and direction', async ({
  page,
}) => {
  await page.goto('/design', { waitUntil: 'networkidle' });

  const arabic = page.locator('[lang="ar"]').first();
  await expect(arabic).toHaveAttribute('dir', 'rtl');

  const japanese = page.locator('[lang="ja"]').first();
  await expect(japanese).toHaveAttribute('dir', 'ltr');
});
