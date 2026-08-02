import type {
  TranslateBatchRequest,
  TranslateBatchResponse,
} from '@localize-infra/schemas';
import type { Provider } from '../router/types.js';
import { parseTranslationResponse } from './parse-response.js';
import { buildBatchPrompt } from './prompt.js';

export async function handleTranslateBatch(
  request: TranslateBatchRequest,
  provider: Provider,
  modelId: string,
): Promise<TranslateBatchResponse> {
  const prompt = buildBatchPrompt(request);
  const raw = await provider.translate(prompt, modelId);
  const translations = parseTranslationResponse(raw);
  const foundKeys = new Set(translations.map((t) => t.key));
  const missingKeys = request.strings
    .filter((s) => !foundKeys.has(s.key))
    .map((s) => s.key);
  return { translations, missingKeys };
}
