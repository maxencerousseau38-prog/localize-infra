import { PIPELINE_STAGES } from '@localize-infra/ui';
import { expect, test } from '@playwright/test';

/**
 * The pipeline is the product's visual identity (DESIGN.md §1.4), and its
 * stages are defined once in `PIPELINE_STAGES`.
 *
 * This asserts the landing page actually explains all of them. It is not a
 * hypothetical guard: the page previously ran detect → translate → pull
 * request and omitted Escalate, so the section explaining how the product
 * works left out the one behaviour the product is built around — that the
 * agent surfaces ambiguity rather than guessing at it.
 *
 * Checked against rendered text rather than the source array, because a step
 * that exists in the data and never reaches the page would pass the weaker
 * test and still fail the reader.
 */

/** The section, located by its heading — "How it works" above it is an eyebrow. */
function steps(page: import('@playwright/test').Page) {
  return page
    .getByRole('list')
    .filter({ hasText: 'Detect and extract' })
    .first();
}

test('how it works explains every canonical pipeline stage', async ({
  page,
}) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: /One command, four steps/i }),
  ).toBeVisible();

  const text = ((await steps(page).textContent()) ?? '').toLowerCase();

  for (const stage of PIPELINE_STAGES) {
    expect(
      text,
      `the landing page never mentions the "${stage.name}" stage`,
    ).toContain(stage.name.toLowerCase());
  }
});

test('the steps are numbered in pipeline order', async ({ page }) => {
  await page.goto('/');
  const items = steps(page).locator('> li');
  await expect(items).toHaveCount(4);

  // Escalate must come after Translate: you cannot escalate an ambiguity you
  // have not yet tried to resolve, and the order is the argument.
  const body = ((await steps(page).textContent()) ?? '').toLowerCase();
  expect(body.indexOf('escalate')).toBeGreaterThan(body.indexOf('translate'));
  expect(body.indexOf('pull request')).toBeGreaterThan(
    body.indexOf('escalate'),
  );
});

/**
 * The State Rule is the design system's signature (DESIGN.md §1.4, §5.2) and is
 * 3px. The hero drew its own at 2px for as long as it existed — invisible in
 * review, because 2px and 3px look identical until measured side by side.
 *
 * The hero no longer carries a State Rule at all: its panel became a source
 * file and a diff, and a hand-rolled rule there would have been the same bug in
 * a new place. So this now sweeps every page that does use the rule, and it
 * catches a local copy wherever one appears rather than only in the hero.
 *
 * The band is the whole point. Anything drawing a leading edge thicker than a
 * hairline is trying to be the signature, so it has to measure 3px exactly;
 * genuine 1px hairlines are ignored, and a 2px copy cannot hide.
 */
const RULE_PAGES = ['/benchmarks', '/docs', '/pricing', '/quality'];

for (const path of RULE_PAGES) {
  test(`${path} draws the 3px State Rule, not a local copy`, async ({
    page,
  }) => {
    await page.goto(path);

    const widths = await page.evaluate(() =>
      [...document.querySelectorAll('*')]
        .map((el) => getComputedStyle(el).borderInlineStartWidth)
        .filter((w) => {
          const px = Number.parseFloat(w);
          return px > 1 && px < 6;
        }),
    );

    // Non-vacuous: each of these pages renders at least one State Rule, so an
    // empty result means the sweep stopped seeing them, not that all is well.
    expect(widths.length, `leading rules found on ${path}`).toBeGreaterThan(0);
    for (const width of widths) expect(width).toBe('3px');
  });
}
