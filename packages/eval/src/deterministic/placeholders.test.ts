import { describe, expect, it } from 'vitest';
import { extractPlaceholders, placeholdersIntact } from './placeholders.js';

describe('extractPlaceholders', () => {
  it('extracts single-brace, double-brace, and printf placeholders', () => {
    expect(
      extractPlaceholders('Hello {name}, you have %d new {{type}}'),
    ).toEqual([
      { syntax: 'doubleBrace', token: '{{type}}' },
      { syntax: 'brace', token: '{name}' },
      { syntax: 'printf', token: '%d' },
    ]);
  });

  it('does not treat ICU control clauses as plain brace placeholders', () => {
    expect(
      extractPlaceholders('{count, plural, one {# item} other {# items}}'),
    ).toEqual([]);
  });
});

describe('placeholdersIntact', () => {
  it('is true when all placeholder tokens are preserved, in any order', () => {
    expect(
      placeholdersIntact(
        'Hi {name}, {{count}} items',
        'Salut {{count}} objets, {name}',
      ),
    ).toBe(true);
  });

  it('is false when a placeholder is dropped', () => {
    expect(placeholdersIntact('Hi {name}', 'Salut')).toBe(false);
  });

  it('is false when a placeholder is duplicated', () => {
    expect(placeholdersIntact('Hi {name}', 'Salut {name} {name}')).toBe(false);
  });
});
