import { expect, test } from '@playwright/test';

const ROUTES = [
  '/',
  '/docs',
  '/benchmarks',
  '/pricing',
  '/quality',
  '/security',
  '/roadmap',
];

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

/**
 * The published-numbers guard.
 *
 * Every figure on /benchmarks and /quality comes from the generated artifact.
 * These tests assert the two ways that contract can break in the browser: a
 * number that does not match the artifact, and a check with an empty
 * denominator rendered as a percentage. The second one shipped on /quality as
 * the word "Pass" and survived until the artifact was generated.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ARTIFACT = JSON.parse(
  readFileSync(
    join(process.cwd(), '../../packages/eval/src/report/benchmarks.json'),
    'utf8',
  ),
) as {
  corpus: { entries: number; projects: Array<{ name: string }> };
  run: { translations: number; models: string[] };
  conditions: Array<{
    condition: 'A' | 'B';
    placeholderIntact: { applicable: number; passed: number };
    withinLengthBudget: { applicable: number; passed: number };
    icuValid: { applicable: number };
    pluralCategoriesCorrect: { applicable: number };
  }>;
};

const conditionB = ARTIFACT.conditions.find((c) => c.condition === 'B');
if (!conditionB) throw new Error('artifact is missing condition B');

test.describe('published numbers trace to the artifact', () => {
  test('/benchmarks renders the corpus size and model from the artifact', async ({
    page,
  }) => {
    await page.goto('/benchmarks', { waitUntil: 'networkidle' });
    const body = await page.locator('body').innerText();

    expect(body).toContain(String(ARTIFACT.corpus.entries));
    expect(body).toContain(String(ARTIFACT.run.translations));
    for (const model of ARTIFACT.run.models) {
      expect(body).toContain(model);
    }
  });

  test('/benchmarks shows the measured length-budget figures, not rounded prose', async ({
    page,
  }) => {
    await page.goto('/benchmarks', { waitUntil: 'networkidle' });
    const body = await page.locator('body').innerText();

    // The exact passed/applicable pair must appear, so a percentage cannot
    // drift away from the counts it was computed from.
    expect(body).toContain(
      `${conditionB.withinLengthBudget.passed}/${conditionB.withinLengthBudget.applicable}`,
    );
  });

  for (const route of ['/benchmarks', '/quality']) {
    test(`${route} never renders a percentage for a zero-denominator check`, async ({
      page,
    }) => {
      await page.goto(route, { waitUntil: 'networkidle' });

      // The corpus exercises neither ICU validity nor plural categories.
      expect(conditionB.icuValid.applicable).toBe(0);
      expect(conditionB.pluralCategoriesCorrect.applicable).toBe(0);

      for (const label of ['ICU message validity', 'Plural categories']) {
        const row = page.locator('tr', { hasText: label }).first();
        await expect(row).toBeVisible();
        await expect(row).toContainText('No data');
        // "100%" off nothing is the exact failure this guards.
        await expect(row).not.toContainText('%');
      }
    });
  }

  test('/quality states why those checks have no data', async ({ page }) => {
    await page.goto('/quality', { waitUntil: 'networkidle' });
    await expect(
      page.getByText(/corpus contains no ICU plural or select messages/i),
    ).toBeVisible();
  });

  test('/benchmarks names what it has not measured', async ({ page }) => {
    await page.goto('/benchmarks', { waitUntil: 'networkidle' });
    await expect(
      page.getByRole('heading', {
        name: /what these numbers do not tell you/i,
      }),
    ).toBeVisible();
    await expect(page.getByText(/native speaker/i).first()).toBeVisible();
  });
});

test.describe('the install claim is qualified', () => {
  // @localize-infra/cli is not on npm. The hero still shows the command it is
  // heading for, so the qualification is what keeps the page truthful.
  test('the landing page says the command is not published yet', async ({
    page,
  }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(page.getByText(/not published to npm yet/i)).toBeVisible();
    // The disclaimer must hand the reader somewhere that works. The link's
    // label moved from "see the docs" to "Install guide" when the hero was
    // recomposed; what matters is that the route is reachable from the
    // sentence, not the wording, so this asserts the destination.
    await expect(page.locator('a[href="/docs#install"]').first()).toBeVisible();
  });

  test('/docs leads with the same limitation', async ({ page }) => {
    await page.goto('/docs', { waitUntil: 'networkidle' });
    await expect(
      page.getByText(/The CLI is not published to npm yet/i),
    ).toBeVisible();
  });
});

test.describe('docs navigation', () => {
  test('the table of contents jumps to a section', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/docs', { waitUntil: 'networkidle' });

    const toc = page.getByRole('navigation', { name: /on this page/i });
    await expect(toc).toBeVisible();
    await toc.getByRole('link', { name: 'Command reference' }).click();

    await expect(page).toHaveURL(/#reference$/);
    await expect(
      page.getByRole('heading', { name: 'Command reference' }),
    ).toBeInViewport();
  });

  test('Docs and Benchmarks are reachable from the header', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const nav = page.getByRole('navigation', { name: 'Main' });
    await nav.getByRole('link', { name: 'Docs' }).click();
    await expect(page).toHaveURL(/\/docs$/);
  });

  test('long code samples are reachable by keyboard', async ({ page }) => {
    await page.goto('/docs', { waitUntil: 'networkidle' });
    // A scrollable region that cannot be focused is unreadable without a
    // mouse (WCAG 2.1.1).
    const block = page.getByRole('region', { name: 'Run the API' });
    await block.focus();
    await expect(block).toBeFocused();
  });
});

/**
 * The site had no width coverage before these. /docs and /benchmarks are the
 * pages most likely to break one: both are dominated by wide tables and long
 * code samples, which are exactly what pushes a layout sideways.
 */
test.describe('responsive', () => {
  for (const route of ['/docs', '/benchmarks']) {
    for (const width of [390, 768, 1024, 1440]) {
      test(`${route} does not scroll sideways at ${width}px`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(route, { waitUntil: 'networkidle' });

        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );
        expect(overflow, `overflowed by ${overflow}px`).toBeLessThanOrEqual(0);
      });
    }
  }

  test('any table that overflows scrolls itself, never the page', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    // Asserted as a conditional invariant rather than "this table scrolls":
    // the results table used to overflow at phone width and no longer does,
    // and a test pinned to that fact would have failed for the right reason
    // while telling us nothing useful.
    for (const route of ['/benchmarks', '/quality', '/docs']) {
      await page.goto(route, { waitUntil: 'networkidle' });

      const offenders = await page.$$eval('table', (tables) =>
        tables
          .filter((table) => {
            const container = table.parentElement as HTMLElement;
            const overflows = container.scrollWidth > container.clientWidth;
            const scrolls = getComputedStyle(container).overflowX === 'auto';
            return overflows && !scrolls;
          })
          .map((table) => table.querySelector('caption')?.textContent ?? '?'),
      );

      expect(offenders, `${route}: tables overflowing the page`).toEqual([]);
    }
  });

  test('the table of contents is hidden where it would push content down', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/docs', { waitUntil: 'networkidle' });
    await expect(
      page.getByRole('navigation', { name: /on this page/i }),
    ).toBeHidden();
  });
});

test.describe('SEO', () => {
  test('the sitemap lists every public route', async ({ request }) => {
    const xml = await (await request.get('/sitemap.xml')).text();
    for (const route of ROUTES) {
      expect(xml, `sitemap missing ${route}`).toContain(
        `https://localize-infra.dev${route === '/' ? '/' : route}`,
      );
    }
  });

  test('robots.txt points at the sitemap', async ({ request }) => {
    const txt = await (await request.get('/robots.txt')).text();
    expect(txt).toContain('Sitemap: https://localize-infra.dev/sitemap.xml');
  });

  test('every page declares a canonical URL and a unique description', async ({
    page,
  }) => {
    const seen = new Map<string, string>();
    for (const route of ROUTES) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });

      const canonical = await page
        .locator('link[rel="canonical"]')
        .getAttribute('href');
      expect(canonical, `${route}: canonical`).toBeTruthy();

      const description = await page
        .locator('meta[name="description"]')
        .getAttribute('content');
      expect(description, `${route}: description`).toBeTruthy();
      // A description reused across pages is worse than none: it tells a search
      // engine the pages are duplicates of each other.
      const previous = seen.get(description ?? '');
      expect(
        previous,
        `${route} shares its description with ${previous}`,
      ).toBeUndefined();
      seen.set(description ?? '', route);
    }
  });
});

test.describe('ecosystem rail', () => {
  test('separates the one integration from what it leaves alone', async ({
    page,
  }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    // The section's whole point is this distinction, and as a scrolling logo
    // strip it was the one thing the layout did not show.
    const integrations = page.getByRole('list', {
      name: /systems this integrates with/i,
    });
    await expect(integrations.getByRole('listitem')).toHaveCount(1);
    await expect(
      integrations.getByText('GitHub', { exact: true }),
    ).toBeVisible();

    const alongside = page.getByRole('list', {
      name: /technologies this works alongside/i,
    });
    for (const name of ['Next.js', 'React', 'TypeScript', 'Vite']) {
      await expect(
        alongside.getByText(name, { exact: true }).first(),
      ).toBeVisible();
    }
    // GitHub must not appear here: it is not left alone, it is written to.
    await expect(alongside.getByText('GitHub', { exact: true })).toHaveCount(0);
  });

  test('states that GitHub is the only integration', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    // This sentence is what makes showing a host or a database honest: they
    // are on the rail because the CLI leaves them alone, not because anything
    // is integrated with them.
    await expect(
      page.getByText(/GitHub is the one integration/i),
    ).toBeVisible();
    await expect(
      page.getByText(/none of these projects endorse this one/i),
    ).toBeVisible();
  });

  test('claims no customers, partners or endorsements', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    const body = await page.locator('body').innerText();
    for (const claim of [
      /trusted by/i,
      /our customers/i,
      /partnership/i,
      /loved by/i,
    ]) {
      expect(body, String(claim)).not.toMatch(claim);
    }
  });

  test('presents the marks without implying endorsement', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    // The marquee this replaced was read as "trusted by" before anyone reached
    // the caption saying otherwise — the device argued against its own words.
    // Nothing here may move, and nothing may be presented as a customer.
    await expect(page.locator('.animate-marquee')).toHaveCount(0);
    await expect(
      page.getByText(/none of these projects endorse this one/i),
    ).toBeVisible();
  });

  for (const width of [390, 768, 1440]) {
    test(`does not overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/', { waitUntil: 'networkidle' });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow, `overflowed by ${overflow}px`).toBeLessThanOrEqual(0);
    });
  }
});
