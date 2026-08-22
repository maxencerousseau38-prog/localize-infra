import { describe, expect, it } from 'vitest';
import {
  TranslatableStringSchema,
  TranslateBatchRequestSchema,
  TranslateBatchResponseSchema,
  TranslatedStringSchema,
} from './translate-api.js';

describe('TranslatableStringSchema', () => {
  it('accepts a valid entry with a null componentName', () => {
    const entry = {
      key: 'src.App.welcome',
      text: 'Welcome',
      filePath: 'src/App.tsx',
      componentName: null,
      surroundingCode: '<h1>Welcome</h1>',
    };
    expect(TranslatableStringSchema.parse(entry)).toEqual(entry);
  });

  it('rejects an empty key', () => {
    expect(() =>
      TranslatableStringSchema.parse({
        key: '',
        text: 'x',
        filePath: 'a.tsx',
        componentName: null,
        surroundingCode: '',
      }),
    ).toThrow();
  });
});

describe('TranslateBatchRequestSchema', () => {
  it('requires at least one string', () => {
    expect(() =>
      TranslateBatchRequestSchema.parse({ targetLocale: 'de', strings: [] }),
    ).toThrow();
  });

  it('accepts a valid batch request', () => {
    const request = {
      targetLocale: 'de',
      strings: [
        {
          key: 'a',
          text: 'Hello',
          filePath: 'a.tsx',
          componentName: null,
          surroundingCode: '',
        },
      ],
    };
    expect(TranslateBatchRequestSchema.parse(request)).toEqual(request);
  });

  const validString = {
    key: 'a',
    text: 'Hello',
    filePath: 'a.tsx',
    componentName: null,
    surroundingCode: '',
  };

  it.each(['de', 'ja', 'es', 'ar', 'pt-BR'])(
    'accepts the default target locale %s',
    (targetLocale) => {
      expect(() =>
        TranslateBatchRequestSchema.parse({
          targetLocale,
          strings: [validString],
        }),
      ).not.toThrow();
    },
  );

  it('rejects a path-traversal-shaped targetLocale', () => {
    expect(() =>
      TranslateBatchRequestSchema.parse({
        targetLocale: '../../x',
        strings: [validString],
      }),
    ).toThrow();
  });
});

describe('TranslatedStringSchema and TranslateBatchResponseSchema', () => {
  it('allows an empty translations array alongside missingKeys', () => {
    const response = { translations: [], missingKeys: ['a', 'b'] };
    // `failures` is defaulted rather than required, so a client written against
    // the older shape still parses. It arrives as an empty array, which is the
    // honest reading: nothing was lost to a fault, the model just left keys out.
    expect(TranslateBatchResponseSchema.parse(response)).toEqual({
      ...response,
      failures: [],
    });
  });

  it('carries why a chunk was given up on, when there was a fault', () => {
    /*
     * `missingKeys` cannot distinguish a model that answered and omitted a
     * string from a chunk whose every attempt came back unparseable — and the
     * benchmark in docs/product/10-model-benchmark.md saw both. This is the
     * field that tells them apart.
     */
    const response = {
      translations: [],
      missingKeys: ['a'],
      failures: [
        {
          keys: ['a'],
          attempts: 3,
          error: 'Unterminated string in JSON at position 2453',
        },
      ],
    };
    expect(TranslateBatchResponseSchema.parse(response)).toEqual(response);
  });

  it('refuses a failure record that claims zero attempts', () => {
    expect(() =>
      TranslateBatchResponseSchema.parse({
        translations: [],
        missingKeys: ['a'],
        failures: [{ keys: ['a'], attempts: 0, error: 'x' }],
      }),
    ).toThrow();
  });

  it('accepts a translated string, defaulting it to confident', () => {
    // A provider answering in the older two-field shape is treated as sure of
    // itself rather than crashing the batch. The defaults are asserted here
    // because they are the compatibility contract, not an implementation
    // detail: if they ever change, every older provider silently changes
    // behaviour with them.
    expect(TranslatedStringSchema.parse({ key: 'a', text: 'Hallo' })).toEqual({
      key: 'a',
      text: 'Hallo',
      confidence: 'confident',
      question: null,
      alternatives: [],
    });
  });

  it('accepts an ambiguous translation carrying its question', () => {
    const parsed = TranslatedStringSchema.parse({
      key: 'nav.home',
      text: 'Startseite',
      confidence: 'ambiguous',
      question:
        '"Home" is a navigation label here, but could be a house. Which sense applies?',
      alternatives: [
        { text: 'Startseite', rationale: 'The landing page of a site' },
        { text: 'Zuhause', rationale: 'A dwelling' },
      ],
    });
    expect(parsed.confidence).toBe('ambiguous');
    expect(parsed.alternatives).toHaveLength(2);
  });

  it('refuses an ambiguous translation with nothing to ask', () => {
    // An escalation with no question is an interruption with no way to answer
    // it. Refusing at the schema keeps that out of the queue entirely.
    expect(() =>
      TranslatedStringSchema.parse({
        key: 'nav.home',
        text: 'Startseite',
        confidence: 'ambiguous',
      }),
    ).toThrow();
  });

  it('refuses an alternative with no rationale', () => {
    expect(() =>
      TranslatedStringSchema.parse({
        key: 'nav.home',
        text: 'Startseite',
        confidence: 'ambiguous',
        question: 'Which sense?',
        alternatives: [{ text: 'Zuhause', rationale: '' }],
      }),
    ).toThrow();
  });
});
