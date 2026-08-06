import { expect, test } from '@playwright/test';

/**
 * The marketing site's job is fast first paint — it is the acquisition surface,
 * and LCP is the budget the architecture doc actually commits to (< 1.2s p75 on
 * 4G). Bundle size matters only insofar as it moves this number: the page is
 * statically prerendered and its JavaScript is deferred, so HTML, CSS and font
 * delivery dominate what a visitor perceives.
 */
test('landing page meets the LCP budget', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });

  const lcp = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const last = entries[entries.length - 1];
          resolve(last ? last.startTime : 0);
        }).observe({ type: 'largest-contentful-paint', buffered: true });
        setTimeout(() => resolve(0), 3000);
      }),
  );

  expect(lcp, `LCP was ${Math.round(lcp)}ms`).toBeLessThan(1200);
});

test('no layout shift after load', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
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
  // Skeletons and reserved widths exist precisely to keep this near zero.
  expect(cls, `CLS was ${cls}`).toBeLessThan(0.02);
});
