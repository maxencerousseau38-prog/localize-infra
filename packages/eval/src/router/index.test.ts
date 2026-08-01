import { describe, expect, it, vi } from 'vitest';
import { pickProvider } from './index.js';
import type { Provider, TranslateRequest } from './types.js';

describe('pickProvider', () => {
  it('is deterministic for the same seed', () => {
    expect(pickProvider('excalidraw-labels.paste-de')).toBe(
      pickProvider('excalidraw-labels.paste-de'),
    );
  });

  it('distributes across both providers over many seeds', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) seen.add(pickProvider(`entry-${i}`));
    expect(seen).toEqual(new Set(['anthropic', 'openai']));
  });
});

describe('translate', () => {
  it('delegates to the given provider with the given modelId', async () => {
    const { translate } = await import('./index.js');
    const fakeProvider: Provider = {
      name: 'anthropic',
      translate: vi.fn(
        async (_req: TranslateRequest, modelId: string) =>
          `translated-by-${modelId}`,
      ),
    };
    const result = await translate(
      { systemPrompt: 'sys', userPrompt: 'Paste' },
      fakeProvider,
      'claude-sonnet-5',
    );
    expect(result).toBe('translated-by-claude-sonnet-5');
    expect(fakeProvider.translate).toHaveBeenCalledWith(
      { systemPrompt: 'sys', userPrompt: 'Paste' },
      'claude-sonnet-5',
    );
  });
});
