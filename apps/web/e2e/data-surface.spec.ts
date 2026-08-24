import { type Page, expect, test } from '@playwright/test';
import { STORAGE_STATE } from './session';

/**
 * The data-surface contract (DESIGN.md §8), against real rows.
 *
 * "A data surface is incomplete without: a result count, a filter or search
 * affordance, sortable columns where more than one order is meaningful, and a
 * designed empty, loading and error state."
 *
 * These were skipped wholesale, and the reason given was a missing fixture
 * rather than a missing secret: a database alone is not enough, they need a
 * confirmed account, a workspace, a project and runs that produced rows.
 * `supabase/seeds/dev-user.sql` seeds exactly that now — two runs against the
 * Acceptance workspace, one that finished and opened a pull request and one
 * stopped at `awaiting_review` with an unanswered question. Two rather than one
 * because every assertion here is about telling states apart.
 *
 * They target port 3212, the server that inherits the ambient environment, and
 * skip when there is no database. Being honest about the consequence: they do
 * not run in CI, which has no Supabase credentials. They run for a developer
 * with apps/web/.env.local and the seed applied.
 */
const DB_URL = 'http://127.0.0.1:3212';

const configured = Boolean(process.env.SUPABASE_URL);

/*
 * A longer action timeout than the shell suite's default 5s, and the reason is
 * latency rather than flakiness.
 *
 * Every navigation here is a server render that makes round-trips to a hosted
 * Supabase project, and `fullyParallel` points several browsers at one
 * `next start` process at once. Under that contention a control can take more
 * than five seconds to become actionable — which is the suite waiting on a
 * network, not the product being slow to respond to a user. Left at 5s, one of
 * these failed intermittently on a click while passing in isolation.
 */
test.use({
  baseURL: DB_URL,
  actionTimeout: 15_000,
  storageState: STORAGE_STATE,
});

test.skip(
  !configured,
  'No SUPABASE_URL. These need a database with supabase/seeds/dev-user.sql applied.',
);

/**
 * Go to a page as the seeded user.
 *
 * The session comes from the `setup` project (e2e/auth.setup.ts), which signs
 * in once for the whole run. This used to sign in per test — eighteen times a
 * pass — and Supabase rate-limited the token endpoint partway through, so the
 * back half of the file failed on /login for a reason none of it was testing.
 */
async function open(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');

  // A redirect to /login means the stored session did not apply, which would
  // otherwise surface as every assertion below missing its element.
  await expect(page, 'the stored session did not authenticate').not.toHaveURL(
    /\/login/,
  );
}

test.describe('/runs', () => {
  test('states its result count', async ({ page }) => {
    await open(page, '/runs');
    await expect(page.getByText('2 runs')).toBeVisible();
  });

  test('the filter narrows to the run that needs a person', async ({
    page,
  }) => {
    await open(page, '/runs');
    await expect(page.locator('tbody tr')).toHaveCount(2);

    await page
      .getByRole('group', { name: 'Filter runs by status' })
      .getByText('Needs you', { exact: true })
      .click();

    // One of the two seeded runs is escalated, and it is the one that survives.
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await expect(
      page.getByRole('table').getByText('Needs your call'),
    ).toBeVisible();
  });

  test('search narrows the rows and the empty state offers a way back', async ({
    page,
  }) => {
    await open(page, '/runs');

    await page
      .getByLabel('Search runs by framework or pull request')
      .fill('zzz-no-such-framework');

    // Scoped to the table. /runs renders the same rows a second way below `md`
    // — records rather than a truncated table — so the empty copy and its reset
    // action exist twice in the document, once hidden at this viewport. An
    // unscoped lookup resolves to whichever comes first and asserts visibility
    // against a `display: none` node.
    const table = page.getByRole('table');

    // The empty state renders inside the body, so the headers survive.
    await expect(table.getByText('No runs match')).toBeVisible();
    await expect(page.locator('thead')).toBeVisible();

    // The reset action names its outcome rather than repeating "Clear search",
    // which is already the accessible name of the input's own X. Two controls
    // sharing one name on a screen is ambiguous to anyone navigating by name.
    await table.getByRole('button', { name: 'Show all runs' }).click();
    await expect(page.locator('tbody tr')).toHaveCount(2);
  });

  test('search matches the fields a run actually carries', async ({ page }) => {
    await open(page, '/runs');

    // Both seeded runs record `Vite + React`, and neither carries a trigger
    // command — the field this box used to be labelled for. Searching the
    // framework is what the label now promises, so it has to hold.
    await page
      .getByLabel('Search runs by framework or pull request')
      .fill('vite');
    await expect(page.locator('tbody tr')).toHaveCount(2);

    // Only the finished run opened a pull request.
    await page.getByLabel('Search runs by framework or pull request').fill('1');
    await expect(page.locator('tbody tr')).toHaveCount(1);
  });

  test('sorting is announced through aria-sort, not position alone', async ({
    page,
  }) => {
    await open(page, '/runs');

    const sortable = page.locator('th[aria-sort]');
    expect(await sortable.count()).toBeGreaterThan(0);

    // Exactly one column is the active sort at any time.
    await expect(page.locator('th[aria-sort="descending"]')).toHaveCount(1);

    const first = sortable.first();
    const before = await first.getAttribute('aria-sort');
    await first.getByRole('button').click();
    await expect(first).not.toHaveAttribute('aria-sort', before ?? '');
  });

  test('the status filter is a real radiogroup, not buttons wearing the role', async ({
    page,
  }) => {
    await open(page, '/runs');

    // A hand-rolled radiogroup without roving tabindex makes every option a tab
    // stop and leaves arrow keys dead. Both halves are checked because the
    // first implementation passed axe while failing the keyboard model.
    await page.getByRole('radio', { name: 'All' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('radio', { name: 'Needs you' })).toBeChecked();

    await page.keyboard.press('Tab');
    await expect(
      page.getByLabel('Search runs by framework or pull request'),
    ).toBeFocused();
  });

  test('page titles step down below sm (DESIGN.md §3.4)', async ({ page }) => {
    await open(page, '/runs');

    await page.setViewportSize({ width: 390, height: 800 });
    const small = await page
      .locator('h1')
      .evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize));

    await page.setViewportSize({ width: 1440, height: 900 });
    const large = await page
      .locator('h1')
      .evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize));

    // 28px at every width from 390 to 1920 was the audit finding.
    expect(small).toBeLessThan(large);
    expect(small).toBe(20);
    expect(large).toBe(28);
  });

  /**
   * URL-addressable state (DESIGN.md §9).
   *
   * The rule has been in the design document since its first draft and lived
   * nowhere in the code: filter and sort were `useState`, so no view could be
   * shared, bookmarked, or survive a refresh — on a product whose users work by
   * sending each other links. Pinned here because it is invisible to every
   * other check: the surface looks and behaves identically until you reload it.
   */
  test('the filter survives a reload and can be shared as a link', async ({
    page,
  }) => {
    await open(page, '/runs');
    const filter = page.getByRole('group', { name: 'Filter runs by status' });

    // Defaults are never written — a pristine surface has a clean address bar.
    expect(new URL(page.url()).search).toBe('');

    await filter.getByText('Needs you', { exact: true }).click();
    await expect(page.getByRole('radio', { name: 'Needs you' })).toBeChecked();
    expect(new URL(page.url()).search).toContain('status=awaiting_review');

    // The actual requirement: a fresh load of that URL reproduces the view.
    await page.goto(page.url());
    await expect(page.getByRole('radio', { name: 'Needs you' })).toBeChecked();
    await expect(page.locator('tbody tr')).toHaveCount(1);

    // Returning to the default drops the parameter rather than pinning it.
    await filter.getByText('All', { exact: true }).click();
    await expect(page.getByRole('radio', { name: 'All' })).toBeChecked();
    expect(new URL(page.url()).search).not.toContain('status=');
  });

  /**
   * The small-screen arrangement carries the whole record.
   *
   * /runs used to drop columns at breakpoints until a 390px screen showed
   * status, command and a relative time. Locales, strings, duration and the
   * pull request were not scrolled off — they were `display: none`, so a
   * developer checking a run from a phone could not reach them at all. Pinned
   * because nothing else catches it: the desktop table is unchanged and every
   * other check runs wide.
   */
  test('a run exposes every fact at 390 (DESIGN.md §3.4)', async ({ page }) => {
    await open(page, '/runs');
    await page.setViewportSize({ width: 390, height: 900 });

    // The table is the desktop arrangement and must be out of the way here.
    await expect(page.getByRole('table')).toBeHidden();

    const record = page.getByRole('listitem').filter({ hasText: 'Succeeded' });
    await expect(record).toBeVisible();

    for (const fact of ['Locales', 'Strings', 'Duration', 'Output']) {
      await expect(
        record.getByText(fact, { exact: true }),
        `a run record hides ${fact} at 390`,
      ).toBeVisible();
    }

    // The record still reaches its detail page from here.
    await expect(record.getByRole('link')).toHaveAttribute(
      'href',
      /^\/runs\/[0-9a-f-]{36}$/,
    );
  });
});

/**
 * /locales, which is a list rather than a table.
 *
 * Stated plainly because the previous version of this file asserted a result
 * count, a search box and a sortable header here, and none of the three exist
 * any more: the sortable table was replaced by `LocaleCoverageList` when
 * coverage stopped being five invented languages with invented percentages and
 * became a figure derived from the last run.
 *
 * That is a knowing narrowing of DESIGN.md §8, not an oversight. A project has
 * as many rows here as it has target languages — two, in the seed — and search
 * and sort over two rows are affordances that exist to be screenshotted. The
 * count and the empty state, which carry information at any size, are kept and
 * asserted below. If this page ever ranges over many projects at once it needs
 * its table back, and this comment is the record of why it does not have one.
 */
test.describe('/locales', () => {
  test('reports coverage computed from the last run', async ({ page }) => {
    await open(page, '/locales');

    // Both seeded target languages, named rather than coded.
    await expect(page.getByText('French')).toBeVisible();
    await expect(page.getByText('German')).toBeVisible();

    // The count lives in the header rather than a toolbar, and it agrees with
    // what is drawn — one coverage bar per language, no more and no fewer.
    // Exact: the page's own purpose line ("Which languages are current…")
    // contains the word too, and an unscoped lookup matches both.
    await expect(page.getByText('Languages', { exact: true })).toBeVisible();
    await expect(page.getByRole('progressbar')).toHaveCount(2);
  });

  test('a language with an unanswered question is not reported as current', async ({
    page,
  }) => {
    await open(page, '/locales');

    // German carries the seeded ambiguity. Iris, and DESIGN.md §1.4's rule that
    // it means "your judgement is required" — a language waiting on a person
    // must not read the same as one that is finished.
    await expect(page.getByText('Needs a decision')).toBeVisible();
    await expect(page.getByText(/1 question waiting/)).toBeVisible();
  });

  test('a language exposes its state and counts at 390 (DESIGN.md §3.4)', async ({
    page,
  }) => {
    await open(page, '/locales');
    await page.setViewportSize({ width: 390, height: 900 });

    const record = page.getByRole('listitem').filter({ hasText: 'German' });
    await expect(record).toBeVisible();

    // The full label, not a truncation of it — "Needs a dec…" was the finding.
    await expect(record.getByText('Needs a decision')).toBeVisible();

    // Nothing may overflow its own record box at this width.
    const clipped = await page.evaluate(
      () =>
        [...document.querySelectorAll('li')].filter(
          (el) => el.scrollWidth > el.clientWidth + 1,
        ).length,
    );
    expect(clipped, 'records clipping their own content').toBe(0);
  });
});

/**
 * The run detail, on a real run.
 *
 * These assertions previously navigated to `/runs/run-8f2a`, a fixture id, and
 * read a per-locale table with a `Commit` column — neither of which a recorded
 * run has. The page reads `runs`, `run_translations` and `run_ambiguities` now,
 * so the run has to exist, and the one worth asserting over is the escalated
 * one: a run that stopped for a person is the state the whole gate exists to
 * produce.
 */
test.describe('a run detail', () => {
  async function openEscalatedRun(page: Page) {
    await open(page, '/runs');
    await page.getByRole('link', { name: /run .*needs your call/i }).click();
    await expect(page).toHaveURL(/\/runs\/[0-9a-f-]{36}$/);
  }

  test('draws all five stages in pipeline order', async ({ page }) => {
    await openEscalatedRun(page);

    // Named from PIPELINE_STAGES — DESIGN.md §1.4's single vocabulary. Order is
    // asserted rather than membership: the sequence is the information.
    const stages = page.getByRole('list', { name: 'Pipeline stages' });
    await expect(stages.locator('> li')).toHaveCount(5);

    const text = ((await stages.textContent()) ?? '').toLowerCase();
    const ORDER = [
      ['detect', 'extract'],
      ['extract', 'translate'],
      ['translate', 'escalate'],
      ['escalate', 'pull request'],
    ] as const;

    for (const [earlier, later] of ORDER) {
      expect(
        text.indexOf(later),
        `"${later}" does not follow "${earlier}"`,
      ).toBeGreaterThan(text.indexOf(earlier));
    }
  });

  test('says what to do about a run that is waiting on somebody', async ({
    page,
  }) => {
    await openEscalatedRun(page);

    // One unanswered question, counted rather than described vaguely, and the
    // page names where the answering happens — this surface cannot resolve it.
    await expect(page.getByText(/1 question waiting on you/i)).toBeVisible();
    await expect(page.getByText(/project page/i)).toBeVisible();
  });

  /*
   * The regression that prompted this test.
   *
   * `findRun` selected fifteen columns while `RunRecord` declared seventeen,
   * and `started_at`, `finished_at` and `progress_at` were among the missing.
   * The `as RunRecord` cast made it typecheck, so the page read `undefined`
   * from all three: every run showed "—" for duration, and `runProgress` reads
   * a missing heartbeat as "nothing to judge against" and reports the run
   * active — so the stalled banner could never appear here at all.
   *
   * It stayed invisible because the list pages selected the columns and behaved
   * correctly. The same run looked right in the list and blank in the detail.
   *
   * Asserted on the seeded run rather than on any run, because the seed sets
   * these timestamps deliberately — it carries a comment about two runs once
   * sharing a `now()` and both rendering a zero duration. The fixture was
   * built to make this number mean something, and the page was dropping it.
   */
  test('shows how long the run took, which needs a column it once dropped', async ({
    page,
  }) => {
    await openEscalatedRun(page);

    const duration = page
      .getByRole('definition')
      .filter({ hasText: /^\d+(\.\d+)?(ms|s)$/ });
    await expect(duration.first()).toBeVisible();
  });

  test('keeps its facts reachable at 390', async ({ page }) => {
    await openEscalatedRun(page);
    await page.setViewportSize({ width: 390, height: 900 });

    // `PageHeader` carried `shrink-0` on the column holding the metadata, so
    // that column never narrowed and its `flex-wrap` never fired: the page
    // rendered 828px wide inside a 390px viewport.
    for (const label of ['Status', 'Duration', 'Strings', 'When']) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );
    expect(
      overflow,
      'the run detail scrolls sideways at 390',
    ).toBeLessThanOrEqual(390);
  });

  test('the finished run links the pull request it opened', async ({
    page,
  }) => {
    await open(page, '/runs');
    await page.getByRole('link', { name: /run .*succeeded/i }).click();

    // Invariant 2: the pull request is what a run is for, so it is the page's
    // primary action rather than a number in a column.
    const link = page.getByRole('link', { name: /pull request #1/i });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute(
      'href',
      /^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/1$/,
    );
  });
});

/**
 * /ambiguity and /review, on the same fixture.
 *
 * Both were sample surfaces until they began reading Postgres, and neither had
 * a check that ran against a row anybody had recorded.
 */
test.describe('the inboxes', () => {
  test('/ambiguity shows the unanswered question and its alternatives', async ({
    page,
  }) => {
    await open(page, '/ambiguity');

    await expect(page.getByText('app.close')).toBeVisible();
    await expect(page.getByText(/verb or adjective/i)).toBeVisible();

    // Two readings were recorded. Rendering the proposal without saying so
    // would present a guess as the only option, which is invariant 4 inverted.
    await expect(page.getByText(/2 alternatives/)).toBeVisible();
  });

  test('/review shows wording from the run that stopped, not one that shipped', async ({
    page,
  }) => {
    await open(page, '/review');

    // The escalated run proposed `app.close`; the finished one proposed
    // `app.save` and `app.cancel`. Only the first is waiting on anybody, and
    // asking for a decision on a run that already opened its pull request is
    // asking for one that has no effect.
    await expect(page.getByText('app.close').first()).toBeVisible();
    await expect(page.getByText('app.save')).toHaveCount(0);
    await expect(page.getByText('app.cancel')).toHaveCount(0);
  });
});
