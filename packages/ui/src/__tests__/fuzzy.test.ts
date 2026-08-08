import { describe, expect, it } from 'vitest';
import { fuzzyMatch, highlightRuns } from '../lib/fuzzy';

describe('fuzzyMatch', () => {
  it('returns an empty match for an empty query so the palette shows everything', () => {
    expect(fuzzyMatch('Settings', '')).toEqual({ score: 0, indices: [] });
  });

  it('rejects text that does not contain the query as a subsequence', () => {
    expect(fuzzyMatch('Settings', 'xyz')).toBeNull();
    // Order matters: the letters are all present but out of sequence.
    expect(fuzzyMatch('Settings', 'gnittes')).toBeNull();
  });

  it('matches case-insensitively and reports positions in the original text', () => {
    expect(fuzzyMatch('Settings', 'set')?.indices).toEqual([0, 1, 2]);
    expect(fuzzyMatch('Settings', 'SET')?.indices).toEqual([0, 1, 2]);
  });

  it('reports scattered subsequence positions', () => {
    // s-t-g in "Settings": index 0, 2, 6
    expect(fuzzyMatch('Settings', 'stg')?.indices).toEqual([0, 2, 6]);
  });

  it('ranks a contiguous prefix above a scattered match', () => {
    const contiguous = fuzzyMatch('Settings', 'set');
    const scattered = fuzzyMatch('Ambiguities', 'set');
    expect(contiguous).not.toBeNull();
    expect(scattered).toBeNull();

    const prefix = fuzzyMatch('Locales', 'loc');
    const scatteredHit = fuzzyMatch('Log out console', 'loc');
    expect(prefix?.score).toBeGreaterThan(scatteredHit?.score ?? 0);
  });

  it('ranks a word-initial match above a mid-word one', () => {
    const wordInitial = fuzzyMatch('Open pull request', 'pr');
    const midWord = fuzzyMatch('Approve', 'pr');
    expect(wordInitial?.score).toBeGreaterThan(midWord?.score ?? 0);
  });

  it('breaks ties toward the shorter target', () => {
    const short = fuzzyMatch('Settings', 'set');
    const long = fuzzyMatch('Settings and preferences page', 'set');
    expect(short?.score).toBeGreaterThan(long?.score ?? 0);
  });
});

describe('highlightRuns', () => {
  it('returns the whole string as one unmatched run when nothing matched', () => {
    expect(highlightRuns('Settings', [])).toEqual([
      { text: 'Settings', matched: false },
    ]);
  });

  it('merges adjacent characters into a single run', () => {
    expect(highlightRuns('Settings', [0, 1, 2])).toEqual([
      { text: 'Set', matched: true },
      { text: 'tings', matched: false },
    ]);
  });

  it('splits non-adjacent matches into separate runs', () => {
    expect(highlightRuns('Settings', [0, 2])).toEqual([
      { text: 'S', matched: true },
      { text: 'e', matched: false },
      { text: 't', matched: true },
      { text: 'tings', matched: false },
    ]);
  });

  it('reassembles to the original string, so no character is dropped or duplicated', () => {
    const text = 'Open pull request';
    const match = fuzzyMatch(text, 'opr');
    expect(match).not.toBeNull();
    const runs = highlightRuns(text, match?.indices ?? []);
    expect(runs.map((r) => r.text).join('')).toBe(text);
  });
});
