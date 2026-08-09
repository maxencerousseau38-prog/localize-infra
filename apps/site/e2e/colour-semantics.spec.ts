import { expect, test } from '@playwright/test';

/**
 * Iris means one thing (DESIGN.md §1.4, §6.1): your judgement is required.
 *
 * It is not a brand accent, not chrome, and explicitly not roadmap or maturity
 * state (§6.3). That rule was already enforced once, on the landing page's
 * status board — and by the time this test was written the same leak had
 * reappeared on five pages, spending the ambiguity colour on "Not yet
 * measured", "Not measured", "Pre-alpha", "In development" and every roadmap
 * item under construction.
 *
 * The marketing site never asks the reader to resolve an ambiguity, so nothing
 * on it should be painted with the ambiguity colour. That makes the rule
 * checkable as an absolute here, which is the only reason it holds.
 */

const PAGES = [
  '/',
  '/docs',
  '/benchmarks',
  '/quality',
  '/security',
  '/pricing',
  '/roadmap',
];

for (const path of PAGES) {
  test(`${path} spends no Iris on chrome or maturity state`, async ({
    page,
  }) => {
    await page.goto(path);

    const ambiguous = await page.evaluate(() => {
      /*
       * All three ambiguity tokens, not just the base one. The first version of
       * this test checked `--state-ambiguous` alone and passed a mutation that
       * restored an Iris badge — because `Badge` paints with the `-bg` and
       * `-text` variants and never touches the base token. A guard that cannot
       * fail is worse than no guard, so the mutation check is what defines this
       * list.
       */
      const names = [
        '--state-ambiguous',
        '--state-ambiguous-bg',
        '--state-ambiguous-text',
      ];
      const root = getComputedStyle(document.documentElement);
      const probe = document.createElement('span');
      document.body.append(probe);

      const targets = new Set(
        names.map((name) => {
          const value = root.getPropertyValue(name).trim();
          if (!value) throw new Error(`${name} is not defined`);
          // Resolve to the rgb() the browser actually paints, so the comparison
          // survives the token being written in any colour syntax.
          probe.style.color = value;
          return getComputedStyle(probe).color;
        }),
      );
      probe.remove();

      return [...document.querySelectorAll('*')]
        .filter((el) => {
          const s = getComputedStyle(el);
          return [
            s.color,
            s.backgroundColor,
            s.borderInlineStartColor,
            s.borderTopColor,
            s.borderBottomColor,
            s.borderInlineEndColor,
            s.outlineColor,
          ].some((painted) => targets.has(painted));
        })
        .map((el) => `${el.tagName}.${String(el.className).slice(0, 60)}`);
    });

    expect(
      ambiguous,
      `Iris is reserved for "a human must decide"; these elements use it on a page that asks nothing of the reader`,
    ).toEqual([]);
  });
}
