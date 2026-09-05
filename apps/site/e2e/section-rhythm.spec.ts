import { expect, test } from '@playwright/test';

/**
 * DESIGN.md §4.4, the half of it that was made testable and never tested.
 *
 * The document first said "sections must not share one shape", found that too
 * vague to enforce, and replaced it with a rule that names what it measures:
 *
 *   No two adjacent sections may share the same structural signature. A
 *   signature is the tuple (column split, whether the section is full-bleed,
 *   whether its payload is prose or evidence).
 *
 * It then records that the rule had already been broken once and not noticed —
 * Commitments and Build status were both `(4/8 split, contained, prose)`,
 * "different content, identical structure, and the page read as one long list
 * through both". That was fixed by hand, and nothing stopped it recurring.
 *
 * §16 divides the document into what tests enforce and what "requires review
 * discipline". This moves §4.4 across that line.
 *
 * **What a signature is measured from, and why each part is honest:**
 *
 * - *column split* — the computed `grid-template-columns` of the widest grid
 *   the section owns, reduced to a track count. Read from layout rather than
 *   from class names, so a rewrite that lands on the same shape by a different
 *   route still counts as the same shape.
 * - *full-bleed* — whether the section paints its own background across the
 *   viewport instead of sitting on the page ground.
 * - *payload* — whether the section contains monospace content. On this page
 *   that is exactly what §4.4 means by evidence: a diff, a table, a file, real
 *   output. Prose sections carry none.
 *
 * The check is deliberately blind to content. Two sections may say entirely
 * different things and still read as one long list, which is the failure it
 * exists to catch.
 */

interface Signature {
  index: number;
  heading: string;
  columns: number;
  fullBleed: boolean;
  evidence: boolean;
}

test('no two adjacent landing sections share a structural signature', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const signatures: Signature[] = await page.evaluate(() => {
    const pageBackground = getComputedStyle(document.body).backgroundColor;

    // Top-level sections only. A nested section describes a part of its
    // parent's shape, not a shape of its own.
    const sections = [...document.querySelectorAll('main > section')];

    return sections.map((section, index) => {
      const heading =
        section.querySelector('h1, h2')?.textContent?.trim().slice(0, 48) ??
        `(section ${index + 1})`;

      // The widest grid the section owns carries its column split. A section
      // with no grid is one column.
      let columns = 1;
      for (const el of section.querySelectorAll('*')) {
        const cs = getComputedStyle(el);
        if (!cs.display.includes('grid')) continue;
        const tracks = cs.gridTemplateColumns.split(' ').filter(Boolean).length;
        if (el.getBoundingClientRect().width > 0 && tracks > columns) {
          columns = tracks;
        }
      }

      const own = getComputedStyle(section).backgroundColor;
      const transparent = own === 'rgba(0, 0, 0, 0)' || own === 'transparent';

      const evidence = [...section.querySelectorAll('*')].some((el) =>
        getComputedStyle(el).fontFamily.toLowerCase().includes('mono'),
      );

      return {
        index,
        heading,
        columns,
        fullBleed: !transparent && own !== pageBackground,
        evidence,
      };
    });
  });

  // A page that grew a section the selector cannot see would pass every
  // comparison below by having nothing to compare.
  expect(
    signatures.length,
    'the landing page should expose its sections as `main > section`',
  ).toBeGreaterThanOrEqual(5);

  const key = (s: Signature) =>
    `${s.columns}col/${s.fullBleed ? 'bleed' : 'contained'}/${s.evidence ? 'evidence' : 'prose'}`;

  const clashes: string[] = [];
  for (let i = 1; i < signatures.length; i++) {
    const previous = signatures[i - 1] as Signature;
    const current = signatures[i] as Signature;
    if (key(previous) === key(current)) {
      clashes.push(
        `"${previous.heading}" and "${current.heading}" are both ${key(current)}`,
      );
    }
  }

  expect(
    clashes,
    'DESIGN.md §4.4: adjacent sections must differ in column split, full-bleed, or payload',
  ).toEqual([]);
});

/**
 * The other two absolutes in §4.4, which are about the opening rather than the
 * alternation: "At least one section in the first three must be full-bleed and
 * inverted, and at least one must carry evidence rather than prose. A page of
 * seven prose sections is a brochure."
 *
 * Asserted separately because they fail for a different reason than the rule
 * above — a page can alternate perfectly and still open with three paragraphs.
 */
test('the first three sections include an inverted band carrying evidence', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const opening = await page.evaluate(() => {
    const luminance = (colour: string) => {
      const [r, g, b] = (colour.match(/\d+(\.\d+)?/g) ?? ['255', '255', '255'])
        .slice(0, 3)
        .map(Number) as [number, number, number];
      return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    };

    return [...document.querySelectorAll('main > section')]
      .slice(0, 3)
      .map((section) => ({
        inverted: luminance(getComputedStyle(section).backgroundColor) < 0.5,
        evidence: [...section.querySelectorAll('*')].some((el) =>
          getComputedStyle(el).fontFamily.toLowerCase().includes('mono'),
        ),
      }));
  });

  expect(
    opening.some((s) => s.inverted),
    'one of the first three sections must be a full-bleed inverted band',
  ).toBe(true);

  expect(
    opening.some((s) => s.evidence),
    'one of the first three sections must carry evidence, not prose',
  ).toBe(true);
});
