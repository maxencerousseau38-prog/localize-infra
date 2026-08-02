import {
  TranslateBatchRequestSchema,
  TranslateBatchResponseSchema,
} from '@localize-infra/schemas';
import { pickProvider } from '../router/index.js';
import type { Provider } from '../router/types.js';
import { handleTranslateBatch } from './handler.js';

export interface Providers {
  anthropic: Provider;
  openai: Provider;
}

export interface ModelIds {
  anthropic: string;
  openai: string;
}

export async function translateRouteHandler(
  body: unknown,
  providers: Providers,
  modelIds: ModelIds,
): Promise<{ status: number; body: unknown }> {
  const parsed = TranslateBatchRequestSchema.safeParse(body);
  if (!parsed.success) {
    return {
      status: 400,
      body: { error: 'Invalid request body', details: parsed.error.flatten() },
    };
  }

  const providerName = pickProvider(parsed.data.targetLocale);
  const provider = providers[providerName];
  const modelId = modelIds[providerName];

  try {
    const result = await handleTranslateBatch(parsed.data, provider, modelId);
    return { status: 200, body: TranslateBatchResponseSchema.parse(result) };
  } catch (err) {
    return {
      status: 502,
      body: { error: err instanceof Error ? err.message : String(err) },
    };
  }
}
