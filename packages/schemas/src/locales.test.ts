import { describe, expect, it } from 'vitest';
import { InvalidLocales, parseTargetLocales } from './locales.js';

const from = (sourceLocale: string) => ({ sourceLocale });

describe('parseTargetLocales', () => {
  it('reads an empty value as "translates into nothing yet"', () => {
    for (const empty of [null, undefined, '', '   ', ',,', ' , , ']) {
      expect(parseTargetLocales(empty, from('en'))).toEqual([]);
    }
  });

  /*
   * "fr, de" and "fr de" and a pasted column are all things people type into a
   * text field. Accepting one and rejecting the others would be a rule with no
   * reason behind it.
   */
  it.each([
    ['fr,de', ['fr', 'de']],
    ['fr, de', ['fr', 'de']],
    ['fr de', ['fr', 'de']],
    ['  fr ,  de  ', ['fr', 'de']],
    ['fr\nde\nja', ['fr', 'de', 'ja']],
  ])('parses %j', (input, expected) => {
    expect(parseTargetLocales(input, from('en'))).toEqual(expected);
  });

  it('keeps the order the person wrote', () => {
    expect(parseTargetLocales('ja,fr,de', from('en'))).toEqual([
      'ja',
      'fr',
      'de',
    ]);
  });

  /*
   * A locale is also a filename. `pt-BR` and `PT-br` are one locale to a human
   * and two files on a case-sensitive filesystem, which is how a project ends
   * up with two catalogues for one language.
   */
  it.each([
    ['PT-br', 'pt-BR'],
    ['pt-br', 'pt-BR'],
    ['FR', 'fr'],
    ['zh-hans-cn', 'zh-Hans-CN'],
  ])('canonicalises %j to %j', (input, expected) => {
    expect(parseTargetLocales(input, from('en'))).toEqual([expected]);
  });

  it('collapses duplicates that differ only in case', () => {
    expect(parseTargetLocales('fr, FR, Fr', from('en'))).toEqual(['fr']);
  });

  describe('refuses, with a sentence', () => {
    it.each(['english', 'fr_CA', 'f', '123', 'fr-', '-fr', 'fr--CA'])(
      'refuses %j as a language tag',
      (input) => {
        expect(() => parseTargetLocales(input, from('en'))).toThrow(
          InvalidLocales,
        );
        expect(() => parseTargetLocales(input, from('en'))).toThrow(
          /not a language tag/,
        );
      },
    );

    /*
     * A run treats every target as a file to write. Keeping the source would
     * translate English into English and overwrite the catalogue the same run
     * had just extracted.
     */
    it('refuses the source language, however it is cased', () => {
      expect(() => parseTargetLocales('fr,EN', from('en'))).toThrow(
        /source language/,
      );
      expect(() => parseTargetLocales('pt-br', from('PT-BR'))).toThrow(
        /source language/,
      );
    });

    /*
     * One model call per locale, inside the request that started the run, with
     * no worker to resume it. An unbounded list is a promise this product
     * cannot keep, and it would fail as a timeout rather than as a sentence.
     */
    it('refuses more locales than a single request can translate', () => {
      const many = Array.from(
        { length: 21 },
        (_, i) =>
          String.fromCharCode(97 + Math.floor(i / 26)) +
          String.fromCharCode(97 + (i % 26)),
      ).join(',');
      expect(() => parseTargetLocales(many, from('en'))).toThrow(/limit is 20/);
    });

    it('accepts exactly the limit', () => {
      const twenty = Array.from(
        { length: 20 },
        (_, i) =>
          String.fromCharCode(97 + Math.floor(i / 26)) +
          String.fromCharCode(97 + (i % 26)),
      ).join(',');
      expect(parseTargetLocales(twenty, from('zz'))).toHaveLength(20);
    });
  });

  it('accepts what the CLI defaults to, unchanged', () => {
    // packages/cli DEFAULT_LOCALES. If this list stops round-tripping, the two
    // halves of the product disagree about what a locale is.
    expect(parseTargetLocales('de,ja,es,ar,pt-BR', from('en'))).toEqual([
      'de',
      'ja',
      'es',
      'ar',
      'pt-BR',
    ]);
  });
});
