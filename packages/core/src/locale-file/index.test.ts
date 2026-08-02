import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildKeyCatalog,
  mergeLocaleFile,
  readLocaleFile,
  writeLocaleFile,
} from './index.js';

let localesDir: string;

beforeEach(() => {
  localesDir = mkdtempSync(join(tmpdir(), 'core-locale-file-'));
});

afterEach(() => {
  rmSync(localesDir, { recursive: true, force: true });
});

describe('buildKeyCatalog', () => {
  it('builds a key -> text record from extracted entries', () => {
    expect(
      buildKeyCatalog([
        { key: 'a.b', text: 'Hello' },
        { key: 'c.d', text: 'World' },
      ]),
    ).toEqual({
      'a.b': 'Hello',
      'c.d': 'World',
    });
  });

  it('disambiguates a key collision between two DIFFERENT texts with a numeric suffix', () => {
    const catalog = buildKeyCatalog([
      { key: 'a.b', text: 'First distinct string' },
      { key: 'a.b', text: 'Second distinct string' },
    ]);
    expect(catalog).toEqual({
      'a.b': 'First distinct string',
      'a.b_2': 'Second distinct string',
    });
  });

  it('collapses two entries with the same key AND the same text into a single entry (no spurious suffix)', () => {
    const catalog = buildKeyCatalog([
      { key: 'a.b', text: 'Same string' },
      { key: 'a.b', text: 'Same string' },
    ]);
    expect(catalog).toEqual({ 'a.b': 'Same string' });
  });
});

describe('readLocaleFile', () => {
  it('returns an empty object when the file does not exist', () => {
    expect(readLocaleFile(localesDir, 'en')).toEqual({});
  });

  it('reads an existing locale file', () => {
    writeFileSync(
      join(localesDir, 'en.json'),
      JSON.stringify({ 'a.b': 'Hello' }),
    );
    expect(readLocaleFile(localesDir, 'en')).toEqual({ 'a.b': 'Hello' });
  });

  it('throws a clear, actionable error (naming the file) when the locale file is malformed JSON', () => {
    const path = join(localesDir, 'en.json');
    writeFileSync(path, '{ this is not valid json');
    let thrown: unknown;
    try {
      readLocaleFile(localesDir, 'en');
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(Error);
    const message = (thrown as Error).message;
    expect(message).toContain(path);
    expect(message).not.toMatch(/^Unexpected token/);
  });
});

describe('mergeLocaleFile', () => {
  it('for the en locale, always uses the freshly extracted text (source of truth)', () => {
    writeFileSync(
      join(localesDir, 'en.json'),
      JSON.stringify({ 'a.b': 'Old text' }),
    );
    const merged = mergeLocaleFile(localesDir, 'en', { 'a.b': 'New text' });
    expect(merged).toEqual({ 'a.b': 'New text' });
  });

  it('for a non-en locale, keeps the existing translated value when the key still exists in fresh', () => {
    writeFileSync(
      join(localesDir, 'de.json'),
      JSON.stringify({ 'a.b': 'Hallo' }),
    );
    const merged = mergeLocaleFile(localesDir, 'de', {
      'a.b': 'Hello (re-extracted, ignored for de)',
    });
    expect(merged).toEqual({ 'a.b': 'Hallo' });
  });

  it('for a non-en locale, adds a new key with the fresh (untranslated) value when no existing translation exists', () => {
    const merged = mergeLocaleFile(localesDir, 'de', {
      'new.key': 'Brand new string',
    });
    expect(merged).toEqual({ 'new.key': 'Brand new string' });
  });

  it('drops keys that no longer appear in the fresh extraction, for both en and non-en locales', () => {
    writeFileSync(
      join(localesDir, 'de.json'),
      JSON.stringify({ 'stale.key': 'Ancien', 'kept.key': 'Gardé' }),
    );
    const merged = mergeLocaleFile(localesDir, 'de', {
      'kept.key': 'Kept (source)',
    });
    expect(merged).toEqual({ 'kept.key': 'Gardé' });
  });
});

describe('writeLocaleFile', () => {
  it('writes a sorted, pretty-printed JSON file with a trailing newline', () => {
    writeLocaleFile(localesDir, 'en', { 'z.key': 'Last', 'a.key': 'First' });
    const raw = readFileSync(join(localesDir, 'en.json'), 'utf-8');
    expect(raw).toBe('{\n  "a.key": "First",\n  "z.key": "Last"\n}\n');
  });

  it('creates the locales directory if it does not exist', () => {
    const nested = join(localesDir, 'nested', 'dir');
    writeLocaleFile(nested, 'en', { 'a.key': 'Hello' });
    expect(readLocaleFile(nested, 'en')).toEqual({ 'a.key': 'Hello' });
  });

  it('sorts mixed-case keys by plain code-unit order, not locale-aware collation (stable across machines)', () => {
    // keyFor() derives keys from file paths with original casing, so PascalCase component
    // filenames are common. locale-aware collation (localeCompare) would sort these
    // case-insensitively and reorder the output non-deterministically across environments;
    // plain code-unit comparison keeps uppercase letters sorting before lowercase, matching
    // ECMAScript's default array sort and giving every machine the same byte-identical output.
    writeLocaleFile(localesDir, 'en', {
      'src.about.title': 'About',
      'src.App.welcome': 'Welcome',
      'src.Zebra.label': 'Zebra',
    });
    const raw = readFileSync(join(localesDir, 'en.json'), 'utf-8');
    expect(raw).toBe(
      '{\n  "src.App.welcome": "Welcome",\n  "src.Zebra.label": "Zebra",\n  "src.about.title": "About"\n}\n',
    );
  });
});
