import type { TranslateBatchRequest } from '@localize-infra/schemas';
import { describe, expect, it, vi } from 'vitest';
import type { Provider } from '../router/types.js';
import { handleTranslateBatch } from './handler.js';

const request: TranslateBatchRequest = {
  targetLocale: 'de',
  strings: [
    {
      key: 'a',
      text: 'Welcome',
      filePath: 'x.tsx',
      componentName: null,
      surroundingCode: '',
    },
    {
      key: 'b',
      text: 'Cancel',
      filePath: 'x.tsx',
      componentName: null,
      surroundingCode: '',
    },
  ],
};

function fakeProvider(responseText: string): Provider {
  return { name: 'anthropic', translate: vi.fn(async () => responseText) };
}

describe('handleTranslateBatch', () => {
  it('returns translations for every requested key when the model responds completely', async () => {
    const provider = fakeProvider(
      '[{"key":"a","text":"Willkommen"},{"key":"b","text":"Abbrechen"}]',
    );
    const result = await handleTranslateBatch(
      request,
      provider,
      'claude-sonnet-5',
    );
    expect(result.translations).toEqual([
      {
        key: 'a',
        text: 'Willkommen',
        confidence: 'confident',
        question: null,
        alternatives: [],
      },
      {
        key: 'b',
        text: 'Abbrechen',
        confidence: 'confident',
        question: null,
        alternatives: [],
      },
    ]);
    expect(result.missingKeys).toEqual([]);
  });

  it('reports missingKeys for requested strings the model did not translate, without throwing', async () => {
    const provider = fakeProvider('[{"key":"a","text":"Willkommen"}]');
    const result = await handleTranslateBatch(
      request,
      provider,
      'claude-sonnet-5',
    );
    expect(result.translations).toEqual([
      {
        key: 'a',
        text: 'Willkommen',
        confidence: 'confident',
        question: null,
        alternatives: [],
      },
    ]);
    expect(result.missingKeys).toEqual(['b']);
  });
});
