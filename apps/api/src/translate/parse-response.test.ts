import { describe, expect, it } from 'vitest';
import { parseTranslationResponse } from './parse-response.js';

describe('parseTranslationResponse', () => {
  it('parses a clean JSON array response', () => {
    const raw = '[{"key":"a","text":"Hallo"},{"key":"b","text":"Welt"}]';
    expect(parseTranslationResponse(raw)).toEqual([
      { key: 'a', text: 'Hallo' },
      { key: 'b', text: 'Welt' },
    ]);
  });

  it('extracts a JSON array wrapped in a markdown code fence', () => {
    const raw = '```json\n[{"key":"a","text":"Hallo"}]\n```';
    expect(parseTranslationResponse(raw)).toEqual([
      { key: 'a', text: 'Hallo' },
    ]);
  });

  it('throws a clear error when no JSON array is present', () => {
    expect(() =>
      parseTranslationResponse('Sorry, I cannot help with that.'),
    ).toThrow('No JSON array found in model response');
  });

  it('throws a clear error when an array item is missing key or text', () => {
    expect(() => parseTranslationResponse('[{"key":"a"}]')).toThrow(
      'missing key or text',
    );
  });
});
