import {
  type TranslatedString,
  TranslatedStringSchema,
} from '@localize-infra/schemas';

function extractJsonArray(raw: string): string {
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('No JSON array found in model response');
  }
  return raw.slice(start, end + 1);
}

/**
 * Turns a model's reply into translated strings, confidence included.
 *
 * Validation goes through the shared schema rather than hand-written type
 * guards. That is what makes the ambiguity contract enforceable at the edge:
 * a model that claims 'ambiguous' without a question, or offers an alternative
 * with no rationale, is rejected here rather than producing an escalation a
 * developer cannot act on.
 *
 * A model that answers in the older two-field shape still parses — the schema
 * defaults it to confident — so adding this field did not become a flag day
 * for every provider at once.
 */
export function parseTranslationResponse(raw: string): TranslatedString[] {
  const jsonText = extractJsonArray(raw);
  const parsed: unknown = JSON.parse(jsonText);
  if (!Array.isArray(parsed))
    throw new Error('Model response was not a JSON array');

  return parsed.map((item, index) => {
    const result = TranslatedStringSchema.safeParse(item);
    if (!result.success) {
      const detail = result.error.issues
        .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
        .join('; ');
      throw new Error(
        `Model response array item at index ${index} is invalid — ${detail}`,
      );
    }
    return result.data;
  });
}
