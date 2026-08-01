import {
  type ComparisonJudgment,
  ComparisonJudgmentSchema,
} from '@localize-infra/schemas';

export function parseJudgmentsFile(raw: string): ComparisonJudgment[] {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error('judgments.json must be a JSON array of judgment objects');
  }
  return parsed.map((entry) => ComparisonJudgmentSchema.parse(entry));
}
