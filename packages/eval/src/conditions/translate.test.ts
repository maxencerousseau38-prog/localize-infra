import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CorpusEntry, GlossaryEntry } from '@localize-infra/schemas'
import type { Provider } from '../router/types.js'
import { runTranslationPipeline } from './translate.js'

const entries: CorpusEntry[] = [
  {
    id: 'entry-a',
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
  },
]

const glossary: GlossaryEntry[] = []

function fakeProvider(name: 'anthropic' | 'openai'): Provider {
  return { name, translate: vi.fn(async () => `${name}-translation`) }
}

describe('runTranslationPipeline', () => {
  it('produces one TranslationResult per entry per condition (A and B)', async () => {
    const results = await runTranslationPipeline(entries, glossary, {
      anthropic: fakeProvider('anthropic'),
      openai: fakeProvider('openai'),
    })
    expect(results).toHaveLength(2)
    expect(results.map((r) => r.condition).sort()).toEqual(['A', 'B'])
    expect(results.every((r) => r.corpusEntryId === 'entry-a')).toBe(true)
    expect(results.every((r) => r.error === null)).toBe(true)
  })

  it('captures a provider error without throwing, leaving text empty', async () => {
    const failingProvider: Provider = {
      name: 'anthropic',
      translate: vi.fn(async () => {
        throw new Error('rate limited')
      }),
    }
    const results = await runTranslationPipeline(entries, glossary, {
      anthropic: failingProvider,
      openai: fakeProvider('openai'),
    })
    const failed = results.find((r) => r.provider === 'anthropic')
    expect(failed?.error).toBe('rate limited')
    expect(failed?.text).toBe('')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('routes every call through anthropic when EVAL_FORCE_PROVIDER=anthropic is set', async () => {
    vi.stubEnv('EVAL_FORCE_PROVIDER', 'anthropic')
    const results = await runTranslationPipeline(entries, glossary, {
      anthropic: fakeProvider('anthropic'),
      openai: fakeProvider('openai'),
    })
    expect(results).toHaveLength(2)
    expect(results.every((r) => r.provider === 'anthropic')).toBe(true)
  })
})
