import { describe, expect, it } from 'vitest'
import type { CorpusEntry, TranslationResult } from '@localize-infra/schemas'
import { generateComparisonTasks } from './generate.js'

const entry: CorpusEntry = {
  id: 'x',
  sourceProject: 'excalidraw',
  sourceLicense: 'MIT',
  sourceRepoUrl: 'https://github.com/excalidraw/excalidraw',
  sourceCommit: '786ab266ff3a9cfffaed16804cf9132b44bc08ae',
  filePath: 'en.json',
  surroundingCode: '',
  componentName: null,
  icuStructure: null,
  sourceText: 'Paste',
  targetLocale: 'de',
  humanReference: 'Einfügen',
  maxLength: 20,
}

function result(condition: 'A' | 'B', text: string): TranslationResult {
  return { corpusEntryId: 'x', condition, targetLocale: 'de', provider: 'anthropic', modelId: 'm', text, error: null }
}

describe('generateComparisonTasks', () => {
  it('produces one A_vs_C and one B_vs_C task per entry, hiding provenance behind leftIsCondition/rightIsCondition', () => {
    const tasks = generateComparisonTasks([entry], [result('A', 'A-text'), result('B', 'B-text')], () => false)
    expect(tasks).toHaveLength(2)
    const aVsC = tasks.find((t) => t.pairType === 'A_vs_C')!
    expect(new Set([aVsC.leftIsCondition, aVsC.rightIsCondition])).toEqual(new Set(['A', 'C']))
    expect(new Set([aVsC.left, aVsC.right])).toEqual(new Set(['A-text', 'Einfügen']))
  })

  it('swaps left/right when the shuffle function returns true, keeping provenance tracked correctly', () => {
    const tasks = generateComparisonTasks([entry], [result('A', 'A-text'), result('B', 'B-text')], () => true)
    const aVsC = tasks.find((t) => t.pairType === 'A_vs_C')!
    expect(aVsC.leftIsCondition).toBe('C')
    expect(aVsC.left).toBe('Einfügen')
    expect(aVsC.rightIsCondition).toBe('A')
    expect(aVsC.right).toBe('A-text')
  })

  it('skips a pair when the model translation for that condition errored out', () => {
    const errored: TranslationResult = { ...result('A', ''), error: 'timeout' }
    const tasks = generateComparisonTasks([entry], [errored, result('B', 'B-text')], () => false)
    expect(tasks.find((t) => t.pairType === 'A_vs_C')).toBeUndefined()
    expect(tasks.find((t) => t.pairType === 'B_vs_C')).toBeDefined()
  })
})
