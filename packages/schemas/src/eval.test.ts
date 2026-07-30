import { describe, expect, it } from 'vitest'
import {
  ComparisonJudgmentSchema,
  ComparisonTaskSchema,
  CorpusEntrySchema,
  DeterministicScoreSchema,
  GlossaryEntrySchema,
  TARGET_LOCALES,
  TranslationResultSchema,
} from './eval.js'

const validEntry = {
  id: 'excalidraw-labels.paste-de',
  sourceProject: 'excalidraw',
  sourceLicense: 'MIT',
  sourceRepoUrl: 'https://github.com/excalidraw/excalidraw',
  sourceCommit: '786ab266ff3a9cfffaed16804cf9132b44bc08ae',
  filePath: 'packages/excalidraw/locales/en.json',
  surroundingCode: '"labels": { "paste": "Paste", "pasteAsPlaintext": "Paste as plaintext" }',
  componentName: 'labels',
  icuStructure: null,
  sourceText: 'Paste',
  targetLocale: 'de',
  humanReference: 'Einfügen',
  maxLength: 20,
}

describe('CorpusEntrySchema', () => {
  it('accepts a valid entry', () => {
    expect(CorpusEntrySchema.parse(validEntry)).toEqual(validEntry)
  })

  it('rejects a targetLocale outside the 5 supported locales', () => {
    expect(() => CorpusEntrySchema.parse({ ...validEntry, targetLocale: 'fr' })).toThrow()
  })

  it('rejects a negative maxLength', () => {
    expect(() => CorpusEntrySchema.parse({ ...validEntry, maxLength: -1 })).toThrow()
  })
})

describe('TranslationResultSchema', () => {
  it('accepts a valid result with a null error', () => {
    const result = {
      corpusEntryId: validEntry.id,
      condition: 'B',
      targetLocale: 'de',
      provider: 'anthropic',
      modelId: 'claude-sonnet-5',
      text: 'Einfügen',
      error: null,
    }
    expect(TranslationResultSchema.parse(result)).toEqual(result)
  })
})

describe('DeterministicScoreSchema', () => {
  it('allows null pluralCategoriesCorrect when the string has no plural', () => {
    const score = {
      corpusEntryId: validEntry.id,
      condition: 'B',
      placeholderIntact: true,
      icuValid: true,
      pluralCategoriesCorrect: null,
      lengthOverflow: false,
      glossaryHits: [],
    }
    expect(DeterministicScoreSchema.parse(score)).toEqual(score)
  })
})

describe('GlossaryEntrySchema', () => {
  it('accepts a term with per-locale translations', () => {
    const entry = { term: 'GitHub', translations: { de: 'GitHub', ja: 'GitHub' } }
    expect(GlossaryEntrySchema.parse(entry)).toEqual(entry)
  })
})

describe('ComparisonTaskSchema and ComparisonJudgmentSchema', () => {
  it('accepts a blind task and a judgment with a valid error tag', () => {
    const task = {
      id: 'task-1',
      corpusEntryId: validEntry.id,
      targetLocale: 'de',
      pairType: 'B_vs_C',
      left: 'Einfügen',
      right: 'Einfügen (aus Zwischenablage)',
      leftIsCondition: 'B',
      rightIsCondition: 'C',
    }
    expect(ComparisonTaskSchema.parse(task)).toEqual(task)

    const judgment = {
      taskId: 'task-1',
      evaluatorId: 'eval-1',
      preferred: 'equivalent',
      errorTags: ['registre'],
      notes: null,
    }
    expect(ComparisonJudgmentSchema.parse(judgment)).toEqual(judgment)
  })
})

describe('TARGET_LOCALES', () => {
  it('has exactly the 5 spec-mandated locales', () => {
    expect(TARGET_LOCALES).toEqual(['de', 'ja', 'es', 'ar', 'pt-BR'])
  })
})
