import { describe, expect, it } from 'vitest';
import {
  localeDir,
  localeDisplayName,
  localeFontClass,
  localeTextProps,
} from '../lib/locale';

describe('localeDir', () => {
  it('marks Arabic and Hebrew right-to-left', () => {
    expect(localeDir('ar')).toBe('rtl');
    expect(localeDir('he')).toBe('rtl');
    expect(localeDir('fa-IR')).toBe('rtl');
  });

  it('marks Latin and CJK locales left-to-right', () => {
    expect(localeDir('en')).toBe('ltr');
    expect(localeDir('pt-BR')).toBe('ltr');
    expect(localeDir('ja')).toBe('ltr');
  });

  it('reads the language subtag, not the region', () => {
    // `ar-EG` is RTL; `en-AE` is not, despite the Arabic-speaking region.
    expect(localeDir('ar-EG')).toBe('rtl');
    expect(localeDir('en-AE')).toBe('ltr');
  });

  it('accepts underscore-separated tags and mixed case', () => {
    expect(localeDir('AR_EG')).toBe('rtl');
    expect(localeDir('PT_br')).toBe('ltr');
  });
});

describe('localeFontClass', () => {
  it('selects the Japanese stack for Japanese', () => {
    expect(localeFontClass('ja')).toBe('font-jp');
    expect(localeFontClass('ja-JP')).toBe('font-jp');
  });

  it('selects the Arabic stack for Arabic-script languages', () => {
    expect(localeFontClass('ar')).toBe('font-ar');
    expect(localeFontClass('fa')).toBe('font-ar');
    expect(localeFontClass('ur')).toBe('font-ar');
  });

  it('falls through to the interface font for Latin locales', () => {
    expect(localeFontClass('en')).toBe('');
    expect(localeFontClass('de')).toBe('');
  });
});

describe('localeDisplayName', () => {
  it('resolves a code to a human-readable name', () => {
    expect(localeDisplayName('de')).toBe('German');
  });

  it('keeps the region distinction that makes the code ambiguous', () => {
    expect(localeDisplayName('pt-BR')).toContain('Portuguese');
    expect(localeDisplayName('pt-BR')).not.toBe(localeDisplayName('pt'));
  });

  it('falls back to the code itself rather than inventing a name', () => {
    // An unresolvable tag must never be rendered as a guess.
    expect(localeDisplayName('zz-Nope-Nope')).toBe('zz-Nope-Nope');
  });
});

describe('localeTextProps', () => {
  it('always emits both lang and dir', () => {
    expect(localeTextProps('ar-EG')).toEqual({ lang: 'ar-EG', dir: 'rtl' });
    expect(localeTextProps('en')).toEqual({ lang: 'en', dir: 'ltr' });
  });
});
