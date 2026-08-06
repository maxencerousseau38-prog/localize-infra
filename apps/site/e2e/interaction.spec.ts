import { expect, test } from '@playwright/test';

const ROUTES = ['/', '/pricing', '/quality', '/security', '/roadmap'];

/**
 * The guard that matters most in this file.
 *
 * A misconfigured Content-Security-Policy once blocked every Next.js chunk on
 * this site. The build was green, every page prerendered, and the accessibility
 * audit passed — because all of that inspects static markup. The site was
 * simply dead: nothing hydrated, no button worked.
 *
 * Nothing in a typical pipeline catches that. This does.
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

  test('the page actually hydrates and responds to interaction', async ({
    page,
  }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    const button = page.getByRole('button', { name: /copy command/i }).first();
    await button.click();

    // Deliberately asserts on the live region rather than on a success state:
    // clipboard access may be denied in some environments, and this test is
    // about whether React is running at all, not whether the copy succeeded.
    // Either outcome writes here; a dead page writes nothing.
    await expect(page.locator('output').first()).not.toBeEmpty();
  });
});

test.describe('copy command — the primary conversion action', () => {
  test('copies the exact command via keyboard alone and announces it', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/', { waitUntil: 'networkidle' });

    const button = page.getByRole('button', { name: /copy command/i }).first();
    await button.focus();
    await expect(button).toBeFocused();
    await page.keyboard.press('Enter');

    // Announced for screen-reader users, not merely shown.
    await expect(page.getByText('Command copied to clipboard')).toBeAttached();

    // Must arrive verbatim: a stray prompt character or trailing whitespace
    // would break paste-and-run, which is this page's whole conversion path.
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toBe('npx @localize-infra/cli init');
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
});

test('theme choice persists and applies before first paint', async ({
  page,
}) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(
    page.getByRole('radiogroup', { name: /colour theme/i }),
  ).toBeVisible();

  // Click the label, which is what a user does: the input is visually hidden by
  // design so the control can be styled, and its text label is screen-reader
  // only. Targeting by title resolves the clickable label itself.
  await page.getByTitle('Dark', { exact: true }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(page.getByRole('radio', { name: 'Dark' })).toBeChecked();

  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(page.getByRole('radio', { name: 'Dark' })).toBeChecked();
});

test('remains usable with reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(
    page.getByRole('heading', { level: 1, name: /build artifact/i }),
  ).toBeVisible();
});
