import { z } from 'zod';

export const OpenPrFileSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
});

export const OpenPrApiRequestSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  baseBranch: z.string().min(1),
  title: z.string().min(1),
  body: z.string(),
  files: z.array(OpenPrFileSchema).min(1),
});
export type OpenPrApiRequest = z.infer<typeof OpenPrApiRequestSchema>;

export const OpenPrApiResponseSchema = z.object({
  prUrl: z.string().url(),
  prNumber: z.number().int().positive(),
});
export type OpenPrApiResponse = z.infer<typeof OpenPrApiResponseSchema>;
