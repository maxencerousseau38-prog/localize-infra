import type { ProposedTranslation } from '@/lib/data/workspace';
import { describe, expect, it } from 'vitest';
import {
  PROPOSALS_PAGE_SIZE,
  type ProposalQuery,
  proposalLocales,
  proposalOrigins,
  selectProposals,
} from './proposals';

function row(
  key: string,
  locale: string,
  origin: ProposedTranslation['origin'] = 'model',
  source = 'Save',
  proposed = 'Enregistrer',
): ProposedTranslation {
  return {
    translation_key: key,
    locale,
    origin,
    source_text: source,
    proposed_text: proposed,
  };
}

const DEFAULTS: ProposalQuery = {
  query: '',
  locale: 'all',
  origin: 'all',
  sort: 'key',
  desc: false,
  page: 1,
};

const q = (over: Partial<ProposalQuery> = {}): ProposalQuery => ({
  ...DEFAULTS,
  ...over,
});

describe('selectProposals', () => {
  /*
   * Distinct source and proposed text per key.
   *
   * The first version let every row default to source "Save", so a search for
   * "save" matched three rows rather than two — and the test asserting two was
   * the thing that was wrong. A fixture where every row shares a field cannot
   * tell a search that reads one column from a search that reads three.
   */
  const rows = [
    row('app.save', 'fr', 'model', 'Save', 'Enregistrer'),
    row('app.save', 'de', 'model', 'Save', 'Speichern'),
    row('app.cancel', 'fr', 'preserved', 'Cancel', 'Annuler'),
    row('app.close', 'de', 'resolved', 'Close', 'Schließen'),
  ];

  it('returns everything when nothing is asked of it', () => {
    const page = selectProposals(rows, q());
    expect(page.rows).toHaveLength(4);
    expect(page.total).toBe(4);
    expect(page.matched).toBe(4);
  });

  it('filters by locale', () => {
    const page = selectProposals(rows, q({ locale: 'de' }));
    expect(page.rows.map((r) => r.locale)).toEqual(['de', 'de']);
    expect(page.matched).toBe(2);
    // The denominator stays the unfiltered count: the toolbar says "2 of 4".
    expect(page.total).toBe(4);
  });

  it('filters by origin', () => {
    expect(selectProposals(rows, q({ origin: 'resolved' })).rows).toHaveLength(
      1,
    );
  });

  it('combines the two filters rather than letting the last one win', () => {
    expect(
      selectProposals(rows, q({ locale: 'de', origin: 'resolved' })).rows,
    ).toHaveLength(1);
    expect(
      selectProposals(rows, q({ locale: 'fr', origin: 'resolved' })).rows,
    ).toHaveLength(0);
  });

  /*
   * One box over three fields, because a reader looking for a string does not
   * know whether they remember its key, its English, or the translation they
   * saw in a diff.
   */
  it.each([
    ['a key fragment', 'cancel', 1],
    ['source text', 'close', 1],
    ['proposed text', 'schließen', 1],
  ])('searches %s', (_label, needle, expected) => {
    expect(selectProposals(rows, q({ query: needle })).rows).toHaveLength(
      expected,
    );
  });

  it('searches case-insensitively and ignores surrounding space', () => {
    expect(selectProposals(rows, q({ query: '  SAVE  ' })).rows).toHaveLength(
      2,
    );
  });

  it('sorts by key, and reverses', () => {
    const asc = selectProposals(rows, q({ sort: 'key' }));
    expect(asc.rows[0]?.translation_key).toBe('app.cancel');
    const desc = selectProposals(rows, q({ sort: 'key', desc: true }));
    expect(desc.rows[0]?.translation_key).toBe('app.save');
  });

  /*
   * The guard against a table that reorders itself between two loads.
   *
   * Sorting by locale leaves every row of that locale equal, and
   * `Array.prototype.sort` is only stable within one engine's implementation of
   * one call. Two readers opening the same URL must see the same order, so the
   * comparator resolves ties itself.
   */
  it('breaks ties deterministically instead of relying on sort stability', () => {
    const many = [row('z.one', 'de'), row('a.two', 'de'), row('m.three', 'de')];
    const first = selectProposals(many, q({ sort: 'locale' }));
    const again = selectProposals([...many].reverse(), q({ sort: 'locale' }));
    expect(first.rows.map((r) => r.translation_key)).toEqual(
      again.rows.map((r) => r.translation_key),
    );
    expect(first.rows.map((r) => r.translation_key)).toEqual([
      'a.two',
      'm.three',
      'z.one',
    ]);
  });

  describe('paging', () => {
    const many = Array.from({ length: PROPOSALS_PAGE_SIZE * 2 + 3 }, (_, i) =>
      row(`key.${String(i).padStart(3, '0')}`, 'fr'),
    );

    it('cuts the result into pages of a fixed size', () => {
      expect(selectProposals(many, q()).rows).toHaveLength(PROPOSALS_PAGE_SIZE);
      expect(selectProposals(many, q()).pageCount).toBe(3);
    });

    it('returns the remainder on the last page', () => {
      expect(selectProposals(many, q({ page: 3 })).rows).toHaveLength(3);
    });

    /*
     * `page` comes from the URL, where anybody can type it. A page past the end
     * would render headers and no rows, which is indistinguishable from "this
     * run proposed nothing" and is not the same fact.
     */
    it('clamps a page past the end rather than rendering an empty table', () => {
      const page = selectProposals(many, q({ page: 99 }));
      expect(page.page).toBe(3);
      expect(page.rows).toHaveLength(3);
    });

    it('clamps a page below one', () => {
      expect(selectProposals(many, q({ page: 0 })).page).toBe(1);
    });

    it('reports one page, not zero, when nothing matches', () => {
      const page = selectProposals(many, q({ query: 'nothing matches this' }));
      expect(page.matched).toBe(0);
      expect(page.pageCount).toBe(1);
      expect(page.rows).toEqual([]);
    });
  });

  it('handles a run with no proposals at all', () => {
    const page = selectProposals([], q());
    expect(page).toMatchObject({ total: 0, matched: 0, pageCount: 1, page: 1 });
  });
});

describe('the filter options offered', () => {
  const rows = [row('a', 'pt-BR'), row('b', 'de', 'resolved'), row('c', 'de')];

  it('lists each locale once, sorted', () => {
    expect(proposalLocales(rows)).toEqual(['de', 'pt-BR']);
  });

  /*
   * Pipeline order, not alphabetical: `model`, `preserved`, `resolved` is the
   * order a string moves through, so the filter reads as a sequence.
   */
  it('lists origins in pipeline order', () => {
    expect(proposalOrigins(rows)).toEqual(['model', 'resolved']);
  });

  /*
   * A filter for a value that cannot match is a control that can only
   * disappoint. `preserved` is absent above and must not be offered.
   */
  it('offers only origins that are present', () => {
    expect(proposalOrigins(rows)).not.toContain('preserved');
    expect(proposalOrigins([])).toEqual([]);
  });
});
