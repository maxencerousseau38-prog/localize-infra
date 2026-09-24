import type { Tone } from '@localize-infra/ui';

/**
 * The one sentence `/locales` was missing.
 *
 * The page reported `Languages 4 · Source strings 2 · Behind 1` — three facts
 * at one weight in a metadata row — and then a list. A reader arrives asking
 * whether their product is current in every language, and the page answered
 * by handing them the arithmetic and letting them do it.
 *
 * ## The order is a priority, not a preference
 *
 * A language waiting on a human outranks a language that is merely behind:
 * being behind is fixed by running again, which is mechanical, while a question
 * cannot be resolved by anything the product can do on its own. So Iris wins
 * whenever a decision is pending — §1.4's reserved meaning, and the only state
 * here that genuinely means *your judgement is required*.
 *
 * Everything below it is read off the same rows, so this adds no query and no
 * stored summary that could disagree with the list beneath it.
 */
export interface CoverageShape {
  translated: number;
  total: number;
  needsDecision: number;
}

export interface CoverageSummary {
  tone: Tone;
  headline: string;
  detail: string;
}

/** A language is behind when the run proposed fewer keys than it extracted. */
export function isBehind(item: CoverageShape): boolean {
  return item.translated < item.total;
}

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

export function summariseCoverage(
  items: readonly CoverageShape[],
): CoverageSummary | null {
  // Nothing to summarise is not a state: the page shows its empty state
  // instead, which names what is missing. Returning a cheerful "0 languages
  // behind" would be a measurement nobody took.
  if (items.length === 0) return null;

  const waiting = items.filter((i) => i.needsDecision > 0);
  const behind = items.filter(isBehind);
  const questions = items.reduce((n, i) => n + i.needsDecision, 0);

  if (waiting.length > 0) {
    /*
     * The behind count rides along when it exists.
     *
     * The priority above means a workspace with both reports only the
     * questions — and the page's metadata row carried `Behind N` beside the
     * band to make up for it, which was the same rows summarised twice at two
     * weights. The band is the page's dominant statement, so it has to be the
     * complete one; the duplicate is gone from the header.
     */
    const also =
      behind.length > 0
        ? ` ${plural(behind.length, 'language is', 'languages are')} also behind.`
        : '';
    return {
      tone: 'ambiguous',
      headline: `${plural(questions, 'question', 'questions')} waiting on you`,
      detail: `Across ${plural(waiting.length, 'language', 'languages')}. Until they are answered, the run that raised them cannot be approved.${also}`,
    };
  }

  if (behind.length > 0) {
    return {
      tone: 'degraded',
      headline: `${plural(behind.length, 'language is', 'languages are')} behind`,
      detail: `The last run proposed fewer strings than it extracted for ${behind.length === 1 ? 'it' : 'them'}. Running again attempts only what is still missing.`,
    };
  }

  return {
    tone: 'confident',
    headline:
      items.length === 1
        ? 'The one target language is current'
        : `All ${items.length} languages are current`,
    detail:
      'Every string the last run extracted has a proposed translation in every target language.',
  };
}
