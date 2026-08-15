import { PIPELINE_STAGES } from '@localize-infra/ui';
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

/**
 * Jade means something happened (DESIGN.md §6.1): verified, current, merged,
 * passing. Unlike Iris it cannot be checked as an absolute here, because the
 * site paints it in six honest places — the run artifact, "Working today",
 * the WORKING rows on the status board, measured results on /benchmarks and
 * /quality, Shipped on /roadmap, and the free-public-repositories rule on
 * /pricing. Every one of those reports a real outcome.
 *
 * So the rule has to be pinned where it was actually broken. The landing page
 * draws the five pipeline stages twice: once in the hero as a run that really
 * executed, and once in "How it works" as a diagram of what the stages are.
 * The diagram had a jade node on Detect and neutral nodes on the other four —
 * no run, but a colour saying stage one passed, sitting a screen below an
 * artifact that had just taught the reader jade means "this stage finished".
 * It read as a pipeline that stops after Detect.
 *
 * The Iris sweep above could never have caught it, and nothing else did.
 *
 * Both halves below are load-bearing. The first forbids state on the diagram;
 * the second requires it on the real run, so the first can never be satisfied
 * by draining the colour out of the surface that has genuinely earned it.
 * All four families are checked, not just jade — the same mistake reads
 * identically in amber or crimson.
 */
const STATE_FAMILIES: Record<string, string[]> = {
  confident: [
    '--state-confident',
    '--state-confident-bg',
    '--state-confident-text',
  ],
  degraded: [
    '--state-degraded',
    '--state-degraded-bg',
    '--state-degraded-text',
  ],
  failed: ['--state-failed', '--state-failed-bg', '--state-failed-text'],
  ambiguous: [
    '--state-ambiguous',
    '--state-ambiguous-bg',
    '--state-ambiguous-text',
  ],
};

/** Every state colour painted anywhere inside `selector`, by family. */
async function statePaintedWithin(
  page: import('@playwright/test').Page,
  selector: string,
) {
  return page.evaluate(
    ({ sel, families }) => {
      const root = getComputedStyle(document.documentElement);
      const probe = document.createElement('span');
      document.body.append(probe);

      // Resolve every token to the rgb() the browser actually paints, so the
      // comparison survives a token being rewritten in any colour syntax.
      const byColour = new Map<string, string>();
      for (const [family, names] of Object.entries(families)) {
        for (const name of names) {
          const value = root.getPropertyValue(name).trim();
          if (!value) throw new Error(`${name} is not defined`);
          probe.style.color = value;
          byColour.set(getComputedStyle(probe).color, family);
        }
      }
      probe.remove();

      const scope = document.querySelector(sel);
      if (!scope) throw new Error(`nothing matches ${sel}`);

      const found: string[] = [];
      for (const el of [scope, ...scope.querySelectorAll('*')]) {
        const s = getComputedStyle(el);
        for (const painted of [
          s.color,
          s.backgroundColor,
          s.borderInlineStartColor,
          s.borderTopColor,
          s.borderBottomColor,
          s.borderInlineEndColor,
          s.outlineColor,
        ]) {
          const family = byColour.get(painted);
          if (family) {
            found.push(`${family} on ${el.tagName}`);
            break;
          }
        }
      }
      return found;
    },
    { sel: selector, families: STATE_FAMILIES },
  );
}

const DIAGRAM = 'ol[aria-label="The five pipeline stages"]';
const REAL_RUN = '[aria-label="Run progress"]';

test('the pipeline diagram claims no state, because nothing has run', async ({
  page,
}) => {
  await page.goto('/');

  // Non-vacuous: if the rail ever stops rendering its stages, this test must
  // fail loudly rather than pass by finding nothing to inspect.
  await expect(page.locator(`${DIAGRAM} > li`)).toHaveCount(
    PIPELINE_STAGES.length,
  );

  expect(
    await statePaintedWithin(page, DIAGRAM),
    'the "How it works" rail explains what the stages are; painting one of them with a state colour asserts a run that never happened',
  ).toEqual([]);
});

test('the run artifact does claim state, because it really ran', async ({
  page,
}) => {
  await page.goto('/');

  const painted = await statePaintedWithin(page, REAL_RUN);

  expect(
    painted.filter((entry) => entry.startsWith('confident')).length,
    'the hero rail depicts a run that completed all five stages; if it stops marking them, the test above has been satisfied by removing the colour rather than by fixing the diagram',
  ).toBeGreaterThan(0);
});
