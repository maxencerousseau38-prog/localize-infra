import { describe, expect, it } from 'vitest';
import {
  type DecisionRow,
  type LocaleFile,
  type ProposalRow,
  buildLocaleFiles,
  unresolvedCount,
} from './build-locale-files.js';

const proposal = (locale: string, key: string, text: string): ProposalRow => ({
  locale,
  translation_key: key,
  proposed_text: text,
});

const decision = (
  locale: string,
  key: string,
  state: DecisionRow['state'],
  resolved: string | null,
  proposed: string,
): DecisionRow => ({
  locale,
  translation_key: key,
  state,
  resolved_text: resolved,
  proposed_text: proposed,
});

describe('buildLocaleFiles', () => {
  it('writes one file per locale, under the directory the run recorded', () => {
    const files = buildLocaleFiles(
      [proposal('de', 'a', 'Eins'), proposal('es', 'a', 'Uno')],
      [],
      'locales',
    );

    expect(files.map((f: LocaleFile) => f.path)).toEqual([
      'locales/de.json',
      'locales/es.json',
    ]);
  });

  /*
   * The bug this file exists to prevent. The path used to be a hardcoded
   * 'src/locales' read from a form field, which is wrong for any project
   * detected elsewhere — including the fixture repository the product's own
   * landing page links to, which uses 'locales/'. Approving committed a
   * second, parallel tree rather than updating the real one.
   */
  it('honours a directory that is not the common default', () => {
    const [file] = buildLocaleFiles([proposal('de', 'a', 'Eins')], [], 'i18n');
    expect(file?.path).toBe('i18n/de.json');
  });

  it('does not double the separator when the directory ends in one', () => {
    const [file] = buildLocaleFiles(
      [proposal('de', 'a', 'Eins')],
      [],
      'locales/',
    );
    expect(file?.path).toBe('locales/de.json');
  });

  it('applies a resolution in place of the proposal', () => {
    const [file] = buildLocaleFiles(
      [proposal('de', 'close', 'Nah')],
      [decision('de', 'close', 'resolved', 'Schließen', 'Nah')],
      'locales',
    );

    expect(JSON.parse(file?.content ?? '{}')).toEqual({ close: 'Schließen' });
  });

  /*
   * Dismissing means "your suggestion is fine", not "drop this string". A key
   * that silently lost its translation because nobody wanted to think about it
   * would be the quiet data loss this product exists to avoid.
   */
  it('keeps the model proposal when a question was dismissed', () => {
    const [file] = buildLocaleFiles(
      [proposal('de', 'close', 'Nah')],
      [decision('de', 'close', 'dismissed', null, 'Nah')],
      'locales',
    );

    expect(JSON.parse(file?.content ?? '{}')).toEqual({ close: 'Nah' });
  });

  it('does not let a resolution leak across locales', () => {
    const files = buildLocaleFiles(
      [proposal('de', 'close', 'Nah'), proposal('es', 'close', 'Cerca')],
      [decision('de', 'close', 'resolved', 'Schließen', 'Nah')],
      'locales',
    );

    const es = files.find((f: LocaleFile) => f.path.endsWith('es.json'));
    expect(JSON.parse(es?.content ?? '{}')).toEqual({ close: 'Cerca' });
  });

  /*
   * Byte-stability. This output is committed and diffed, so two machines with
   * different collation must agree — `localeCompare` would order "Ä" against
   * "B" differently per environment and every run would show a diff nobody
   * made. Pinned with keys that actually disagree under the two orderings.
   */
  it('orders keys by code unit, not by locale-aware collation', () => {
    const [file] = buildLocaleFiles(
      [
        proposal('de', 'b', 'B'),
        proposal('de', 'Ä', 'A-umlaut'),
        proposal('de', 'a', 'A'),
      ],
      [],
      'locales',
    );

    expect(Object.keys(JSON.parse(file?.content ?? '{}'))).toEqual([
      'a',
      'b',
      'Ä',
    ]);
  });

  it('ends every file with a newline', () => {
    const [file] = buildLocaleFiles([proposal('de', 'a', 'Eins')], [], 'l');
    expect(file?.content.endsWith('}\n')).toBe(true);
  });

  it('produces nothing when a run recorded nothing', () => {
    expect(buildLocaleFiles([], [], 'locales')).toEqual([]);
  });
});

describe('unresolvedCount', () => {
  it('counts only what nobody has answered', () => {
    expect(
      unresolvedCount([
        decision('de', 'a', 'unresolved', null, 'x'),
        decision('de', 'b', 'resolved', 'y', 'x'),
        decision('de', 'c', 'dismissed', null, 'x'),
        decision('es', 'd', 'unresolved', null, 'x'),
      ]),
    ).toBe(2);
  });
});
