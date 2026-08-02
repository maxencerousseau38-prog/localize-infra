import type { TranslatedString } from '@localize-infra/schemas';

function extractJsonArray(raw: string): string {
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('No JSON array found in model response');
  }
  return raw.slice(start, end + 1);
}

export function parseTranslationResponse(raw: string): TranslatedString[] {
  const jsonText = extractJsonArray(raw);
  const parsed: unknown = JSON.parse(jsonText);
  if (!Array.isArray(parsed))
    throw new Error('Model response was not a JSON array');

  return parsed.map((item, index) => {
    if (
      typeof item !== 'object' ||
      item === null ||
      typeof (item as Record<string, unknown>).key !== 'string' ||
      typeof (item as Record<string, unknown>).text !== 'string'
    ) {
      throw new Error(
        `Model response array item at index ${index} is missing key or text`,
      );
    }
    const record = item as Record<string, unknown>;
    return { key: record.key as string, text: record.text as string };
  });
}
