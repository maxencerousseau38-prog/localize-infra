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
    expect(TranslateBatchResponseSchema.parse(response)).toEqual(response);
  });

  it('accepts a translated string', () => {
    expect(TranslatedStringSchema.parse({ key: 'a', text: 'Hallo' })).toEqual({
      key: 'a',
      text: 'Hallo',
    });
  });
});
