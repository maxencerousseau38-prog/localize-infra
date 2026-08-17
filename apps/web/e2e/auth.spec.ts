import { expect, test } from '@playwright/test';

/**
 * Authentication, against a real database.
 *
 * Runs on port 3212 — the webServer that inherits the ambient environment —
 * rather than the shell suite's deliberately unconfigured 3211. Skips when no
 * database is configured, because a red suite for a missing secret teaches
 * nobody anything.
 *
 * These assertions are the security-critical half and need no seeded account:
 * that protected routes are protected at all, and that a failed sign-in does
 * not reveal whether the address exists. The successful sign-in path needs a
 * confirmed user and is covered once the fixture exists.
 */
const AUTH_URL = 'http://127.0.0.1:3212';

const configured = Boolean(process.env.SUPABASE_URL);

test.describe('authentication', () => {
  test.skip(
    !configured,
    'No SUPABASE_URL: this suite needs a real database. Set it in apps/web/.env.local.',
  );

  // Every route the sidebar offers. Protection is an allow-list in
  // lib/supabase/session.ts, so a route added later is protected by default —
  // this asserts the list has not been inverted.
  for (const path of [
    '/',
    '/runs',
    '/locales',
    '/ambiguity',
    '/review',
    '/settings',
    '/design',
  ]) {
    test(`${path} redirects a signed-out visitor to sign in`, async ({
      page,
    }) => {
      await page.goto(`${AUTH_URL}${path}`, { waitUntil: 'networkidle' });

      const url = new URL(page.url());
      expect(url.pathname, `${path} should require a session`).toBe('/login');
      // The destination is carried so sign-in returns the visitor where they
      // were going, rather than dumping them on a dashboard.
      expect(url.searchParams.get('next')).toBe(path);
    });
  }

  test('the sign-in page itself is reachable signed out', async ({ page }) => {
    const response = await page.goto(`${AUTH_URL}/login`, {
      waitUntil: 'networkidle',
    });
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });

  test('a failed sign-in does not reveal whether the account exists', async ({
    page,
  }) => {
    await page.goto(`${AUTH_URL}/login`, { waitUntil: 'networkidle' });

    await page
      .getByLabel('Email')
      .fill('definitely-not-registered@example.com');
    await page.getByLabel('Password').fill('some-wrong-password');
    await page.getByRole('button', { name: 'Sign in' }).click();

    const message = page.locator('output');
    await expect(message).toContainText(/not recognised/i);

    // The message must be the same one a real account with a wrong password
    // gets. Anything that distinguishes the two is an enumeration oracle.
    const text = (await message.textContent()) ?? '';
    expect(text).not.toMatch(/no account|not found|does not exist|unknown/i);
    expect(new URL(page.url()).pathname).toBe('/login');
  });

  test('the form is usable from the keyboard alone', async ({ page }) => {
    await page.goto(`${AUTH_URL}/login`, { waitUntil: 'networkidle' });

    await page.getByLabel('Email').focus();
    await page.keyboard.type('keyboard@example.com');
    await page.keyboard.press('Tab');
    await page.keyboard.type('some-password');
    await page.keyboard.press('Tab');

    await expect(page.getByRole('button', { name: 'Sign in' })).toBeFocused();
  });
});
