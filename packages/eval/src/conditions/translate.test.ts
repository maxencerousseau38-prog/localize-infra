import type { CorpusEntry, GlossaryEntry } from '@localize-infra/schemas';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Provider } from '../router/types.js';
import { runTranslationPipeline } from './translate.js';

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
];

const glossary: GlossaryEntry[] = [];

function fakeProvider(name: 'anthropic' | 'openai'): Provider {
  return { name, translate: vi.fn(async () => `${name}-translation`) };
}

describe('runTranslationPipeline', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('produces one TranslationResult per entry per condition (A and B)', async () => {
    const results = await runTranslationPipeline(entries, glossary, {
      anthropic: fakeProvider('anthropic'),
      openai: fakeProvider('openai'),
    });
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.condition).sort()).toEqual(['A', 'B']);
    expect(results.every((r) => r.corpusEntryId === 'entry-a')).toBe(true);
    expect(results.every((r) => r.error === null)).toBe(true);
  });

  it('captures a provider error without throwing, leaving text empty', async () => {
    const failingProvider: Provider = {
      name: 'anthropic',
      translate: vi.fn(async () => {
        throw new Error('rate limited');
      }),
    };
    const results = await runTranslationPipeline(entries, glossary, {
      anthropic: failingProvider,
      openai: fakeProvider('openai'),
    });
    const failed = results.find((r) => r.provider === 'anthropic');
    expect(failed?.error).toBe('rate limited');
    expect(failed?.text).toBe('');
  });

  it('routes every call through anthropic when EVAL_FORCE_PROVIDER=anthropic is set', async () => {
    vi.stubEnv('EVAL_FORCE_PROVIDER', 'anthropic');
    const results = await runTranslationPipeline(entries, glossary, {
      anthropic: fakeProvider('anthropic'),
      openai: fakeProvider('openai'),
    });
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.provider === 'anthropic')).toBe(true);
  });

  it('skips entry/condition pairs already present in alreadyCompleted, without calling the provider', async () => {
    const anthropic = fakeProvider('anthropic');
    const openai = fakeProvider('openai');
    const results = await runTranslationPipeline(
      entries,
      glossary,
      { anthropic, openai },
      { alreadyCompleted: new Set(['entry-a:A']) },
    );
    expect(results).toHaveLength(1);
    expect(results[0]?.condition).toBe('B');
    expect(anthropic.translate).not.toHaveBeenCalled();
  });

  it('invokes onResult once per produced result, in order, as this is what main() checkpoints on', async () => {
    const seen: string[] = [];
    const results = await runTranslationPipeline(
      entries,
      glossary,
      { anthropic: fakeProvider('anthropic'), openai: fakeProvider('openai') },
      {
        onResult: (result) => {
          seen.push(`${result.corpusEntryId}:${result.condition}`);
        },
      },
    );
    expect(seen).toEqual(['entry-a:A', 'entry-a:B']);
    expect(results.map((r) => `${r.corpusEntryId}:${r.condition}`)).toEqual(
      seen,
    );
  });
});
