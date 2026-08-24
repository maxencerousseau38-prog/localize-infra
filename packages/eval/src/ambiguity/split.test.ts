import { describe, expect, it } from 'vitest';
import { buildAmbiguityCases } from './cases.js';
import { splitIntoUnpairedGroups } from './split.js';

const cases = buildAmbiguityCases();
const [groupA, groupB] = splitIntoUnpairedGroups(cases);

describe('splitIntoUnpairedGroups', () => {
  /*
   * The guarantee the whole measurement rests on.
   *
   * The halves of a pair differ only in their surrounding code. Send them in
   * one request and the model can see the pairing — information no production
   * request carries — and any difference in its answers stops being
   * attributable to the context.
   */
  it('never puts both halves of a pair in the same group', () => {
    for (const group of [groupA, groupB]) {
      const pairIds = group.map((c) => c.pairId);
      expect(new Set(pairIds).size).toBe(pairIds.length);
    }
  });

  it('places every case exactly once across the two groups', () => {
    const ids = [...groupA, ...groupB].map((c) => c.id);
    expect(ids).toHaveLength(cases.length);
    expect(new Set(ids).size).toBe(cases.length);
  });

  /*
   * A group where every string is ambiguous is its own hint. Alternating which
   * half goes where keeps both groups mixed, so neither batch tells the model
   * what kind of batch it is.
   */
  it('leaves both groups mixed rather than all-ambiguous', () => {
    for (const group of [groupA, groupB]) {
      const escalate = group.filter((c) => c.expected === 'escalate').length;
      const half = group.length / 2;
      expect(escalate).toBe(half);
      expect(group.length - escalate).toBe(half);
    }
  });

  it('is deterministic, so a rerun compares against the same arrangement', () => {
    const [again] = splitIntoUnpairedGroups(cases);
    expect(again.map((c) => c.id)).toEqual(groupA.map((c) => c.id));
  });
});
