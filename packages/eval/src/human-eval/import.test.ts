import { describe, expect, it } from 'vitest'
import { parseJudgmentsFile } from './import.js'

describe('parseJudgmentsFile', () => {
  it('parses a JSON array of judgments, validating each against the schema', () => {
    const raw = JSON.stringify([
      { taskId: 't1', evaluatorId: 'e1', preferred: 'left', errorTags: [], notes: null },
    ])
    expect(parseJudgmentsFile(raw)).toEqual([
      { taskId: 't1', evaluatorId: 'e1', preferred: 'left', errorTags: [], notes: null },
    ])
  })

  it('throws with a clear message when an entry has an invalid preferred value', () => {
    const raw = JSON.stringify([{ taskId: 't1', evaluatorId: 'e1', preferred: 'sideways', errorTags: [], notes: null }])
    expect(() => parseJudgmentsFile(raw)).toThrow()
  })
})
