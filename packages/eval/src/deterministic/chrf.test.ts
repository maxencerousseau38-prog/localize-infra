import { describe, expect, it } from 'vitest';
import { chrf, exactMatch } from './chrf.js';

/**
 * Properties, not golden numbers.
 *
 * A hand-computed chrF value would be testing my arithmetic against itself. The
 * properties below are what the metric has to satisfy for the comparison it is
 * used for to mean anything.
 */
describe('chrf', () => {
  it('scores an identical string as a perfect match', () => {
    expect(chrf('Speichern', 'Speichern').score).toBe(100);
    expect(chrf('保存する', '保存する').score).toBe(100);
  });

  it('scores strings with nothing in common at zero', () => {
    expect(chrf('aaaaaa', 'bbbbbb').score).toBe(0);
  });

  it('is bounded to 0–100', () => {
    const pairs = [
      ['Save', 'Speichern'],
      ['Cancel', 'Abbrechen'],
      ['', 'Speichern'],
      ['Speichern', ''],
      ['حفظ', 'حفظ التغييرات'],
    ];
    for (const [hyp, ref] of pairs) {
      const { score } = chrf(hyp ?? '', ref ?? '');
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  it('ranks a near translation above an unrelated one', () => {
    // The only property the comparison actually relies on: given one reference,
    // a closer candidate must score higher than a further one.
    const near = chrf('Änderungen speichern', 'Änderungen sichern').score;
    const far = chrf('Datei löschen', 'Änderungen sichern').score;
    expect(near).toBeGreaterThan(far);
  });

  it('ignores whitespace, so unspaced scripts are comparable', () => {
    // Japanese does not space between words. Without normalisation the metric
    // would mostly measure spacing convention and make locales incomparable.
    expect(chrf('保存 する', '保存する').score).toBe(100);
  });

  it('does not split astral characters into halves', () => {
    // Spreading rather than indexing: a surrogate pair cut in two would count
    // n-grams that are not characters at all.
    expect(chrf('🎉🎉', '🎉🎉').score).toBe(100);
    expect(chrf('🎉', '🎊').score).toBe(0);
  });

  it('treats two empty strings as identical and one empty as no overlap', () => {
    expect(chrf('', '').score).toBe(100);
    expect(chrf('', 'x').score).toBe(0);
    expect(chrf('x', '').score).toBe(0);
  });

  it('weights recall above precision, as chrF2 specifies', () => {
    // β=2. A hypothesis missing half the reference should be penalised harder
    // than one carrying the whole reference plus extra.
    const missingHalf = chrf('Änderungen', 'Änderungen speichern').score;
    const withExtra = chrf(
      'Änderungen speichern jetzt',
      'Änderungen speichern',
    ).score;
    expect(withExtra).toBeGreaterThan(missingHalf);
  });
});

describe('exactMatch', () => {
  it('ignores surrounding whitespace only', () => {
    expect(exactMatch('  Speichern ', 'Speichern')).toBe(true);
    expect(exactMatch('speichern', 'Speichern')).toBe(false);
  });
});
