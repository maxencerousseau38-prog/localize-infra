import type { TranslateBatchRequest } from '@localize-infra/schemas';
import type { TranslateRequest } from '../router/types.js';

const INSTRUCTIONS =
  'You are a professional software localization translator. Translate each UI string in the given JSON array from English to the target locale. Preserve any placeholders or interpolation syntax exactly as they appear (e.g. %s, {{variable}}, {variable}, ICU plural/select blocks). Use the file path, component name, and surrounding code as context for tone and terminology. Respond with ONLY a JSON array of objects, each with exactly "key" and "text" fields, one per input string, no markdown code fences, no explanation.';

export function buildBatchPrompt(
  request: TranslateBatchRequest,
): TranslateRequest {
  const items = request.strings.map((s) => ({
    key: s.key,
    text: s.text,
    filePath: s.filePath,
    componentName: s.componentName,
    surroundingCode: s.surroundingCode,
  }));
  return {
    systemPrompt: `${INSTRUCTIONS}\nTarget locale: ${request.targetLocale}`,
    userPrompt: JSON.stringify(items, null, 2),
  };
}
