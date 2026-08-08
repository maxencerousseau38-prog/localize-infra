import { expect, test } from '@playwright/test';

/**
 * The app's performance budget is different from the marketing site's.
 *
 * apps/site optimises first paint, because it is the acquisition surface. This
 * app is rendered dynamically on every request by design — a per-request CSP
 * nonce rules out static generation — so its budget is interaction, not LCP.
 * The number that matters is how long the shell takes to become usable, and
 * whether it shifts under the reader once it does.
 */
test('no layout shift after load', async ({ page }) => {
  await page.goto('/design', { waitUntil: 'networkidle' });
  const cls = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let total = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as (PerformanceEntry & {
            value: number;
            hadRecentInput: boolean;
          })[]) {
            if (!entry.hadRecentInput) total += entry.value;
          }
        }).observe({ type: 'layout-shift', buffered: true });
        setTimeout(() => resolve(total), 1000);
      }),
  );
  expect(cls, `CLS was ${cls}`).toBeLessThan(0.02);
});

/**
 * The palette is the primary navigation for the audience this product is built
 * for. The design system commits to opening in under 50ms; a slow palette is an
 * unused palette. Measured after warm-up so this tests the component, not the
 * first-load compile.
 */
test('the command palette opens within its budget', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });

  const trigger = page.getByRole('button', { name: /search/i });
  await trigger.click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('combobox')).toHaveCount(0);

  const elapsed = await page.evaluate(async () => {
    const start = performance.now();
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }),
    );
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    return performance.now() - start;
  });

  await expect(page.getByRole('combobox')).toBeVisible();
  // Two frames of headroom above the 50ms commitment: this measures through a
  // real render and paint, so a hard 50ms would be flaky rather than strict.
  expect(elapsed, `palette opened in ${Math.round(elapsed)}ms`).toBeLessThan(
    100,
  );
});

const jsBytes = (page: import('@playwright/test').Page) =>
  page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .filter((e) => e.name.endsWith('.js'))
      .reduce(
        (sum, e) => sum + (e as PerformanceResourceTiming).encodedBodySize,
        0,
      ),
  );

/**
 * The shell must not ship the whole component library to render a page that
 * says it has no data.
 *
 * The budget is 250kB against a measured 183kB — tight enough that pulling the
 * gallery, or any comparable module, into the shared chunk trips it. A looser
 * number would pass unconditionally and test nothing.
 */
test('a stub route stays within its JavaScript budget', async ({ page }) => {
  await page.goto('/ambiguity', { waitUntil: 'networkidle' });
  const bytes = await jsBytes(page);

  expect(bytes).toBeGreaterThan(0);
  expect(
    bytes,
    `stub route shipped ${Math.round(bytes / 1024)}kB of JavaScript`,
  ).toBeLessThan(250 * 1024);
});

/**
 * Code splitting is doing its job only if the gallery costs something to visit
 * and nothing to skip. Asserting the *relationship* rather than two absolute
 * numbers means this keeps working as the shell legitimately grows.
 */
test('the design gallery is split out of the shell', async ({ page }) => {
  await page.goto('/ambiguity', { waitUntil: 'networkidle' });
  const stub = await jsBytes(page);

  await page.goto('/design', { waitUntil: 'networkidle' });
  const gallery = await jsBytes(page);

  expect(
    gallery,
    `gallery ${Math.round(gallery / 1024)}kB vs stub ${Math.round(stub / 1024)}kB`,
  ).toBeGreaterThan(stub);
});
