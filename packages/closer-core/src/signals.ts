/**
 * Reading a repository for signs that somebody is doing localisation.
 *
 * Pure, over a snapshot somebody else fetched, because this is the part that
 * has to be arguable. Every claim it makes carries the paths or the dependency
 * that produced it, so a person can open the repository and check — and because
 * `closer_evidence` refuses a row without a source, a detector that cannot say
 * where it looked cannot record anything.
 *
 * **A signal is not a problem, and this file only finds signals.** i18next in a
 * manifest says a team localises; it says nothing about whether that hurts.
 * Pain needs history — repeated translation commits, stale locales, issues
 * about it — over different inputs. Collapsing the two is how a prospecting
 * system ends up telling a company it has a problem it does not have.
 */

export interface RepoSnapshot {
  /** Every path in the tree, as GitHub returns them. */
  paths: readonly string[];
  /** Dependency names from every manifest found, deduplicated. */
  dependencies: readonly string[];
}

export interface DetectedSignal {
  /** Machine label, stored as `closer_evidence.label`. */
  label: string;
  /** What was observed, in words a reader can check against the source. */
  summary: string;
  /**
   * Null when the fact was read directly — a dependency is in the manifest or
   * it is not — and a number when something was inferred from a pattern.
   * Mirrors `closer_evidence.confidence`, which is nullable for the same
   * reason: a certainty and a guess must not be stored as the same kind of
   * thing.
   */
  confidence: number | null;
  /** The paths that support it. Empty when the evidence is a dependency. */
  paths: string[];
}

/**
 * Libraries whose presence means localisation, by ecosystem.
 *
 * Matched exactly rather than by substring: `i18next` must not be found inside
 * `eslint-plugin-i18next`, which is a linting choice rather than a localisation
 * stack.
 */
const LIBRARIES: Record<string, string> = {
  i18next: 'i18next',
  'react-i18next': 'i18next, in React',
  'next-i18next': 'i18next, in Next.js',
  'next-intl': 'next-intl',
  'react-intl': 'FormatJS (react-intl)',
  '@formatjs/intl': 'FormatJS',
  'vue-i18n': 'vue-i18n',
  '@lingui/core': 'Lingui',
  'svelte-i18n': 'svelte-i18n',
  'react-intl-universal': 'react-intl-universal',
  'angular-translate': 'angular-translate',
  'node-polyglot': 'Polyglot',
  globalize: 'Globalize',
  'i18n-js': 'i18n-js',
};

/** Directory names that exist to hold translations. */
const LOCALE_DIRS = [
  'locales',
  'locale',
  'i18n',
  'translations',
  'translation',
  'messages',
  'lang',
  'langs',
  'localization',
  'localisation',
];

/** File extensions that only appear in a translation workflow. */
const TRANSLATION_FILES: Record<string, string> = {
  '.po': 'gettext PO files',
  '.pot': 'a gettext template',
  '.xliff': 'XLIFF files',
  '.xlf': 'XLIFF files',
  '.arb': 'Flutter ARB files',
  '.strings': 'Apple .strings files',
  '.resx': '.NET RESX files',
};

/**
 * A BCP-47-ish tag, narrowly.
 *
 * `fr`, `pt-BR`, `zh-Hans`, `en_GB`. Deliberately not permissive: a loose
 * pattern matches `src`, `api`, `db` and every other short directory, and a
 * locale count inflated by directory names is the kind of number that looks
 * like research and is noise.
 */
const LOCALE_TAG = /^[a-z]{2,3}(?:[-_](?:[A-Z]{2}|[A-Z][a-z]{3}|\d{3}))?$/;

/** Tags the pattern admits that are almost never a language in a repository. */
const NOT_LOCALES = new Set(['src', 'lib', 'api', 'app', 'www', 'doc', 'bin']);

function segments(path: string): string[] {
  return path.split('/').filter(Boolean);
}

function inLocaleDir(path: string): boolean {
  return segments(path).some((s) => LOCALE_DIRS.includes(s.toLowerCase()));
}

/**
 * The locales a repository appears to ship.
 *
 * Only counted inside a localisation directory. A file called `de.json` in
 * `src/config` is a German config, not a German translation, and counting it
 * would put a number in front of a salesperson that the repository does not
 * support.
 */
export function detectLocales(paths: readonly string[]): string[] {
  const found = new Set<string>();

  for (const path of paths) {
    const parts = segments(path);

    for (const [index, raw] of parts.entries()) {
      /*
       * A locale is the segment that immediately follows a localisation
       * directory, and nothing else.
       *
       * The first version tested every segment against the tag pattern, which
       * read `locales/fr/nav.json` as two languages — French, and a language
       * called "nav". A denylist would never end: `api`, `nav`, `err`, `cta`
       * are all three letters. Position is the rule that terminates, because
       * `locales/<here>` is where a locale actually lives.
       */
      if (!LOCALE_DIRS.includes(raw.toLowerCase())) continue;
      const next = parts[index + 1];
      if (!next) continue;

      // `i18n/messages/fr.json` — a nested localisation directory, not a
      // language. Skipped so the next iteration reaches `fr`.
      if (LOCALE_DIRS.includes(next.replace(/\.[^.]+$/, '').toLowerCase())) {
        continue;
      }

      const candidate = next.replace(/\.[^.]+$/, '');
      if (!candidate || NOT_LOCALES.has(candidate.toLowerCase())) continue;
      if (LOCALE_TAG.test(candidate)) found.add(candidate.replace('_', '-'));
    }
  }

  return [...found].sort();
}

export function detectLocalizationSignals(
  snapshot: RepoSnapshot,
): DetectedSignal[] {
  const signals: DetectedSignal[] = [];
  const paths = snapshot.paths;

  // 1. Libraries. Read directly from a manifest, so no confidence is attached.
  for (const dependency of snapshot.dependencies) {
    const name = LIBRARIES[dependency];
    if (!name) continue;
    signals.push({
      label: dependency,
      summary: `Depends on ${dependency} (${name})`,
      confidence: null,
      paths: [],
    });
  }

  // 2. Directories that exist to hold translations.
  const localeDirPaths = paths.filter(inLocaleDir);
  if (localeDirPaths.length > 0) {
    const names = [
      ...new Set(
        localeDirPaths.flatMap((p) =>
          segments(p).filter((s) => LOCALE_DIRS.includes(s.toLowerCase())),
        ),
      ),
    ].sort();
    signals.push({
      label: 'locale_directory',
      summary: `${localeDirPaths.length} file(s) under ${names.join(', ')}`,
      confidence: null,
      paths: localeDirPaths.slice(0, 5),
    });
  }

  // 3. File formats that only exist in a translation workflow.
  for (const [extension, description] of Object.entries(TRANSLATION_FILES)) {
    const matches = paths.filter((p) => p.toLowerCase().endsWith(extension));
    if (matches.length === 0) continue;
    signals.push({
      label: `format${extension}`,
      summary: `${matches.length} ${description}`,
      confidence: null,
      paths: matches.slice(0, 5),
    });
  }

  /*
   * 4. How many languages, which is the only inference here.
   *
   * Read from filenames rather than from a config the fetcher did not open, so
   * it can be wrong in both directions — a locale added but not yet populated,
   * or one held somewhere this pattern does not look. Recorded with a
   * confidence because of that, where the three above are recorded without one.
   */
  const locales = detectLocales(paths);
  if (locales.length > 0) {
    signals.push({
      label: 'locale_count',
      summary: `${locales.length} locale(s): ${locales.join(', ')}`,
      // Two locales could be a default and one experiment; several laid out the
      // same way is a deliberate matrix and much harder to read wrongly.
      confidence: locales.length >= 4 ? 0.9 : 0.65,
      paths: [],
    });
  }

  return signals;
}

/**
 * Whether there is enough here to call it a localisation stack at all.
 *
 * Two independent signals. Not "a library on its own", which is what the first
 * version accepted and what running it against GitHub disproved: searching for
 * `next-intl` and then accepting any repository that depends on `next-intl` is
 * circular, and it kept a tutorial with the library in its manifest and not one
 * locale file. A dependency is a decision somebody made; locale files are
 * evidence they are living with it.
 *
 * The cost is a false negative — a team using a library with their translations
 * somewhere this does not look is missed. That is the right way round.
 * Discovery is allowed to miss a prospect; it is not allowed to fill the list
 * with repositories nobody should be contacted about.
 */
export function looksLocalized(signals: readonly DetectedSignal[]): boolean {
  return signals.length >= 2;
}
