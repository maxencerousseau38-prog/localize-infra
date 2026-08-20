import { describe, expect, it, vi } from 'vitest';
import type { Provider } from '../router/types.js';
import { translateRouteHandler } from './route.js';

function fakeProvider(
  name: 'anthropic' | 'openai',
  responseText: string,
): Provider {
  return { name, translate: vi.fn(async () => responseText) };
}

const providers = {
  anthropic: fakeProvider('anthropic', '[{"key":"a","text":"Willkommen"}]'),
  openai: fakeProvider('openai', '[{"key":"a","text":"Willkommen"}]'),
};
const modelIds = { anthropic: 'claude-sonnet-5', openai: 'gpt-4o' };

describe('translateRouteHandler', () => {
  it('returns 200 with translations for a valid request', async () => {
    const body = {
      targetLocale: 'de',
      strings: [
        {
          key: 'a',
          text: 'Welcome',
          filePath: 'x.tsx',
          componentName: null,
          surroundingCode: '',
        },
      ],
    };
    const result = await translateRouteHandler(body, providers, modelIds);
    expect(result.status).toBe(200);
    expect(result.body).toEqual({
      translations: [
        {
          key: 'a',
          text: 'Willkommen',
          confidence: 'confident',
          question: null,
          alternatives: [],
        },
      ],
      missingKeys: [],
    });
  });

  it('returns 400 for a request body that fails schema validation', async () => {
    const result = await translateRouteHandler(
      { targetLocale: 'de', strings: [] },
      providers,
      modelIds,
    );
    expect(result.status).toBe(400);
  });

  it('returns 502 when the provider throws', async () => {
    const failingProviders = {
      anthropic: {
        name: 'anthropic' as const,
        translate: vi.fn(async () => {
          throw new Error('rate limited');
        }),
      },
      openai: providers.openai,
    };
    const body = {
      targetLocale: 'de',
      strings: [
        {
          key: 'a',
          text: 'Welcome',
          filePath: 'x.tsx',
          componentName: null,
          surroundingCode: '',
        },
      ],
    };
    // Force the 'de' seed to route to anthropic deterministically isn't guaranteed; instead
    // exercise both providers failing to make the test provider-independent.
    const bothFail = {
      anthropic: failingProviders.anthropic,
      openai: {
        name: 'openai' as const,
        translate: vi.fn(async () => {
          throw new Error('rate limited');
        }),
      },
    };
    const result = await translateRouteHandler(body, bothFail, modelIds);
    expect(result.status).toBe(502);
  });
});
