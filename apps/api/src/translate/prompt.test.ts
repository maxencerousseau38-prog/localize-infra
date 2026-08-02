import type { TranslateBatchRequest } from '@localize-infra/schemas';
import { describe, expect, it } from 'vitest';
import { buildBatchPrompt } from './prompt.js';

const request: TranslateBatchRequest = {
  targetLocale: 'de',
  strings: [
    {
      key: 'a',
      text: 'Welcome',
      filePath: 'src/App.tsx',
      componentName: 'App',
      surroundingCode: '<h1>Welcome</h1>',
    },
  ],
};

describe('buildBatchPrompt', () => {
  it('includes the target locale and preservation instructions in the system prompt', () => {
    const prompt = buildBatchPrompt(request);
    expect(prompt.systemPrompt).toContain('de');
    expect(prompt.systemPrompt.toLowerCase()).toContain('placeholder');
  });

  it('serializes the strings array (key, text, context) as the user prompt', () => {
    const prompt = buildBatchPrompt(request);
    const parsed = JSON.parse(prompt.userPrompt);
    expect(parsed).toEqual([
      {
        key: 'a',
        text: 'Welcome',
        filePath: 'src/App.tsx',
        componentName: 'App',
        surroundingCode: '<h1>Welcome</h1>',
      },
    ]);
  });
});
