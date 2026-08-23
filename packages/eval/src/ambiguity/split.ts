import type { AmbiguityCase } from '@localize-infra/schemas';

/**
 * Split so the two halves of a pair are never in the same request.
 *
 * This is the difference between a measurement and a confound. The halves
 * differ only in their surrounding code; put them side by side in one prompt
 * and the model can see the pairing itself, which is information no production
 * request would ever carry. Sending all the ambiguous halves together would be
 * just as wrong in the other direction — a batch where every string is
 * ambiguous is its own kind of hint.
 *
 * So each group takes exactly one half of every pair, alternating which,
 * leaving both groups mixed roughly half-and-half between strings that should
 * escalate and strings that should not. Deterministic, so a rerun compares
 * against the same arrangement.
 */
export function splitIntoUnpairedGroups(
  cases: AmbiguityCase[],
): [AmbiguityCase[], AmbiguityCase[]] {
  const pairIds = [...new Set(cases.map((c) => c.pairId))];
  const groupA: AmbiguityCase[] = [];
  const groupB: AmbiguityCase[] = [];

  pairIds.forEach((pairId, index) => {
    const open = cases.find(
      (c) => c.pairId === pairId && c.expected === 'escalate',
    );
    const settled = cases.find(
      (c) => c.pairId === pairId && c.expected === 'confident',
    );
    if (!open || !settled) return;
    // Alternate which half goes where, so neither group is all-ambiguous.
    if (index % 2 === 0) {
      groupA.push(open);
      groupB.push(settled);
    } else {
      groupA.push(settled);
      groupB.push(open);
    }
  });

  return [groupA, groupB];
}
