import { expect, test } from '@playwright/test';

const ROUTES = [
  '/',
  '/ambiguity',
  '/review',
  '/runs',
  '/runs/run-7c1b',
  '/locales',
  '/settings',
  '/design',
];

/**
 * The guard that matters most in this file.
 *
 * A misconfigured Content-Security-Policy once blocked every Next.js chunk on
 * apps/site. The build was green, every page prerendered, and the accessibility
 * audit passed — because all of that inspects static markup. The site was
 * simply dead: nothing hydrated, no button worked.
 *
 * This app carries a stricter, nonce-based policy generated per request, so the
 * same failure is *more* likely here, not less: a nonce that fails to reach
 * Next's script tags blocks everything. Nothing in a typical pipeline catches
 * that. This does.
 */
test.describe('runtime health', () => {
  for (const route of ROUTES) {
    test(`${route} loads with no console errors or CSP violations`, async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text());
      });
      page.on('pageerror', (e) => errors.push(`pageerror: ${String(e)}`));

      await page.goto(route, { waitUntil: 'networkidle' });
      expect(errors).toEqual([]);
    });
  }

  test('serves a nonce-based CSP with no unsafe-inline for scripts', async ({
    page,
  }) => {
    const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
    const csp = response?.headers()['content-security-policy'] ?? '';
    const scriptSrc =
      csp.split(';').find((d) => d.trim().startsWith('script-src')) ?? '';

    expect(scriptSrc).toMatch(/'nonce-[a-f0-9]{32}'/);
    expect(scriptSrc).toContain("'strict-dynamic'");
    // `object-src 'none'` and `base-uri 'self'` are the two directives
    // 'strict-dynamic' does not cover; a policy missing them is not strict.
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  test('issues a different nonce on every request', async ({ page }) => {
    // A constant nonce is equivalent to no nonce at all: an attacker who can
    // read one page can reuse it. This is the failure a static header hides.
    const first = await page.goto('/', { waitUntil: 'domcontentloaded' });
    const a = first?.headers()['content-security-policy'] ?? '';
    const second = await page.goto('/design', {
      waitUntil: 'domcontentloaded',
    });
    const b = second?.headers()['content-security-policy'] ?? '';

    const nonceOf = (csp: string) => csp.match(/'nonce-([a-f0-9]{32})'/)?.[1];
    expect(nonceOf(a)).toBeTruthy();
    expect(nonceOf(a)).not.toBe(nonceOf(b));
  });

  test('React is running: the command palette opens on click', async ({
    page,
  }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /search/i }).click();
    await expect(page.getByRole('combobox')).toBeFocused();
  });
});

test.describe('command palette', () => {
  test('opens with the keyboard shortcut, filters, and navigates', async ({
    page,
  }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    await page.keyboard.press('ControlOrMeta+k');
    const input = page.getByRole('combobox');
    await expect(input).toBeFocused();

    // An empty query must list everything, never a blank box.
    await expect(page.getByRole('option')).not.toHaveCount(0);

    await input.fill('design');
    await expect(page.getByRole('option')).toHaveCount(1);
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(/\/design$/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Design system' }),
    ).toBeVisible();
  });

  test('the shortcut toggles: pressing it again closes the palette', async ({
    page,
  }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.keyboard.press('ControlOrMeta+k');
    await expect(page.getByRole('combobox')).toBeFocused();

    // A shortcut that only opens leaves the reader pressing it with nothing
    // happening (design system §4.6: ⌘K toggles).
    await page.keyboard.press('ControlOrMeta+k');
    await expect(page.getByRole('combobox')).toHaveCount(0);
  });

  test('Escape closes it and returns focus to the trigger', async ({
    page,
  }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    const trigger = page.getByRole('button', { name: /search/i });
    await trigger.click();
    await expect(page.getByRole('combobox')).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('combobox')).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test('arrow keys move the active option without moving focus', async ({
    page,
  }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.keyboard.press('ControlOrMeta+k');
    const input = page.getByRole('combobox');

    const firstActive = await input.getAttribute('aria-activedescendant');
    await page.keyboard.press('ArrowDown');
    const secondActive = await input.getAttribute('aria-activedescendant');

    expect(firstActive).toBeTruthy();
    expect(secondActive).not.toBe(firstActive);
    // The whole point of aria-activedescendant: focus stays where typing goes.
    await expect(input).toBeFocused();
  });
});

test('the skip link is the first thing a keyboard user reaches', async ({
  page,
}) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('link', { name: /skip to content/i }),
  ).toBeFocused();
});

test('theme choice persists across navigation', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.getByTitle('Dark', { exact: true }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);

  await page.goto('/design', { waitUntil: 'networkidle' });
  // Applied before first paint by the inline theme script, which only runs if
  // the per-request nonce reached it.
  await expect(page.locator('html')).toHaveClass(/dark/);
});

test.describe('honesty about the missing backend', () => {
  // The principle is unchanged; the mechanism changed. These routes used to
  // render a placeholder saying "not built yet", which was honest but meant
  // abandoning the design. They now render their real interface populated with
  // sample data, labelled at three levels at once. This suite asserts all three
  // are present, because any one of them alone could be missed.
  const SAMPLE_ROUTES = [
    '/',
    '/ambiguity',
    '/review',
    '/runs',
    '/runs/run-7c1b',
    '/locales',
  ];

  for (const route of SAMPLE_ROUTES) {
    test(`${route} labels its data as sample in the banner`, async ({
      page,
    }) => {
      await page.goto(route, { waitUntil: 'networkidle' });
      await expect(
        page.getByText(/sample data — this is not your project/i),
      ).toBeVisible();
    });

    test(`${route} carries the sample chip in the breadcrumb`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(route, { waitUntil: 'networkidle' });
      const nav = page.getByRole('navigation', { name: 'Breadcrumb' });
      await expect(nav.getByText('Sample', { exact: true })).toBeVisible();
    });

    test(`${route} marks its data region for assistive technology`, async ({
      page,
    }) => {
      await page.goto(route, { waitUntil: 'networkidle' });
      // The dashed edge is invisible to a screen reader; the accessible name
      // is what carries "this is sample" to someone who cannot see it.
      await expect(
        page.getByRole('region', { name: /\(sample data\)$/ }).first(),
      ).toBeAttached();
    });
  }

  test('settings shows no sample data and no controls that cannot save', async ({
    page,
  }) => {
    // Settings is the deliberate exception. The other surfaces show data,
    // where a labelled sample demonstrates the shape honestly. This shows
    // controls, and a control that silently fails to save is a worse lie than
    // an empty section — so the configuration here is read-only and real.
    await page.goto('/settings', { waitUntil: 'networkidle' });

    await expect(
      page.getByText(/sample data — this is not your project/i),
    ).toHaveCount(0);

    // Scoped to the settings surface, not the whole page: the shell's theme
    // toggle is a real control that really works, and excluding it is the
    // point — the contract is about controls that would silently fail.
    const surface = page.locator('main');
    await expect(surface.locator('input, textarea, select')).toHaveCount(0);
    await expect(surface.getByRole('switch')).toHaveCount(0);
    await expect(
      surface.getByRole('button', { name: /save|update|apply/i }),
    ).toHaveCount(0);
  });

  test('settings reports real configuration rather than a placeholder', async ({
    page,
  }) => {
    await page.goto('/settings', { waitUntil: 'networkidle' });
    // These are the CLI's actual defaults, pinned to their source by a test in
    // packages/schemas.
    await expect(page.getByText('http://localhost:8787')).toBeVisible();
    await expect(page.getByText('LOCALIZE_API_TOKEN')).toBeVisible();
    await expect(page.getByText(/de, ja, es, ar, pt-BR/)).toBeVisible();
  });

  test('the sections that genuinely cannot exist still say so', async ({
    page,
  }) => {
    await page.goto('/settings?section=account', { waitUntil: 'networkidle' });
    await expect(page.getByText(/is not built yet/i)).toBeVisible();

    await page.goto('/settings?section=danger', { waitUntil: 'networkidle' });
    await expect(page.getByText(/is not built yet/i)).toBeVisible();
  });

  test('settings sections survive a reload', async ({ page }) => {
    // Links rather than an ARIA tab widget: addressable, shareable, and
    // working without JavaScript.
    await page.goto('/settings?section=danger', { waitUntil: 'networkidle' });
    await page.reload({ waitUntil: 'networkidle' });
    await expect(
      page.getByRole('link', { name: 'Danger zone' }),
    ).toHaveAttribute('aria-current', 'page');
  });
});

test('remains usable with reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/design', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Open dialog' }).click();
  await expect(
    page.getByRole('heading', { name: /disconnect this project/i }),
  ).toBeVisible();
});

/**
 * The layout contract puts the sidebar at ≥1024 and the page gutter at 16px
 * below 768 (docs/product/04-wireframes.md §0). Below the breakpoint the same
 * navigation becomes a sheet — the one thing a fixed 240px sidebar cannot do on
 * a phone is get out of the way.
 */
test.describe('responsive shell', () => {
  test('below 1024 the sidebar is replaced by a navigation sheet', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });

    // Exactly one "Main" navigation landmark must be present at any width, or a
    // screen reader announces two navigations with identical names.
    await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0);

    await page.getByRole('button', { name: /toggle sidebar/i }).click();
    const nav = page.getByRole('navigation', { name: 'Main' });
    await expect(nav).toBeVisible();
    await expect(nav).toHaveCount(1);

    await nav.getByRole('link', { name: 'Design system' }).click();
    await expect(page).toHaveURL(/\/design$/);
    // Selecting a destination must dismiss the sheet, or the reader lands on
    // the new page with the navigation still covering it.
    await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0);
  });

  test('at 1024 and above the sidebar is persistent', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/', { waitUntil: 'networkidle' });

    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
    await expect(
      page.getByRole('button', { name: /toggle sidebar/i }),
    ).toBeVisible();
  });

  for (const width of [390, 768, 1024, 1440]) {
    test(`no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/design', { waitUntil: 'networkidle' });

      // A page that scrolls sideways is the single most common tell that a
      // layout was never opened at this width.
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow, `overflowed by ${overflow}px`).toBeLessThanOrEqual(0);
    });
  }
});

test.describe('run detail', () => {
  test('a runs row opens its detail', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/runs', { waitUntil: 'networkidle' });

    await page.getByRole('link', { name: /run 7c1b/i }).click();
    await expect(page).toHaveURL(/\/runs\/run-7c1b$/);
    await expect(
      page.getByRole('heading', { level: 1, name: /run 7c1b/i }),
    ).toBeVisible();
  });

  test('the pipeline shows every stage in order', async ({ page }) => {
    await page.goto('/runs/run-7c1b', { waitUntil: 'networkidle' });

    const stages = page
      .getByRole('list', { name: 'Pipeline stages' })
      .getByRole('listitem');
    await expect(stages).toHaveCount(5);
    // The order is the information — a pipeline out of sequence is wrong even
    // if every stage is present.
    await expect(stages.nth(0)).toContainText('Detect');
    await expect(stages.nth(4)).toContainText('Pull request');
  });

  test('stage state reaches assistive technology as words', async ({
    page,
  }) => {
    await page.goto('/runs/run-6a09', { waitUntil: 'networkidle' });
    const stages = page
      .getByRole('list', { name: 'Pipeline stages' })
      .getByRole('listitem');

    // The failed run stopped at Translate; the two stages after it never ran.
    // Colour and glyph carry that to the eye, these words carry it to everyone.
    await expect(stages.nth(2)).toContainText('Failed');
    await expect(stages.nth(3)).toContainText('Did not run');
  });

  test('a failure shows the provider message verbatim', async ({ page }) => {
    await page.goto('/runs/run-6a09', { waitUntil: 'networkidle' });
    // Paraphrasing destroys its only use: being searchable.
    await expect(
      page.getByText('fetch failed — ECONNREFUSED 127.0.0.1:8787').first(),
    ).toBeVisible();
  });

  test('a run that does not exist is a 404, not an empty page', async ({
    page,
  }) => {
    const response = await page.goto('/runs/run-nope', {
      waitUntil: 'domcontentloaded',
    });
    expect(response?.status()).toBe(404);
  });
});

test.describe('command palette actions', () => {
  test('offers navigation, actions and help', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.keyboard.press('ControlOrMeta+k');

    const list = page.getByRole('listbox');
    for (const section of ['Navigation', 'Actions', 'Help']) {
      await expect(
        list.getByRole('group', { name: section }),
        `${section} section`,
      ).toBeAttached();
    }
  });

  test('a theme action actually changes the theme', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(page.locator('html')).not.toHaveClass(/dark/);

    await page.keyboard.press('ControlOrMeta+k');
    await page.getByRole('combobox').fill('dark');
    await page.keyboard.press('Enter');

    // The point of shipping actions at all: they run.
    await expect(page.locator('html')).toHaveClass(/dark/);
  });

  test('the topbar toggle stays in sync with the palette', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/', { waitUntil: 'networkidle' });

    await page.keyboard.press('ControlOrMeta+k');
    await page.getByRole('combobox').fill('dark');
    await page.keyboard.press('Enter');

    // Two surfaces can set the theme. Before they shared a store, the toggle
    // read localStorage once on mount and kept showing the old value.
    await expect(page.getByRole('radio', { name: 'Dark' })).toBeChecked();
  });

  test('the theme survives a reload after a palette change', async ({
    page,
  }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.keyboard.press('ControlOrMeta+k');
    await page.getByRole('combobox').fill('dark');
    await page.keyboard.press('Enter');

    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.locator('html')).toHaveClass(/dark/);
  });

  test('offers no action it cannot perform', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.keyboard.press('ControlOrMeta+k');
    const list = page.getByRole('listbox');

    // Extraction, translation, opening a pull request and approving a
    // suggestion all need a backend. A palette that offers a command it cannot
    // run is worse than one that offers fewer.
    for (const forbidden of [
      /run extraction/i,
      /translate/i,
      /open a pull request/i,
      /approve/i,
      /resolve/i,
    ]) {
      await expect(
        list.getByRole('option', { name: forbidden }),
        String(forbidden),
      ).toHaveCount(0);
    }
  });
});
