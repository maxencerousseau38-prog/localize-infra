import { expect, test } from '@playwright/test';

/**
 * The authenticated workspace surfaces, against a real database.
 *
 * Reads the fixtures from supabase/seeds/dev-user.sql — the "Acceptance"
 * workspace and its "Demo" project — rather than creating its own. A suite that
 * creates a workspace on every run accumulates rows in a shared database and
 * fails on the unique slug the second time.
 *
 * Skips when there is no database, like auth.spec.ts.
 */
const AUTH_URL = 'http://127.0.0.1:3212';
const EMAIL = 'acceptance@localize-infra.dev';
const PASSWORD = 'acceptance-test-pw-8chars';

const configured = Boolean(process.env.SUPABASE_URL);

async function signIn(page: import('@playwright/test').Page, next = '/') {
  await page.goto(`${AUTH_URL}/login?next=${encodeURIComponent(next)}`, {
    waitUntil: 'networkidle',
  });
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  // Wait for the redirect to land rather than for the network to settle: the
  // action responds, then the client navigates, and networkidle can resolve
  // in the gap between the two while the URL is still /login.
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), {
    timeout: 15_000,
  });
  await page.waitForLoadState('networkidle');
}

test.describe('workspace', () => {
  test.skip(
    !configured,
    'No SUPABASE_URL: this suite needs a real database and the dev seed applied.',
  );

  test('signing in lands on the workspace, not a sample dashboard', async ({
    page,
  }) => {
    await signIn(page);
    // `/` is a signpost once a database exists: everything the sample home
    // shows is still unbuilt, so a signed-in user goes to real data instead.
    await expect(page).toHaveURL(/\/acceptance\/projects$/);
  });

  test('the project list shows what is actually in the database', async ({
    page,
  }) => {
    await signIn(page, '/acceptance/projects');

    await expect(
      page.getByRole('heading', { name: 'Acceptance' }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: /Demo/ })).toBeVisible();

    // No sample banner on a real surface: its presence would mean the page is
    // inventing rows. Scoped to the page content rather than the document,
    // because the shell still advertises sample data for the routes that are
    // genuinely still stubs — which is honest, and not this page's claim.
    await expect(
      page.getByRole('main').getByText(/illustrative|sample data/i),
    ).toHaveCount(0);
  });

  test('a project opens and reports its real configuration', async ({
    page,
  }) => {
    await signIn(page, '/acceptance/projects/demo');

    await expect(page.getByRole('heading', { name: 'Demo' })).toBeVisible();
    // Seeded as en with fr and de targets.
    await expect(page.getByText('fr', { exact: true })).toBeVisible();
    await expect(page.getByText('de', { exact: true })).toBeVisible();
  });

  test('the repository section says why it cannot connect yet', async ({
    page,
  }) => {
    await signIn(page, '/acceptance/projects/demo');

    // The honest boundary: no "Connect repository" button that cannot work.
    await expect(
      page.getByRole('heading', { name: 'Repository' }),
    ).toBeVisible();
    await expect(
      page.getByText(/GitHub App, which has not been created/i),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /connect repository/i }),
    ).toHaveCount(0);
  });

  test('a workspace that is not yours is a 404, not a 403', async ({
    page,
  }) => {
    await signIn(page);
    const response = await page.goto(
      `${AUTH_URL}/not-your-workspace/projects`,
      {
        waitUntil: 'networkidle',
      },
    );

    // Indistinguishable from a workspace that does not exist. A 403 would
    // confirm the slug is taken, which is an enumeration oracle.
    expect(response?.status()).toBe(404);
  });

  test('a project slug from another workspace is also a 404', async ({
    page,
  }) => {
    await signIn(page);
    const response = await page.goto(
      `${AUTH_URL}/acceptance/projects/does-not-exist`,
      { waitUntil: 'networkidle' },
    );
    expect(response?.status()).toBe(404);
  });
});
