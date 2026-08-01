import { ComparisonJudgmentSchema, type ComparisonJudgment } from '@localize-infra/schemas'

export function parseJudgmentsFile(raw: string): ComparisonJudgment[] {
  const parsed = JSON.parse(raw) as unknown[]
  return parsed.map((entry) => ComparisonJudgmentSchema.parse(entry))
}
