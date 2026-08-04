import { z } from 'zod';

export const TranslatableStringSchema = z.object({
  key: z.string().min(1),
  text: z.string().min(1),
  filePath: z.string(),
  componentName: z.string().nullable(),
  surroundingCode: z.string(),
});
export type TranslatableString = z.infer<typeof TranslatableStringSchema>;

// targetLocale reaches two sinks: an LLM system prompt (apps/api/src/translate/prompt.ts)
// and, on the CLI side, a filesystem path via `locales/<locale>.json` (packages/cli's
// writeLocaleFile). A BCP-47-ish allowlist keeps it from being anything but a short
// language/region tag, ruling out path-traversal-shaped values like `../../x` or
// prompt-injection-shaped values containing whitespace/newlines.
const LOCALE_TAG_PATTERN = /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/;

export const TranslateBatchRequestSchema = z.object({
  targetLocale: z.string().min(1).regex(LOCALE_TAG_PATTERN, {
    message:
      'targetLocale must be a valid locale/language tag (e.g. "de", "pt-BR")',
  }),
  strings: z.array(TranslatableStringSchema).min(1),
});
export type TranslateBatchRequest = z.infer<typeof TranslateBatchRequestSchema>;

export const TranslatedStringSchema = z.object({
  key: z.string().min(1),
  text: z.string(),
});
export type TranslatedString = z.infer<typeof TranslatedStringSchema>;

export const TranslateBatchResponseSchema = z.object({
  translations: z.array(TranslatedStringSchema),
  missingKeys: z.array(z.string()),
});
export type TranslateBatchResponse = z.infer<
  typeof TranslateBatchResponseSchema
>;
