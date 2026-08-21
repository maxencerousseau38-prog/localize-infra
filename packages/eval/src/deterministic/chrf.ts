/**
 * chrF — character n-gram F-score, against the corpus's human references.
 *
 * Popović (2015), "chrF: character n-gram F-score for automatic MT
 * evaluation". A standard, published metric, implemented here rather than
 * invented: β=2 and n=1..6 are the paper's defaults and the ones sacrebleu
 * ships as `chrF2`.
 *
 * **Read what this measures before trusting it.** chrF scores surface overlap
 * with one reference translation. A different but perfectly good translation
 * scores low, and a clumsy translation that happens to share characters scores
 * high. It is not a quality judgement and it is not a substitute for the human
 * evaluation `docs/product/08-critique.md` §C2 records as never having run.
 *
 * What it is good for is exactly the question being asked of it here:
 * **comparing configurations against the same references**. Whatever bias chrF
 * has, it applies equally to every model scored on the same corpus, so the
 * ordering between them carries information even where the absolute number
 * does not. Report the delta, distrust the level.
 */

const MAX_N = 6;
const BETA = 2;

/**
 * Whitespace is removed before n-gramming, per the reference implementation.
 * Otherwise the metric mostly measures how a language spaces its words — which
 * would make Japanese, which does not space at all, incomparable to German.
 */
function normalise(text: string): string {
  return text.replace(/\s+/g, '');
}

function ngramCounts(text: string, n: number): Map<string, number> {
  const counts = new Map<string, number>();
  // Spread rather than index: astral characters (emoji, some CJK) are two code
  // units, and slicing by index would cut them in half and count mojibake.
  const chars = [...text];
  for (let i = 0; i + n <= chars.length; i += 1) {
    const gram = chars.slice(i, i + n).join('');
    counts.set(gram, (counts.get(gram) ?? 0) + 1);
  }
  return counts;
}

function overlap(a: Map<string, number>, b: Map<string, number>): number {
  let total = 0;
  for (const [gram, count] of a) {
    const other = b.get(gram);
    if (other) total += Math.min(count, other);
  }
  return total;
}

export interface ChrfScore {
  /** 0–100, higher is closer to the reference. */
  score: number;
  precision: number;
  recall: number;
}

export function chrf(hypothesis: string, reference: string): ChrfScore {
  const hyp = normalise(hypothesis);
  const ref = normalise(reference);

  // Two empty strings are identical; one empty and one not shares nothing.
  if (hyp.length === 0 && ref.length === 0) {
    return { score: 100, precision: 1, recall: 1 };
  }
  if (hyp.length === 0 || ref.length === 0) {
    return { score: 0, precision: 0, recall: 0 };
  }

  const precisions: number[] = [];
  const recalls: number[] = [];

  for (let n = 1; n <= MAX_N; n += 1) {
    const hypGrams = ngramCounts(hyp, n);
    const refGrams = ngramCounts(ref, n);

    const hypTotal = [...hypGrams.values()].reduce((a, b) => a + b, 0);
    const refTotal = [...refGrams.values()].reduce((a, b) => a + b, 0);

    // An order longer than the string yields no n-grams at all. Skipping it
    // rather than scoring it zero keeps short strings — which is most UI copy —
    // from being penalised for being short.
    if (hypTotal === 0 || refTotal === 0) continue;

    const matched = overlap(hypGrams, refGrams);
    precisions.push(matched / hypTotal);
    recalls.push(matched / refTotal);
  }

  if (precisions.length === 0) return { score: 0, precision: 0, recall: 0 };

  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const precision = mean(precisions);
  const recall = mean(recalls);

  if (precision === 0 && recall === 0) {
    return { score: 0, precision: 0, recall: 0 };
  }

  const beta2 = BETA * BETA;
  const f = ((1 + beta2) * precision * recall) / (beta2 * precision + recall);
  return { score: f * 100, precision, recall };
}

/**
 * Exact agreement with the reference, after trimming.
 *
 * Reported alongside chrF because it is the one number with no interpretation
 * attached: either the model produced the same string a human did, or it did
 * not. On UI copy — short, conventional, often a single word — agreement is
 * more common than it would be on prose, which makes it worth counting.
 */
export function exactMatch(hypothesis: string, reference: string): boolean {
  return hypothesis.trim() === reference.trim();
}
