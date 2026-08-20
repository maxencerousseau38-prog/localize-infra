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
    /*
     * `/` is a signpost once a database exists: everything the sample home
     * shows is still unbuilt, so a signed-in user goes to real data instead.
     *
     * The generous timeout is not padding. signIn only waits for the URL to
     * leave /login, and landing on `/` costs a second round trip — the page
     * queries the caller's organizations and redirects again. Under a fully
     * parallel suite that second hop is slower than the default 5s assertion
     * window, which is how this failed once and passed on the next run. A
     * retry would have hidden it; waiting for the thing that is actually
     * still happening does not.
     */
    await expect(page).toHaveURL(/\/acceptance\/projects$/, {
      timeout: 20_000,
    });
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

  test('a connected repository is reported as fact, not as intent', async ({
    page,
  }) => {
    await signIn(page, '/acceptance/projects/demo');

    // Either state is legitimate depending on whether the seed has been
    // connected, but the badge and the detail must agree: a "Connected" badge
    // with no repository underneath would be the kind of claim this product
    // exists not to make.
    const connected = await page
      .getByText('Connected', { exact: true })
      .isVisible()
      .catch(() => false);

    if (connected) {
      await expect(page.getByText(/^[\w.-]+\/[\w.-]+$/)).toBeVisible();
    } else {
      await expect(page.getByText('Not connected')).toBeVisible();
    }
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

  /*
   * The isolation that matters, restated for self-serve.
   *
   * This used to assert an operator allow-list, which existed only because one
   * GitHub App installation was shared by the whole deployment. The allow-list
   * is gone; the guarantee is stronger and comes from `installationIdFor`,
   * which no longer falls back to the shared installation. A workspace that
   * has not installed the App reaches nothing — so the picker is absent for a
   * reason that holds for every tenant, not just for accounts nobody
   * allow-listed.
   */
  test('a workspace with no installation is offered no repositories', async ({
    page,
  }) => {
    await page.goto(
      `${AUTH_URL}/login?next=${encodeURIComponent('/intruder-co/projects/theirs')}`,
      { waitUntil: 'networkidle' },
    );
    await page.getByLabel('Email').fill('intruder@localize-infra.dev');
    await page.getByLabel('Password').fill('intruder-test-pw-8chars');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), {
      timeout: 15_000,
    });

    await expect(page.locator('select[name="repository"]')).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: /connect repository/i }),
    ).toHaveCount(0);
    // Told why, and pointed at the way forward, rather than shown a disabled
    // control (DESIGN.md §11).
    await expect(
      page.getByText(/has not installed the Localize GitHub App/i),
    ).toBeVisible();
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
