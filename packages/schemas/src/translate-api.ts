import { z } from 'zod';

export const TranslatableStringSchema = z.object({
  key: z.string().min(1),
  text: z.string().min(1),
  filePath: z.string(),
  componentName: z.string().nullable(),
  surroundingCode: z.string(),
});
export type TranslatableString = z.infer<typeof TranslatableStringSchema>;

export const TranslateBatchRequestSchema = z.object({
  targetLocale: z.string().min(1),
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
