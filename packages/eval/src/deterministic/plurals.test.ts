import { describe, expect, it } from 'vitest';
import {
  expectedPluralCategories,
  pluralCategoriesCorrect,
} from './plurals.js';

describe('expectedPluralCategories', () => {
  it('returns 2 categories for German', () => {
    expect(expectedPluralCategories('de')).toEqual(['one', 'other']);
  });

  it('returns 1 category for Japanese', () => {
    expect(expectedPluralCategories('ja')).toEqual(['other']);
  });

  it('returns 6 categories for Arabic', () => {
    expect(expectedPluralCategories('ar')).toEqual([
      'zero',
      'one',
      'two',
      'few',
      'many',
      'other',
    ]);
  });
});

describe('pluralCategoriesCorrect', () => {
  it('accepts a German plural message using exactly one and other', () => {
    expect(
      pluralCategoriesCorrect(
        '{count, plural, one {# Element} other {# Elemente}}',
        'de',
      ),
    ).toBe(true);
  });

  it('rejects a message missing the mandatory other category', () => {
    expect(
      pluralCategoriesCorrect('{count, plural, one {# Element}}', 'de'),
    ).toBe(false);
  });

  it('rejects a message using a category not valid for the locale', () => {
    expect(
      pluralCategoriesCorrect(
        '{count, plural, one {# Element} few {# Elemente} other {# Elemente}}',
        'de',
      ),
    ).toBe(false);
  });

  it('accepts a full 6-category Arabic plural message', () => {
    const msg =
      '{count, plural, zero {# عنصر} one {# عنصر} two {# عنصران} few {# عناصر} many {# عنصرًا} other {# عنصر}}';
    expect(pluralCategoriesCorrect(msg, 'ar')).toBe(true);
  });

  it('accepts explicit-value arms like =0 alongside named categories', () => {
    expect(
      pluralCategoriesCorrect(
        '{count, plural, =0 {none} one {# item} other {# items}}',
        'en',
      ),
    ).toBe(true);
  });
});
