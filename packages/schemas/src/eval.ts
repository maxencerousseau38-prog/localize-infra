import { z } from 'zod';

export const TARGET_LOCALES = ['de', 'ja', 'es', 'ar', 'pt-BR'] as const;
export type TargetLocale = (typeof TARGET_LOCALES)[number];

export const ERROR_TAGS = [
  'terminologie',
  'registre',
  'grammaire',
  'troncature',
  'placeholder_corrompu',
  'contresens',
] as const;
export type ErrorTag = (typeof ERROR_TAGS)[number];

export const CorpusEntrySchema = z.object({
  id: z.string().min(1),
  sourceProject: z.string().min(1),
  sourceLicense: z.string().min(1),
  sourceRepoUrl: z.string().url(),
  sourceCommit: z.string().regex(/^[0-9a-f]{40}$/),
  filePath: z.string().min(1),
  surroundingCode: z.string(),
  componentName: z.string().nullable(),
  icuStructure: z.string().nullable(),
  sourceText: z.string().min(1),
  targetLocale: z.enum(TARGET_LOCALES),
  humanReference: z.string().min(1),
  maxLength: z.number().int().positive().nullable(),
});
export type CorpusEntry = z.infer<typeof CorpusEntrySchema>;

export const TranslationResultSchema = z.object({
  corpusEntryId: z.string().min(1),
  condition: z.enum(['A', 'B']),
  targetLocale: z.enum(TARGET_LOCALES),
  provider: z.enum(['anthropic', 'openai']),
  modelId: z.string().min(1),
  text: z.string(),
  error: z.string().nullable(),
});
export type TranslationResult = z.infer<typeof TranslationResultSchema>;

export const GlossaryHitSchema = z.object({
  term: z.string().min(1),
  respected: z.boolean(),
});

export const DeterministicScoreSchema = z.object({
  corpusEntryId: z.string().min(1),
  condition: z.enum(['A', 'B']),
  placeholderIntact: z.boolean(),
  icuValid: z.boolean(),
  pluralCategoriesCorrect: z.boolean().nullable(),
  lengthOverflow: z.boolean(),
  glossaryHits: z.array(GlossaryHitSchema),
});
export type DeterministicScore = z.infer<typeof DeterministicScoreSchema>;

export const GlossaryEntrySchema = z.object({
  term: z.string().min(1),
  translations: z.record(z.string()),
});
export type GlossaryEntry = z.infer<typeof GlossaryEntrySchema>;

export const ComparisonTaskSchema = z.object({
  id: z.string().min(1),
  corpusEntryId: z.string().min(1),
  targetLocale: z.enum(TARGET_LOCALES),
  pairType: z.enum(['A_vs_C', 'B_vs_C']),
  left: z.string(),
  right: z.string(),
  leftIsCondition: z.enum(['A', 'B', 'C']),
  rightIsCondition: z.enum(['A', 'B', 'C']),
});
export type ComparisonTask = z.infer<typeof ComparisonTaskSchema>;

export const ComparisonJudgmentSchema = z.object({
  taskId: z.string().min(1),
  evaluatorId: z.string().min(1),
  preferred: z.enum(['left', 'right', 'equivalent']),
  errorTags: z.array(z.enum(ERROR_TAGS)),
  notes: z.string().nullable(),
});
export type ComparisonJudgment = z.infer<typeof ComparisonJudgmentSchema>;
