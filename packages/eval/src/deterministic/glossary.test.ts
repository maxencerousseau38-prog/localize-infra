import type { GlossaryEntry } from '@localize-infra/schemas';
import { describe, expect, it } from 'vitest';
import { checkGlossaryConsistency } from './glossary.js';

const glossary: GlossaryEntry[] = [
  { term: 'GitHub', translations: { de: 'GitHub' } },
];

describe('checkGlossaryConsistency', () => {
  it('marks a term respected when the source contains it and the translation keeps it verbatim', () => {
    expect(
      checkGlossaryConsistency(
        'Sign in with GitHub',
        'Mit GitHub anmelden',
        'de',
        glossary,
      ),
    ).toEqual([{ term: 'GitHub', respected: true }]);
  });

  it('marks a term unrespected when the translation drops it', () => {
    expect(
      checkGlossaryConsistency(
        'Sign in with GitHub',
        'Anmelden',
        'de',
        glossary,
      ),
    ).toEqual([{ term: 'GitHub', respected: false }]);
  });

  it('ignores a glossary term absent from the source text', () => {
    expect(
      checkGlossaryConsistency('Sign in', 'Anmelden', 'de', glossary),
    ).toEqual([]);
  });

  it('ignores a glossary term with no known translation for the locale', () => {
    expect(
      checkGlossaryConsistency(
        'Sign in with GitHub',
        'GitHubでログイン',
        'ja',
        glossary,
      ),
    ).toEqual([]);
  });
});
