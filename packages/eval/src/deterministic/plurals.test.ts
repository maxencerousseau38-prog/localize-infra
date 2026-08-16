import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  expectedPluralCategories,
  pluralCategoriesCorrect,
} from './plurals.js';

describe('expectedPluralCategories', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * The Arabic case below asserts CLDR order, and on this machine it passed
   * whatever the implementation did — Node returns that order here anyway.
   * On Linux it returns the same six sorted alphabetically, so the assertion
   * was really testing the platform.
   *
   * This drives the normalisation directly: hand the function a deliberately
   * shuffled ICU response and require canonical order out. It fails on the
   * implementation that returned `pluralCategories` untouched, on every
   * platform, which is what the Arabic test could not do.
   */
  it('imposes CLDR order on whatever order ICU reports', () => {
    vi.spyOn(Intl, 'PluralRules').mockImplementation(
      () =>
        ({
          resolvedOptions: () => ({
            pluralCategories: ['many', 'other', 'few', 'zero', 'two', 'one'],
          }),
        }) as unknown as Intl.PluralRules,
    );

    expect(expectedPluralCategories('ar')).toEqual([
      'zero',
      'one',
      'two',
      'few',
      'many',
      'other',
    ]);
  });

  it('keeps a category ICU reports that CLDR does not name', () => {
    vi.spyOn(Intl, 'PluralRules').mockImplementation(
      () =>
        ({
          resolvedOptions: () => ({
            pluralCategories: ['other', 'several', 'one'],
          }),
        }) as unknown as Intl.PluralRules,
    );

    // Appended, never dropped: a future CLDR category must not disappear
    // because this file has not heard of it yet.
    expect(expectedPluralCategories('xx')).toEqual(['one', 'other', 'several']);
  });

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
