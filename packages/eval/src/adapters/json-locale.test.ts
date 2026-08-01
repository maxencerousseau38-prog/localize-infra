import { describe, expect, it } from 'vitest';
import { extractJsonLocaleStrings, flattenLocaleJson } from './json-locale.js';

describe('flattenLocaleJson', () => {
  it('flattens one level of nesting into dot-path keys, matching excalidraw locale files', () => {
    const input = { labels: { paste: 'Paste', copy: 'Copy' } };
    expect(flattenLocaleJson(input)).toEqual(
      new Map([
        ['labels.paste', 'Paste'],
        ['labels.copy', 'Copy'],
      ]),
    );
  });

  it('keeps flat dot-containing keys as-is, matching gitea locale files', () => {
    const input = {
      home_title: 'Home',
      'form.password_lowercase_one': 'lowercase letter',
    };
    expect(flattenLocaleJson(input)).toEqual(
      new Map([
        ['home_title', 'Home'],
        ['form.password_lowercase_one', 'lowercase letter'],
      ]),
    );
  });

  it('skips empty-string leaves (untranslated entries)', () => {
    const input = { labels: { chartType_bar: '' } };
    expect(flattenLocaleJson(input)).toEqual(new Map());
  });

  it('skips non-string leaves', () => {
    const input = { count: 5, nested: { flag: true } };
    expect(flattenLocaleJson(input)).toEqual(new Map());
  });
});

describe('extractJsonLocaleStrings', () => {
  it('pairs source and target strings by key, dropping keys missing in either file', () => {
    const source = {
      labels: { paste: 'Paste', copy: 'Copy', onlyInSource: 'X' },
    };
    const target = {
      labels: { paste: 'Einfügen', copy: 'Kopieren', onlyInTarget: 'Y' },
    };
    expect(extractJsonLocaleStrings(source, target)).toEqual([
      { key: 'labels.paste', sourceText: 'Paste', humanReference: 'Einfügen' },
      { key: 'labels.copy', sourceText: 'Copy', humanReference: 'Kopieren' },
    ]);
  });
});
