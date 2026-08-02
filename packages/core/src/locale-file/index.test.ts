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
});
