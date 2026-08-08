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

/**
 * ARIA ownership: a `listbox` may only own `option` and `group` elements.
 * axe does not check this, so without this test the structure regresses
 * silently — which is exactly how it was wrong the first time.
 */
test('the palette listbox owns only options and groups', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.keyboard.press('ControlOrMeta+k');
  await expect(page.getByRole('combobox')).toBeFocused();

  const badChildren = await page.$$eval('#command-palette-list > *', (nodes) =>
    nodes
      .map((n) => n.getAttribute('role') ?? `<${n.tagName.toLowerCase()}>`)
      .filter((role) => role !== 'option' && role !== 'group'),
  );
  expect(badChildren).toEqual([]);

  // Every group must be named, or a screen reader announces "group" with no
  // indication of which section it is.
  const groups = await page.$$eval(
    '#command-palette-list [role="group"]',
    (n) => n.map((g) => g.getAttribute('aria-label')),
  );
  expect(groups.length).toBeGreaterThan(0);
  expect(groups.every(Boolean)).toBe(true);
});

test('an empty result set collapses the listbox and is announced', async ({
  page,
}) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.keyboard.press('ControlOrMeta+k');
  const input = page.getByRole('combobox');
  await input.fill('zzzzqqqq');

  await expect(page.getByRole('option')).toHaveCount(0);
  // Claiming to be expanded sends a screen reader looking for options that are
  // not there.
  await expect(input).toHaveAttribute('aria-expanded', 'false');
  // Silence is indistinguishable from a broken palette.
  await expect(page.getByRole('status')).toHaveText(/no matches/i);
});

test('decorative avatars are not announced', async ({ page }) => {
  await page.goto('/design', { waitUntil: 'networkidle' });

  // The name is what carries the meaning; the initials are a compressed
  // rendering of it, so announcing "IM" alongside adds noise.
  await expect(page.getByText('Inès Moreau')).toBeVisible();

  // Asserted on the accessibility tree, not on DOM text: getByText would find
  // the initials whether or not they are exposed.
  const hidden = await page
    .getByText('IM', { exact: true })
    .evaluate((node) => Boolean(node.closest('[aria-hidden="true"]')));
  expect(hidden).toBe(true);
});

/**
 * The State Rule uses `border-inline-start` so it moves to the trailing edge in
 * a right-to-left interface. A physical `border-left` would look identical in
 * every LTR test and be visibly wrong in Arabic — the one language where this
 * product cannot afford to look careless.
 */
test('the State Rule follows the interface direction', async ({ page }) => {
  await page.goto('/design', { waitUntil: 'networkidle' });

  // The rule lives on the card root, not on the text nodes that carry `dir`.
  const sideOf = (testId: string) =>
    page.getByTestId(testId).evaluate((node) => {
      const style = getComputedStyle(node);
      return { left: style.borderLeftWidth, right: style.borderRightWidth };
    });

  const ltr = await sideOf('card-ltr');
  expect(ltr.left).toBe('3px');
  expect(ltr.right).toBe('0px');

  const rtl = await sideOf('card-rtl');
  expect(rtl.right).toBe('3px');
  expect(rtl.left).toBe('0px');
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

test('the open navigation sheet has no axe violations', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /open navigation/i }).click();
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();

  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(
    results.violations.map((v) => `${v.id}: ${v.nodes.length} node(s)`),
  ).toEqual([]);
});

test('touch targets in the navigation sheet meet the minimum size', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /open navigation/i }).click();

  const links = page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link');
  const count = await links.count();
  expect(count).toBeGreaterThan(0);

  for (let i = 0; i < count; i++) {
    const box = await links.nth(i).boundingBox();
    // WCAG 2.2 target size (minimum) is 24×24. The rows are 32px tall with a
    // 4px gap, so the spacing exception is not being leaned on.
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(24);
  }
});
