/**
 * Subsequence fuzzy match with matched-character positions.
 *
 * Returns `null` when the query is not a subsequence of the text. `indices` are
 * positions in the original text so the caller can emphasise exactly the
 * characters that matched — without that, a fuzzy palette looks like it matched
 * arbitrarily, which reads as broken.
 */
export interface FuzzyMatch {
  score: number;
  indices: number[];
}

const WORD_BOUNDARY = /[\s\-_/.:]/;

export function fuzzyMatch(text: string, query: string): FuzzyMatch | null {
  if (query === '') return { score: 0, indices: [] };

  const haystack = text.toLowerCase();
  const needle = query.toLowerCase();
  const indices: number[] = [];

  let score = 0;
  let cursor = 0;

  for (const char of needle) {
    const found = haystack.indexOf(char, cursor);
    if (found === -1) return null;

    // Contiguous runs and word-initial characters are what a human means by
    // "this matched"; scattered letters are technically a match but a bad one.
    const previous = indices[indices.length - 1];
    if (previous === found - 1) score += 8;
    if (found === 0 || WORD_BOUNDARY.test(haystack[found - 1] ?? ''))
      score += 6;
    if (text[found] === query[indices.length]) score += 1;

    indices.push(found);
    cursor = found + 1;
  }

  // Shorter targets win ties: "Settings" should outrank "Project settings sync"
  // for the query "set".
  score -= Math.min(text.length, 40) / 10;
  return { score, indices };
}

/** Splits `text` into runs, marking which are matched, for emphasis. */
export function highlightRuns(
  text: string,
  indices: number[],
): Array<{ text: string; matched: boolean }> {
  if (indices.length === 0) return [{ text, matched: false }];

  const marked = new Set(indices);
  const runs: Array<{ text: string; matched: boolean }> = [];

  for (let i = 0; i < text.length; i++) {
    const char = text[i] as string;
    const matched = marked.has(i);
    const last = runs[runs.length - 1];
    if (last && last.matched === matched) last.text += char;
    else runs.push({ text: char, matched });
  }

  return runs;
}
