import { describe, expect, it } from 'vitest';
import {
  type RepoSnapshot,
  detectLocales,
  detectLocalizationSignals,
  looksLocalized,
} from './signals.js';

const snapshot = (over: Partial<RepoSnapshot> = {}): RepoSnapshot => ({
  paths: [],
  dependencies: [],
  ...over,
});

const labels = (s: RepoSnapshot) =>
  detectLocalizationSignals(s).map((x) => x.label);

describe('detectLocales', () => {
  it('reads a locale from a filename', () => {
    expect(
      detectLocales(['locales/fr.json', 'locales/de.json', 'locales/en.json']),
    ).toEqual(['de', 'en', 'fr']);
  });

  it('reads a locale from a directory', () => {
    expect(
      detectLocales(['src/i18n/pt-BR/common.json', 'src/i18n/ja/common.json']),
    ).toEqual(['ja', 'pt-BR']);
  });

  it('normalises an underscore tag to a hyphen', () => {
    expect(detectLocales(['locale/en_GB/LC_MESSAGES/app.po'])).toEqual([
      'en-GB',
    ]);
  });

  it('accepts a script subtag', () => {
    expect(detectLocales(['messages/zh-Hans.json'])).toEqual(['zh-Hans']);
  });

  /*
   * The false positive that matters most.
   *
   * A file called `de.json` in `src/config` is a German config, not a German
   * translation. Counting it would put a locale count in front of a
   * salesperson that the repository does not support — the exact shape of
   * claim this system exists not to make.
   */
  it('ignores a locale-looking name outside a localisation directory', () => {
    expect(detectLocales(['src/config/de.json', 'api/fr.ts'])).toEqual([]);
  });

  it('does not mistake short directory names for languages', () => {
    expect(detectLocales(['locales/src/x.json', 'locales/api/y.json'])).toEqual(
      [],
    );
  });

  it('does not count the localisation directory itself as a locale', () => {
    expect(detectLocales(['i18n/messages/fr.json'])).toEqual(['fr']);
  });

  it('counts a locale once however many files it has', () => {
    expect(
      detectLocales([
        'locales/fr/common.json',
        'locales/fr/errors.json',
        'locales/fr/nav.json',
      ]),
    ).toEqual(['fr']);
  });

  it('finds nothing in a repository that has none', () => {
    expect(detectLocales(['src/index.ts', 'README.md'])).toEqual([]);
  });
});

describe('detectLocalizationSignals', () => {
  it('reads a library straight from the manifest', () => {
    const signals = detectLocalizationSignals(
      snapshot({ dependencies: ['next-intl', 'react'] }),
    );
    expect(signals).toHaveLength(1);
    expect(signals[0]?.label).toBe('next-intl');
    // Null, not a number: the dependency is in the manifest or it is not.
    expect(signals[0]?.confidence).toBeNull();
  });

  /*
   * Exact match, not substring. `eslint-plugin-i18next` is a linting choice,
   * not a localisation stack, and a company chosen for it would be a company
   * chosen for nothing.
   */
  it('does not match a library name inside a longer package name', () => {
    expect(
      labels(snapshot({ dependencies: ['eslint-plugin-i18next'] })),
    ).toEqual([]);
  });

  it('reports a locale directory with the paths that prove it', () => {
    const signals = detectLocalizationSignals(
      snapshot({ paths: ['locales/fr.json', 'locales/de.json'] }),
    );
    const directory = signals.find((s) => s.label === 'locale_directory');
    expect(directory?.paths.length).toBeGreaterThan(0);
    expect(directory?.summary).toContain('locales');
  });

  it('reports translation file formats', () => {
    const signals = detectLocalizationSignals(
      snapshot({ paths: ['po/fr.po', 'po/de.po', 'templates/app.pot'] }),
    );
    expect(signals.map((s) => s.label)).toContain('format.po');
    expect(signals.map((s) => s.label)).toContain('format.pot');
  });

  /*
   * The locale count is the one inference here, and it carries a confidence
   * because of it. Everything else is read directly and carries null. Storing
   * a certainty and a guess as the same kind of thing is what makes a score
   * unarguable later.
   */
  it('attaches a confidence to the locale count and to nothing else', () => {
    const signals = detectLocalizationSignals(
      snapshot({
        dependencies: ['i18next'],
        paths: ['locales/fr.json', 'locales/de.json'],
      }),
    );
    for (const signal of signals) {
      if (signal.label === 'locale_count') {
        expect(signal.confidence).toBeGreaterThan(0);
      } else {
        expect(signal.confidence).toBeNull();
      }
    }
  });

  it('is more confident about many locales than about two', () => {
    const two = detectLocalizationSignals(
      snapshot({ paths: ['locales/fr.json', 'locales/de.json'] }),
    ).find((s) => s.label === 'locale_count');
    const many = detectLocalizationSignals(
      snapshot({
        paths: [
          'locales/fr.json',
          'locales/de.json',
          'locales/ja.json',
          'locales/es.json',
          'locales/it.json',
        ],
      }),
    ).find((s) => s.label === 'locale_count');
    expect(many?.confidence as number).toBeGreaterThan(
      two?.confidence as number,
    );
  });

  it('finds nothing in a repository with no localisation at all', () => {
    expect(
      labels(
        snapshot({
          paths: ['src/index.ts', 'README.md', 'package.json'],
          dependencies: ['react', 'next'],
        }),
      ),
    ).toEqual([]);
  });

  it('carries a source for every claim it makes', () => {
    const signals = detectLocalizationSignals(
      snapshot({
        dependencies: ['vue-i18n'],
        paths: ['src/locales/fr.json', 'src/locales/de.json'],
      }),
    );
    expect(signals.length).toBeGreaterThan(0);
    for (const signal of signals) {
      // Either the dependency names itself, or paths back it up.
      const traceable = signal.paths.length > 0 || signal.label === 'vue-i18n';
      expect(traceable || signal.label === 'locale_count').toBe(true);
      expect(signal.summary.trim()).not.toBe('');
    }
  });
});

describe('looksLocalized', () => {
  /*
   * The bar exists so discovery does not produce a list nobody can act on.
   * One stray file in a vendored dependency is not a prospect.
   */
  it('rejects a single weak signal', () => {
    const signals = detectLocalizationSignals(
      snapshot({ paths: ['vendor/pkg/en.strings'] }),
    );
    expect(looksLocalized(signals)).toBe(false);
  });

  /*
   * Disproved by running it. Searching GitHub for `next-intl` and then
   * accepting any repository that depends on `next-intl` is circular: the first
   * real run kept a tutorial carrying the library and not one locale file.
   */
  it('rejects a library with nothing localised alongside it', () => {
    expect(
      looksLocalized(
        detectLocalizationSignals(snapshot({ dependencies: ['i18next'] })),
      ),
    ).toBe(false);
  });

  it('accepts a library once there are locale files with it', () => {
    expect(
      looksLocalized(
        detectLocalizationSignals(
          snapshot({
            dependencies: ['i18next'],
            paths: ['locales/fr.json', 'locales/de.json'],
          }),
        ),
      ),
    ).toBe(true);
  });

  it('accepts two independent signals without a library', () => {
    expect(
      looksLocalized(
        detectLocalizationSignals(
          snapshot({ paths: ['locales/fr.po', 'locales/de.po'] }),
        ),
      ),
    ).toBe(true);
  });

  it('rejects an empty repository', () => {
    expect(looksLocalized(detectLocalizationSignals(snapshot()))).toBe(false);
  });
});
