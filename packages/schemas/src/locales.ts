/**
 * Which languages a project translates into.
 *
 * This existed nowhere. `projects.target_locales` was read in ten places
 * across `apps/web` and written in none: `createProject` inserted
 * `organization_id`, `name`, `slug` and `source_locale`, the column defaulted
 * to `'{}'`, and nothing ever changed it. So every project created through the
 * product had zero target locales, and every run over one iterated its locale
 * loop zero times and ended with "Every target locale failed. Last error:
 * unknown" — a sentence about four failures where none had been attempted.
 *
 * The value is typed by a person, reaches a `join()` for a locale *filename*,
 * and decides how many model calls a run makes. That is three different reasons
 * to normalise it once, here, rather than at each of them.
 */

/** Why a locale list was refused, in words for the person who typed it. */
export class InvalidLocales extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidLocales';
  }
}

/**
 * BCP-47 by shape, not by registry.
 *
 * The same expression the `source_locale` CHECK constraint uses, deliberately:
 * two different ideas of what a locale looks like would let a value pass the
 * form and fail the insert. Validating the actual registry is a bigger job and
 * would reject valid private-use tags; shape is what both layers can agree on.
 */
const LOCALE_SHAPE = /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/;

/**
 * A run makes one model call per locale, inside the request that started it.
 * There is no worker to resume a run that outlives the serverless timeout, so
 * an unbounded list is a promise this product cannot keep. Twenty is generous
 * against the five the CLI defaults to, and it fails with a sentence rather
 * than with a timeout nobody can read.
 */
const MAX_LOCALES = 20;

/**
 * Canonical case, because the locale is also a filename.
 *
 * `pt-BR` and `PT-br` are the same locale to a human and two different files to
 * a case-sensitive filesystem. Language lowercase, script Titlecase, region
 * uppercase — the BCP-47 convention, applied so that a project cannot end up
 * with two entries that differ only in case and two locale files that differ
 * only in case.
 */
function canonicalise(tag: string): string {
  return tag
    .split('-')
    .map((part, index) => {
      if (index === 0) return part.toLowerCase();
      if (part.length === 2) return part.toUpperCase();
      if (part.length === 4) {
        // `charAt` rather than an index plus a non-null assertion: this runs on
        // `sourceLocale` too, which reaches here unchecked.
        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
      }
      return part.toLowerCase();
    })
    .join('-');
}

/**
 * Parse what a person typed into the locales a run will act on.
 *
 * Accepts commas, whitespace or both, because "fr, de" and "fr de" and a
 * pasted column are all things people type. Empty input is not an error: it
 * means a project that translates into nothing yet, which is what every
 * project has today.
 *
 * Throws rather than returning a flag: each refusal has a different sentence to
 * say, and the person reading it is the person who typed the value.
 */
export function parseTargetLocales(
  input: string | null | undefined,
  options: { sourceLocale: string },
): string[] {
  if (input === null || input === undefined) return [];

  const source = canonicalise(options.sourceLocale.trim());
  const seen = new Set<string>();
  const locales: string[] = [];

  for (const raw of input.split(/[,\s]+/)) {
    const tag = raw.trim();
    if (tag === '') continue;

    if (!LOCALE_SHAPE.test(tag)) {
      throw new InvalidLocales(
        `"${tag}" is not a language tag. Use codes like fr, de or pt-BR, separated by commas.`,
      );
    }

    const canonical = canonicalise(tag);

    if (canonical === source) {
      /*
       * The source is where the strings come from. A run treats every target
       * as a file to write, so keeping the source here would have the pipeline
       * translate English into English and overwrite the catalogue it just
       * extracted.
       */
      throw new InvalidLocales(
        `${canonical} is the source language, so there is nothing to translate into it. Remove it from the target list.`,
      );
    }

    // Silently, because "fr, FR" is a typo with one obvious reading and
    // refusing it would teach nothing.
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    locales.push(canonical);
  }

  if (locales.length > MAX_LOCALES) {
    throw new InvalidLocales(
      `That is ${locales.length} languages. A run translates them one at a time inside a single request, so the limit is ${MAX_LOCALES}.`,
    );
  }

  return locales;
}
