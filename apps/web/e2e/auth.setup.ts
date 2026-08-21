import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { expect, test as setup } from '@playwright/test';
import { SEEDED_EMAIL, SEEDED_PASSWORD, STORAGE_STATE } from './session';

/**
 * Sign in once, and let every data-surface test reuse the session.
 *
 * Written because the alternative broke. Each test signed in for itself, which
 * is eighteen sign-ins per pass, and Supabase rate-limits its token endpoint:
 * the first ten or so tests passed and the rest sat on /login until
 * `waitForURL` gave up. Nothing about the product was wrong — the suite was
 * hammering an auth endpoint to test pages that are not about auth.
 *
 * It is also the honest division of labour. Signing in is e2e/auth.spec.ts's
 * subject; here it is a precondition, and a precondition that runs eighteen
 * times is eighteen chances to fail for a reason the test is not about.
 *
 * The seeded account comes from supabase/seeds/dev-user.sql. The state file is
 * gitignored: it holds a real (development) session token.
 */
setup('authenticate as the seeded user', async ({ page }) => {
  mkdirSync(dirname(STORAGE_STATE), { recursive: true });

  /*
   * Without a database there is nothing to sign into, and the suites that use
   * this state skip themselves. An empty state file is still written, because
   * Playwright resolves `storageState` when it builds the context and a missing
   * path is a hard error — including for a test that is about to skip.
   */
  if (!process.env.SUPABASE_URL) {
    if (!existsSync(STORAGE_STATE)) {
      writeFileSync(STORAGE_STATE, '{"cookies":[],"origins":[]}');
    }
    setup.skip(true, 'No SUPABASE_URL: there is no account to sign in as.');
    return;
  }

  await page.goto('http://127.0.0.1:3212/login');
  await page.getByLabel('Email').fill(SEEDED_EMAIL);
  await page.getByLabel('Password').fill(SEEDED_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();

  // Waits for the redirect to land rather than for the network to settle: the
  // server action responds and *then* the client navigates, so `networkidle`
  // resolves in the gap while the page is still the login form.
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), {
    timeout: 30_000,
  });

  // Fail here rather than leaving every downstream test to discover it. A
  // session file written from a page that never authenticated is an empty file
  // that produces eighteen redirect-to-login failures and no explanation.
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  await page.context().storageState({ path: STORAGE_STATE });
});
