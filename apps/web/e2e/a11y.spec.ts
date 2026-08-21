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
  '/review',
  '/runs',
  '/runs/run-7c1b',
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
  await page.getByRole('button', { name: /toggle sidebar/i }).click();
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
  await page.getByRole('button', { name: /toggle sidebar/i }).click();

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

/**
 * Contrast of the primitives added during the transformation.
 *
 * axe checks contrast against what it can resolve, but these are small text on
 * tinted grounds where the margin matters: the keyboard hint measured 4.54:1
 * before this — over the 4.5 threshold by four hundredths, which is a
 * coincidence rather than a margin, and any token adjustment would have broken
 * it silently.
 */
for (const scheme of ['light', 'dark'] as const) {
  test(`keyboard hints stay legible (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    // /runs, not /ambiguity: that route reads the database now and left
    // this suite, taking the queue's hints with it. The topbar's ⌘K badge
    // is the remaining Kbd, and its margin is the one that was 4.54:1.

    await page.goto('/runs');

    // Every keyboard hint on the page, not the first. The first version of
    // this measured whichever `kbd` came first in the DOM and reported it as
    // though it covered the primitive — it was in fact reading the topbar's
    // ⌘K badge, a different element with a different colour.
    const ratios = await page.locator('kbd').evaluateAll((els) =>
      els.map((el) => {
        const luminance = (colour: string) => {
          // `?? []` rather than `!`: a colour string that does not parse falls
          // through to the 0/0/0 defaults below instead of throwing inside the
          // page, where the failure would surface as an opaque evaluate error
          // rather than a contrast number.
          const [r = 0, g = 0, b = 0] = (colour.match(/[\d.]+/g) ?? [])
            .slice(0, 3)
            .map((v) => Number(v) / 255)
            .map((v) =>
              v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
            );
          return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        // Walk up for the first opaque ancestor background. The walk used to
        // assign inside the loop condition, which reads as a typo and is what
        // `noAssignInExpressions` objects to; the step is now explicit and the
        // termination condition is the same.
        const transparent = (colour: string) =>
          colour === 'rgba(0, 0, 0, 0)' || colour === 'transparent';

        let node: Element | null = el;
        let background = getComputedStyle(el).backgroundColor;
        while (transparent(background) && node.parentElement) {
          node = node.parentElement;
          background = getComputedStyle(node).backgroundColor;
        }
        const a = luminance(getComputedStyle(el).color);
        const b = luminance(background);
        const [hi, lo] = a > b ? [a, b] : [b, a];
        return (hi + 0.05) / (lo + 0.05);
      }),
    );

    expect(ratios.length).toBeGreaterThan(0);
    // 11px is normal-size text for contrast purposes, so AA is 4.5.
    for (const ratio of ratios) expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
}

test('the breadcrumb marks which segment is the current page', async ({
  page,
}) => {
  await page.goto('/runs');
  // Without this a screen reader hears the trail but not where it stops. The
  // hand-rolled breadcrumb this replaced never set it.
  const current = page.locator(
    'nav[aria-label="Breadcrumb"] [aria-current="page"]',
  );
  await expect(current).toHaveCount(1);
  await expect(current).toHaveText('Runs');
});

test('nothing animates under reduced motion', async ({ browser }) => {
  // The site pins this; the application did not, and it is the surface with
  // the overlays, sheets and row transitions.
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();

  for (const route of ['/', '/runs', '/design']) {
    await page.goto(route);
    const animating = await page.evaluate(
      () =>
        [...document.querySelectorAll('*')].filter((el) => {
          const style = getComputedStyle(el);
          return [
            ...style.animationDuration.split(','),
            ...style.transitionDuration.split(','),
          ]
            .map((v) =>
              v.trim().endsWith('ms')
                ? Number.parseFloat(v)
                : Number.parseFloat(v) * 1000,
            )
            .some((ms) => ms > 1);
        }).length,
    );
    expect(animating, `${route} under reduced motion`).toBe(0);
  }

  await context.close();
});
