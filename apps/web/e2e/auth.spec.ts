import { expect, test } from '@playwright/test';
import { SEEDED_EMAIL, SEEDED_PASSWORD } from './session';

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

  test('creating an account requires the full password minimum', async ({
    page,
  }) => {
    await page.goto(`${AUTH_URL}/login`, { waitUntil: 'networkidle' });

    await page.getByLabel('Email').fill('short-password@example.com');
    // Eight characters: what the old rule allowed, and what the new one must
    // refuse. If this ever passes again, the minimum has been lowered.
    await page.getByLabel('Password').fill('12345678');
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page.locator('output')).toContainText(/at least 12/i);
    expect(new URL(page.url()).pathname).toBe('/login');
  });

  test('a short password still reaches the server on sign-in', async ({
    page,
  }) => {
    // The regression this guards is a lockout, not a weakness.
    //
    // One password field serves both buttons. A `minLength` on it would be
    // applied by the browser to sign-in too, so an account whose password
    // predates the new minimum could never submit the form again — no error
    // from the server, just a browser tooltip about length and a form that
    // refuses to go anywhere.
    //
    // The proof that no such client gate exists is that the request is made
    // and the server's own answer comes back.
    await page.goto(`${AUTH_URL}/login`, { waitUntil: 'networkidle' });

    await page.getByLabel('Email').fill('legacy-account@example.com');
    await page.getByLabel('Password').fill('short');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // "not recognised" is the server talking. A client-side block would leave
    // the output element empty.
    await expect(page.locator('output')).toContainText(/not recognised/i);
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

/**
 * The half that needed an account.
 *
 * The suite above says a route is protected and that a failed sign-in reveals
 * nothing; neither needs a user to exist. What could not be written was the
 * successful path — and with it the only test of `safeNext`, the open-redirect
 * guard in login/actions.ts, which until now was correct code with nothing
 * holding it to that.
 *
 * The account comes from supabase/seeds/dev-user.sql. Sign-ins are deliberately
 * few: Supabase rate-limits its token endpoint, and a suite that signs in per
 * test starts failing partway through for a reason it is not testing.
 */
test.describe('signing in', () => {
  test.skip(
    !configured,
    'No SUPABASE_URL: this suite needs a real database. Set it in apps/web/.env.local.',
  );

  test('lands on the page the visitor was originally refused', async ({
    page,
  }) => {
    await page.goto(`${AUTH_URL}/login?next=%2Flocales`, {
      waitUntil: 'networkidle',
    });
    await page.getByLabel('Email').fill(SEEDED_EMAIL);
    await page.getByLabel('Password').fill(SEEDED_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Not merely "somewhere other than /login": being returned to where you
    // were going is the whole point of carrying `next` through the redirect.
    await page.waitForURL(/\/locales$/, { timeout: 30_000 });
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Locales');

    // And the session holds across a fresh load, rather than the redirect being
    // the only moment the visitor is authenticated.
    await page.goto(`${AUTH_URL}/runs`, { waitUntil: 'networkidle' });
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('cannot be used to bounce a visitor to another origin', async ({
    page,
  }) => {
    // `//evil.example` is a protocol-relative URL: the browser reads it as
    // another origin, so `redirect()` would carry a freshly authenticated
    // visitor straight off the site. Phishing that starts on the real login
    // page is the reason this guard exists.
    await page.goto(`${AUTH_URL}/login?next=%2F%2Fevil.example`, {
      waitUntil: 'networkidle',
    });
    await page.getByLabel('Email').fill(SEEDED_EMAIL);
    await page.getByLabel('Password').fill(SEEDED_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await page.waitForURL((url) => !url.pathname.startsWith('/login'), {
      timeout: 30_000,
    });

    // Same origin, and specifically the fallback the guard substitutes.
    expect(new URL(page.url()).origin).toBe(AUTH_URL);
    expect(new URL(page.url()).pathname).toBe('/');
  });
});
