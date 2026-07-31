import { describe, expect, it } from 'vitest'
import type { CorpusEntry } from '@localize-infra/schemas'
import { deriveGlossary } from './glossary.js'

function entry(overrides: Partial<CorpusEntry>): CorpusEntry {
  return {
    id: 'x',
    sourceProject: 'excalidraw',
    sourceLicense: 'MIT',
    sourceRepoUrl: 'https://github.com/excalidraw/excalidraw',
    sourceCommit: '786ab266ff3a9cfffaed16804cf9132b44bc08ae',
    filePath: 'en.json',
    surroundingCode: '',
    componentName: null,
    icuStructure: null,
    sourceText: 'Sign in with GitHub',
    targetLocale: 'de',
    humanReference: 'Mit GitHub anmelden',
    maxLength: null,
    ...overrides,
  }
}

describe('deriveGlossary', () => {
  it('keeps a candidate term for a locale when it appears verbatim in at least 80% of matching translations', () => {
    const entries = [
      entry({ id: '1' }),
      entry({ id: '2' }),
      entry({ id: '3' }),
      entry({ id: '4', sourceText: 'Connect GitHub account', humanReference: 'GitHub-Konto verbinden' }),
    ]
    const glossary = deriveGlossary(entries)
    const github = glossary.find((g) => g.term === 'GitHub')
    expect(github?.translations.de).toBe('GitHub')
  })

  it('drops a term for a locale below the 80% verbatim threshold', () => {
    const entries = [
      entry({ id: '1' }),
      entry({ id: '2' }),
      entry({ id: '3' }),
      entry({ id: '4', humanReference: 'Übersetzt ohne den Begriff' }),
      entry({ id: '5', humanReference: 'Auch ohne den Begriff' }),
    ]
    const glossary = deriveGlossary(entries)
    expect(glossary.find((g) => g.term === 'GitHub')).toBeUndefined()
  })

  it('drops a term seen fewer than 3 times for a locale', () => {
    const entries = [entry({ id: '1' }), entry({ id: '2' })]
    const glossary = deriveGlossary(entries)
    expect(glossary.find((g) => g.term === 'GitHub')).toBeUndefined()
  })
})
