import { describe, expect, it } from 'vitest'
import type { ComparisonJudgment, ComparisonTask } from '@localize-infra/schemas'
import { buildReport } from './build.js'

const tasks: ComparisonTask[] = [
  {
    id: 't1',
    corpusEntryId: 'e1',
    targetLocale: 'de',
    pairType: 'B_vs_C',
    left: 'B-text',
    right: 'C-text',
    leftIsCondition: 'B',
    rightIsCondition: 'C',
  },
  {
    id: 't2',
    corpusEntryId: 'e2',
    targetLocale: 'de',
    pairType: 'B_vs_C',
    left: 'C-text',
    right: 'B-text',
    leftIsCondition: 'C',
    rightIsCondition: 'B',
  },
]

const judgments: ComparisonJudgment[] = [
  { taskId: 't1', evaluatorId: 'e1', preferred: 'left', errorTags: [], notes: null },
  { taskId: 't2', evaluatorId: 'e1', preferred: 'equivalent', errorTags: [], notes: null },
]

describe('buildReport', () => {
  it('resolves preferred left/right back to B/C using task provenance, and counts B-preferred-or-equivalent correctly', () => {
    const { markdownByLocale, gate } = buildReport(tasks, judgments)
    const deReport = markdownByLocale.get('de')!
    expect(deReport).toContain('B_vs_C')
    expect(deReport).toContain('2/2')
    expect(gate.passingLocales).toContain('de')
  })
})
