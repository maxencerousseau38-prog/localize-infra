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

      // Scoped to the table. /runs renders the same rows a second way below
      // `md` — records rather than a truncated table — so the empty copy and
      // its reset action now exist twice in the document, once hidden at this
      // viewport. An unscoped lookup resolves to whichever comes first and
      // asserts visibility against a `display: none` node.
      const table = page.getByRole('table');

      // The empty state renders inside the body so the headers survive.
      await expect(table.getByText(surface.empty)).toBeVisible();
      await expect(page.locator('thead')).toBeVisible();
    });

    test('recovers from the empty state', async ({ page }) => {
      await page.goto(surface.path);
      await page.getByLabel(surface.search).fill(surface.miss);

      // The reset action names its outcome rather than repeating "Clear
      // search", which is already the accessible name of the input's own X.
      // Two controls sharing one name on a single screen is ambiguous to
      // anyone navigating by name.
      await page
        .getByRole('table')
        .getByRole('button', { name: surface.reset })
        .click();
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

/**
 * URL-addressable state (DESIGN.md §9).
 *
 * The rule has been in the design document since its first draft and lived
 * nowhere in the code: filter and sort were `useState`, so no view could be
 * shared, bookmarked, or survive a refresh — on a product whose users work by
 * sending each other links. Pinned here because it is invisible to every other
 * check: the surface looks and behaves identically until you reload it.
 */
test('filter and sort survive a reload and can be shared as a link', async ({
  page,
}) => {
  await page.goto('/runs');
  const filter = page.getByRole('group', { name: 'Filter runs by status' });

  // Defaults are never written — a pristine surface has a clean address bar.
  expect(new URL(page.url()).search).toBe('');

  await filter.getByText('Failed', { exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Failed' })).toBeChecked();
  expect(new URL(page.url()).search).toContain('status=failed');

  // The actual requirement: a fresh load of that URL reproduces the view.
  const shared = page.url();
  await page.goto(shared);
  await expect(page.getByRole('radio', { name: 'Failed' })).toBeChecked();
  await expect(page.locator('tbody tr')).toHaveCount(1);

  // Returning to the default drops the parameter rather than pinning it.
  await filter.getByText('All', { exact: true }).click();
  await expect(page.getByRole('radio', { name: 'All' })).toBeChecked();
  expect(new URL(page.url()).search).not.toContain('status=');
});

test('a sort order can be linked to directly', async ({ page }) => {
  await page.goto('/locales');
  const byCoverage = await page.locator('tbody tr td').first().textContent();

  await page.goto('/locales?sort=language&dir=asc');
  const byLanguage = await page.locator('tbody tr td').first().textContent();

  expect(byLanguage).not.toBe(byCoverage);
  expect(byLanguage).toContain('Arabic');
});

/**
 * The small-screen arrangement carries the whole record.
 *
 * /runs used to drop columns at breakpoints until a 390px screen showed status,
 * command and a relative time. Locales, strings, duration and the pull request
 * were not scrolled off — they were `display: none`, so a developer checking a
 * run from a phone could not reach them at all. Pinned because nothing else
 * catches it: the desktop table is unchanged and every other check runs wide.
 */
test('a run exposes every fact at 390 (DESIGN.md §3.4)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/runs');

  // The table is the desktop arrangement and must be out of the way here.
  await expect(page.getByRole('table')).toBeHidden();

  const record = page.getByRole('listitem').filter({ hasText: 'Succeeded' });
  await expect(record).toBeVisible();

  for (const fact of ['Locales', 'Strings', 'Duration', 'Output']) {
    await expect(
      record.getByText(fact, { exact: true }),
      `a run record hides ${fact} at 390`,
    ).toBeVisible();
  }

  // The command still reaches its detail page from here.
  await expect(record.getByRole('link')).toHaveAttribute(
    'href',
    '/runs/run-8f2a',
  );
});

/**
 * The same arrangement for /locales, pinned on the failure that was specific
 * to it: `State` — the column answering this page's own question, "which
 * language is behind?" — was cut off mid-word at 390 ("Needs a dec…"), while
 * `Translated` and `Last run` were `display: none`. The specimen also wrapped
 * under the language name, turning five rows into eleven ragged lines.
 */
test('a locale exposes its state and counts at 390 (DESIGN.md §3.4)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/locales');

  await expect(page.getByRole('table')).toBeHidden();

  const record = page
    .getByRole('listitem')
    .filter({ hasText: 'Brazilian Portuguese' });
  await expect(record).toBeVisible();

  // The full label, not a truncation of it.
  await expect(record.getByText('Needs a decision')).toBeVisible();
  await expect(record.getByText('126/128')).toBeVisible();
  await expect(record.getByText(/Last run/)).toBeVisible();

  // The specimen renders in its own script, on its own line.
  await expect(record.getByText('Salvar alterações')).toBeVisible();

  // Nothing may overflow its own record box at this width.
  const clipped = await page.evaluate(
    () =>
      [...document.querySelectorAll('li')].filter(
        (el) => el.scrollWidth > el.clientWidth + 1,
      ).length,
  );
  expect(clipped, 'records clipping their own content').toBe(0);
});

/**
 * The run detail keeps its primary action reachable at 390.
 *
 * `PageHeader` carried `shrink-0` on the column holding the metadata and the
 * action, so that column never narrowed and its `flex-wrap` never fired. The
 * page rendered 828px wide inside a 390px viewport and the pull request link —
 * the thing a run exists to produce — sat at x=678, off-screen behind a
 * horizontal scroll nothing advertised.
 */
test('the run detail keeps its pull request reachable at 390', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/runs/run-8f2a');

  const link = page.getByRole('link', { name: /pull request/i }).first();
  await expect(link).toBeVisible();

  const box = await link.boundingBox();
  expect(box, 'pull request link has no box').not.toBeNull();
  expect(
    (box?.x ?? 0) + (box?.width ?? 0),
    'pull request link extends past the viewport',
  ).toBeLessThanOrEqual(390);

  // Every header fact wrapped into view rather than being pushed off it.
  for (const label of ['Status', 'Duration', 'Commit', 'When']) {
    await expect(page.getByText(label, { exact: true })).toBeVisible();
  }

  // Per-locale results become records; the four-column table is desktop-only.
  await expect(page.getByRole('table')).toBeHidden();
  const record = page.getByRole('listitem').filter({ hasText: 'German' });
  await expect(record.getByText('Escalated')).toBeVisible();
});

/**
 * The escalation context survives a narrow viewport.
 *
 * The origin line carried `truncate`: a no-op at desktop width, destructive
 * below it. "src/components/Toolbar.tsx · Button label beside Save and Close"
 * cut to "…besi…" at 390 — and the context is the half that answers the
 * question, since whether "Open" is the verb or the adjective is decided by it
 * sitting on a button next to Save and Close. The evidence disappeared at the
 * width where the reader had least of it.
 */
test('an escalation keeps its context readable at 390', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/ambiguity');

  const context = page.getByText('Button label beside Save and Close');
  await expect(context).toBeVisible();

  // Visible is not enough: `truncate` leaves the node visible and clips it.
  const clipped = await context.evaluate((el) => {
    const line = el.closest('p');
    return line ? line.scrollWidth > line.clientWidth + 1 : true;
  });
  expect(clipped, 'the origin line is clipping its own text').toBe(false);
});
