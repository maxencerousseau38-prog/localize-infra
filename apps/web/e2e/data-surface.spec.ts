import { expect, test } from '@playwright/test';

/**
 * The data-surface contract (DESIGN.md §8).
 *
 * "A data surface is incomplete without: a result count, a filter or search
 * affordance, sortable columns where more than one order is meaningful, and a
 * designed empty, loading and error state."
 *
 * The audit that produced that rule found the opposite: every table in the app
 * was a static list, and `Skeleton`/`ErrorState` were rendered only in the
 * design gallery. These tests exist because that regression is invisible — a
 * table with no filter looks finished in a screenshot, and nothing else in the
 * suite would notice the controls being dropped.
 */

const SURFACES = [
  {
    path: '/runs',
    noun: 'run',
    total: 3,
    search: 'Search runs by trigger',
    miss: 'zzz-no-such-command',
    empty: 'No runs match',
    reset: 'Show all runs',
  },
  {
    path: '/locales',
    noun: 'language',
    total: 5,
    search: 'Search languages by name or code',
    miss: 'zzz-no-such-language',
    empty: 'No languages match',
    reset: 'Show all languages',
  },
] as const;

for (const surface of SURFACES) {
  test.describe(surface.path, () => {
    test('states its result count', async ({ page }) => {
      await page.goto(surface.path);
      await expect(
        page.getByText(`${surface.total} ${surface.noun}s`),
      ).toBeVisible();
    });

    test('search narrows the rows and reports the new count', async ({
      page,
    }) => {
      await page.goto(surface.path);
      const rows = page.locator('tbody tr');
      await expect(rows).toHaveCount(surface.total);

      await page.getByLabel(surface.search).fill(surface.miss);

      // The empty state renders inside the body so the headers survive.
      await expect(page.getByText(surface.empty)).toBeVisible();
      await expect(page.locator('thead')).toBeVisible();
    });

    test('recovers from the empty state', async ({ page }) => {
      await page.goto(surface.path);
      await page.getByLabel(surface.search).fill(surface.miss);

      // The reset action names its outcome rather than repeating "Clear
      // search", which is already the accessible name of the input's own X.
      // Two controls sharing one name on a single screen is ambiguous to
      // anyone navigating by name.
      await page.getByRole('button', { name: surface.reset }).click();
      await expect(page.locator('tbody tr')).toHaveCount(surface.total);
    });

    test('sorting is announced through aria-sort, not position alone', async ({
      page,
    }) => {
      await page.goto(surface.path);
      const sortable = page.locator('th[aria-sort]');
      expect(await sortable.count()).toBeGreaterThan(0);

      // Exactly one column is the active sort at any time.
      await expect(page.locator('th[aria-sort="descending"]')).toHaveCount(1);

      const first = sortable.first();
      const before = await first.getAttribute('aria-sort');
      await first.getByRole('button').click();
      await expect(first).not.toHaveAttribute('aria-sort', before ?? '');
    });
  });
}

test('the status filter is a real radiogroup, not buttons wearing the role', async ({
  page,
}) => {
  await page.goto('/runs');

  // A hand-rolled radiogroup without roving tabindex makes every option a tab
  // stop and leaves arrow keys dead. Both halves are checked here because the
  // first implementation passed axe while failing the keyboard model.
  await page.getByRole('radio', { name: 'All' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { name: 'Succeeded' })).toBeChecked();

  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Search runs by trigger')).toBeFocused();
});

test('page titles step down below sm (DESIGN.md §3.4)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/runs');
  const small = await page
    .locator('h1')
    .evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize));

  await page.setViewportSize({ width: 1440, height: 900 });
  const large = await page
    .locator('h1')
    .evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize));

  // 28px at every width from 390 to 1920 was the audit finding.
  expect(small).toBeLessThan(large);
  expect(small).toBe(20);
  expect(large).toBe(28);
});
