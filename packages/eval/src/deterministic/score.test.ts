import type {
  CorpusEntry,
  GlossaryEntry,
  TranslationResult,
} from '@localize-infra/schemas';
import { describe, expect, it } from 'vitest';
import { scoreTranslation } from './score.js';

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
  sourceText: 'Delete {{count}} item(s) from GitHub?',
  targetLocale: 'de',
  humanReference: '{{count}} Element(e) von GitHub löschen?',
  maxLength: 60,
};

const glossary: GlossaryEntry[] = [
  { term: 'GitHub', translations: { de: 'GitHub' } },
];

function result(overrides: Partial<TranslationResult>): TranslationResult {
  return {
    corpusEntryId: 'x',
    condition: 'B',
    targetLocale: 'de',
    provider: 'anthropic',
    modelId: 'claude-sonnet-5',
    text: '{{count}} Element(e) von GitHub löschen?',
    error: null,
    ...overrides,
  };
}

describe('scoreTranslation', () => {
  it('scores a clean translation as fully passing with no plural/ICU applicable', () => {
    expect(scoreTranslation(entry, result({}), glossary)).toEqual({
      corpusEntryId: 'x',
      condition: 'B',
      placeholderIntact: true,
      icuValid: true,
      pluralCategoriesCorrect: null,
      lengthOverflow: false,
      glossaryHits: [{ term: 'GitHub', respected: true }],
    });
  });

  it('flags a dropped placeholder', () => {
    const score = scoreTranslation(
      entry,
      result({ text: 'Element von GitHub löschen?' }),
      glossary,
    );
    expect(score.placeholderIntact).toBe(false);
  });

  it('flags a length overflow against the entry maxLength', () => {
    const score = scoreTranslation(
      entry,
      result({ text: `${'{{count}} '.repeat(20)}GitHub` }),
      glossary,
    );
    expect(score.lengthOverflow).toBe(true);
  });
});
