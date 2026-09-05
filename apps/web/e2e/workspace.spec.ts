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

    /*
     * Seeded as en with fr and de targets.
     *
     * This read the locales as page *text*, which they were while the project
     * page displayed them as badges in a read-only summary row. They are an
     * editable field now, because the column had no write path anywhere in the
     * app and every project therefore had none — which made every run fail
     * before reaching a model. Asserting the field's value keeps the original
     * intent (the page reports its real configuration) and additionally proves
     * the control is populated from the database rather than left blank.
     */
    const targets = page.getByRole('textbox', { name: 'Target locales' });
    await expect(targets).toHaveValue('fr, de');
    await expect(
      page.getByRole('button', { name: 'Save languages' }),
    ).toBeVisible();
  });

  /*
   * The defect this section exists for, asserted end to end: a project with no
   * target locales must say so, because a run over one used to report that
   * every locale failed having attempted none.
   *
   * **It targets 'languages', not 'demo', and that is the point.**
   * `playwright.config.ts` sets `fullyParallel: true`, so a test that mutates a
   * project another test reads loses a race sooner or later. The first version
   * of this mutated 'demo' and restored it afterwards: the suite passed once,
   * left 'demo' with no locales, and failed on the next run inside the test
   * above — which reads them and never writes. Restore discipline cannot fix
   * that, because the reader can run while the value is emptied. The seed
   * therefore carries a second project that only this test touches.
   *
   * Both cases live in one test for the same reason: two tests mutating one row
   * would race each other.
   */
  test('target languages can be emptied, refused and set again', async ({
    page,
  }) => {
    await signIn(page, '/acceptance/projects/languages');

    const targets = page.getByRole('textbox', { name: 'Target locales' });
    const save = page.getByRole('button', { name: 'Save languages' });
    await expect(targets).toHaveValue('fr, de');

    // Emptied: the state that made every run fail before reaching a model.
    await targets.fill('');
    await save.click();
    // "Saved." is rendered from the action's return value, so it cannot appear
    // until the write has happened. Asserting the input instead would be true
    // the instant `fill` returned, which is how the first version of this test
    // finished before its own restore landed.
    await expect(page.getByText('Saved.')).toBeVisible();
    await expect(page.getByText('None configured')).toBeVisible();
    await expect(
      page.getByText('A run needs at least one, or it has nothing to do.'),
    ).toBeVisible();

    // Refused, and nothing written.
    await targets.fill('english');
    await save.click();
    await expect(page.getByText(/not a language tag/)).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole('textbox', { name: 'Target locales' }),
    ).toHaveValue('');

    // Set again, and persisted across a reload rather than merely echoed back.
    await page.getByRole('textbox', { name: 'Target locales' }).fill('fr, de');
    await page.getByRole('button', { name: 'Save languages' }).click();
    await expect(page.getByText('Saved.')).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole('textbox', { name: 'Target locales' }),
    ).toHaveValue('fr, de');
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

  /*
   * Two workspaces, one answer.
   *
   * This test used to visit `/not-your-workspace/projects` alone — a slug that
   * has never existed — and assert 404. That is a true statement about unknown
   * slugs and says nothing about isolation: an absent workspace answers 404
   * whether or not RLS works at all. It carried the name it has now while
   * proving none of it, and passed on every database including empty ones.
   *
   * `intruder-co` exists, belongs to somebody else, and is reachable by its
   * owner — `a workspace with no installation is offered no repositories`
   * signs in as that owner and loads this very workspace. So the pair is the
   * proof: 200 for the owner, 404 for anyone else, same URL. Neither test
   * establishes that alone.
   *
   * Both are asserted together because the guarantee is that they are
   * indistinguishable. A 403 on the real one would confirm the slug is taken,
   * which is an enumeration oracle; a 404 on both is what closes it.
   */
  test('a workspace that is not yours is a 404, not a 403', async ({
    page,
  }) => {
    await signIn(page);

    const unknown = await page.goto(`${AUTH_URL}/not-your-workspace/projects`, {
      waitUntil: 'networkidle',
    });
    expect(unknown?.status()).toBe(404);

    const someoneElses = await page.goto(`${AUTH_URL}/intruder-co/projects`, {
      waitUntil: 'networkidle',
    });
    expect(someoneElses?.status()).toBe(404);
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

  /*
   * The same correction, one level down.
   *
   * This visited `/acceptance/projects/does-not-exist` — and `acceptance` is
   * the workspace the signed-in user owns. It asserted that an unknown project
   * in your *own* workspace is a 404, under a name promising another
   * workspace's project. Both halves are worth asserting; only one of them was.
   *
   * `intruder-co/theirs` is a project that genuinely exists and belongs to
   * somebody else, so the 404 here comes from RLS rather than from an empty
   * result set.
   */
  test('a project slug from another workspace is also a 404', async ({
    page,
  }) => {
    await signIn(page);

    const mineButAbsent = await page.goto(
      `${AUTH_URL}/acceptance/projects/does-not-exist`,
      { waitUntil: 'networkidle' },
    );
    expect(mineButAbsent?.status()).toBe(404);

    const theirsAndReal = await page.goto(
      `${AUTH_URL}/intruder-co/projects/theirs`,
      { waitUntil: 'networkidle' },
    );
    expect(theirsAndReal?.status()).toBe(404);
  });
});
