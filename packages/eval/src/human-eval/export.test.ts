import { describe, expect, it } from 'vitest'
import type { ComparisonTask } from '@localize-infra/schemas'
import { tasksToCsv } from './export.js'

const tasks: ComparisonTask[] = [
  {
    id: 'x-A_vs_C',
    corpusEntryId: 'x',
    targetLocale: 'de',
    pairType: 'A_vs_C',
    left: 'A-text',
    right: 'Einfügen, mit "Komma"',
    leftIsCondition: 'A',
    rightIsCondition: 'C',
  },
]

describe('tasksToCsv', () => {
  it('produces a header row plus one quoted, comma-safe row per task, omitting provenance columns', () => {
    const csv = tasksToCsv(tasks)
    const lines = csv.trim().split('\n')
    expect(lines[0]).toBe('id,targetLocale,pairType,left,right')
    expect(lines[1]).toBe('x-A_vs_C,de,A_vs_C,A-text,"Einfügen, mit ""Komma"""')
  })

  it('quotes a field containing an embedded newline per RFC4180', () => {
    const tasksWithNewline: ComparisonTask[] = [
      {
        id: 'y-A_vs_C',
        corpusEntryId: 'y',
        targetLocale: 'de',
        pairType: 'A_vs_C',
        left: 'line one\nline two',
        right: 'plain',
        leftIsCondition: 'A',
        rightIsCondition: 'C',
      },
    ]
    const csv = tasksToCsv(tasksWithNewline)
    expect(csv).toBe('id,targetLocale,pairType,left,right\ny-A_vs_C,de,A_vs_C,"line one\nline two",plain\n')
  })
})
