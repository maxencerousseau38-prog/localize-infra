import { describe, expect, it } from 'vitest';
import { parseTranslationResponse } from './parse-response.js';

describe('parseTranslationResponse', () => {
  it('parses a clean JSON array response', () => {
    const raw = '[{"key":"a","text":"Hallo"},{"key":"b","text":"Welt"}]';
    expect(parseTranslationResponse(raw)).toEqual([
      { key: 'a', text: 'Hallo', confidence: 'confident', question: null, alternatives: [] },
      { key: 'b', text: 'Welt', confidence: 'confident', question: null, alternatives: [] },
    ]);
  });

  it('extracts a JSON array wrapped in a markdown code fence', () => {
    const raw = '```json\n[{"key":"a","text":"Hallo"}]\n```';
    expect(parseTranslationResponse(raw)).toEqual([
      { key: 'a', text: 'Hallo', confidence: 'confident', question: null, alternatives: [] },
    ]);
  });

  it('throws a clear error when no JSON array is present', () => {
    expect(() =>
      parseTranslationResponse('Sorry, I cannot help with that.'),
    ).toThrow('No JSON array found in model response');
  });

  it('throws a clear error when an array item is missing key or text', () => {
    expect(() => parseTranslationResponse('[{"key":"a"}]')).toThrow(
      /is invalid/,
    );
  });
});

describe('parseTranslationResponse — confidence', () => {
  it('defaults an older two-field reply to confident', () => {
    const [entry] = parseTranslationResponse(
      '[{"key":"a","text":"Hallo"}]',
    ) as [ReturnType<typeof parseTranslationResponse>[number]];
    expect(entry.confidence).toBe('confident');
    expect(entry.question).toBeNull();
    expect(entry.alternatives).toEqual([]);
  });

  it('carries an escalation through with its question and alternatives', () => {
    const [entry] = parseTranslationResponse(
      JSON.stringify([
        {
          key: 'nav.home',
          text: 'Startseite',
          confidence: 'ambiguous',
          question: 'Is "Home" the landing page or a dwelling?',
          alternatives: [
            { text: 'Startseite', rationale: 'The landing page' },
            { text: 'Zuhause', rationale: 'A dwelling' },
          ],
        },
      ]),
    );
    expect(entry?.confidence).toBe('ambiguous');
    expect(entry?.question).toMatch(/landing page/);
    expect(entry?.alternatives).toHaveLength(2);
  });

  it('refuses an escalation with no question', () => {
    // The model saying "I am unsure" without saying what about produces an
    // interruption a developer cannot answer. Rejected at the edge.
    expect(() =>
      parseTranslationResponse(
        '[{"key":"a","text":"Hallo","confidence":"ambiguous"}]',
      ),
    ).toThrow(/is invalid/);
  });

  it('names the offending index and field', () => {
    expect(() =>
      parseTranslationResponse(
        '[{"key":"a","text":"ok"},{"key":"b","text":"x","confidence":"ambiguous"}]',
      ),
    ).toThrow(/index 1/);
  });
});
