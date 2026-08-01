import { createAnthropicProvider } from './anthropic.js';
import { createOpenAiProvider } from './openai.js';
import type { Provider, TranslateRequest } from './types.js';

export type { Provider, TranslateRequest } from './types.js';

export function pickProvider(seed: string): 'anthropic' | 'openai' {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % 2 === 0 ? 'anthropic' : 'openai';
}

export function getProvider(name: 'anthropic' | 'openai'): Provider {
  if (name === 'anthropic') {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');
    return createAnthropicProvider(apiKey);
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set');
  return createOpenAiProvider(apiKey, process.env.OPENAI_BASE_URL);
}

export async function translate(
  req: TranslateRequest,
  provider: Provider,
  modelId: string,
): Promise<string> {
  return provider.translate(req, modelId);
}
