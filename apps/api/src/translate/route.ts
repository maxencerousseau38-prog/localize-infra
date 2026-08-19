import {
  TranslateBatchRequestSchema,
  TranslateBatchResponseSchema,
} from '@localize-infra/schemas';
import {
  PROVIDER_NAMES,
  type ProviderName,
  pickProvider,
} from '../router/index.js';
import type { Provider } from '../router/types.js';
import { handleTranslateBatch } from './handler.js';

/**
 * Partial on purpose: a deployment holds keys for the providers it holds keys
 * for, and one of them is a perfectly good configuration.
 */
export type Providers = Partial<Record<ProviderName, Provider>>;
export type ModelIds = Partial<Record<ProviderName, string>>;

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

  const available = PROVIDER_NAMES.filter((name) => providers[name]);
  if (available.length === 0) {
    // 503, not 502: nothing upstream was asked and failed — this deployment has
    // no provider to ask. The distinction is what tells an operator to set a
    // key rather than to go looking at a provider's status page.
    return {
      status: 503,
      body: {
        error:
          'No translation provider is configured on this deployment. Set ANTHROPIC_API_KEY or OPENAI_API_KEY.',
      },
    };
  }

  const providerName = pickProvider(parsed.data.targetLocale, available);
  const provider = providers[providerName] as Provider;
  const modelId = modelIds[providerName];
  if (!modelId) {
    return {
      status: 503,
      body: { error: `No model id configured for provider "${providerName}".` },
    };
  }

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
