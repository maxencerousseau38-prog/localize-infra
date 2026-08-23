import { z } from 'zod';
import { TARGET_LOCALES } from './eval.js';

/**
 * Ground truth for "does the agent escalate when it should?"
 *
 * Deliberately **not** `CorpusEntrySchema`. That one describes a string
 * harvested from a real open-source project and is scored against a human
 * reference translation, so it requires `sourceRepoUrl`, a 40-character
 * `sourceCommit` and a `humanReference`. None of those exist here and none of
 * them could: these strings are *written* to be ambiguous or written to be
 * clearly not, and what is being measured is not the translation but the
 * decision to ask a question. Forcing them into the translation-quality shape
 * would mean inventing a commit hash and a reference translation, which is
 * exactly the kind of fabricated evidence this corpus exists to avoid.
 *
 * Invariant 4 — the agent raises ambiguities, it does not guess — has had no
 * real measurement. The 414-entry corpus produced 2 escalations, on material
 * that contains nothing ambiguous by construction, so it could report neither
 * precision nor recall.
 */
export const AMBIGUITY_CATEGORIES = [
  /** A word with two genuinely different senses the context does not settle. */
  'polysemy',
  /** Too short to carry gender, number or counter information the target needs. */
  'insufficient-grammar',
  /** Formality undetermined where the target language forces a choice. */
  'register',
] as const;
export type AmbiguityCategory = (typeof AMBIGUITY_CATEGORIES)[number];

export const AmbiguityCaseSchema = z.object({
  id: z.string().min(1),
  /**
   * The pair this case belongs to.
   *
   * Every case has exactly one sibling: same `sourceText`, same locale, same
   * category, differing only in `surroundingCode`. One expects an escalation
   * and the other does not. Scoring a corpus of positives alone cannot
   * distinguish an agent that reads context from one that escalates on
   * everything, and "escalates on everything" is the failure mode the prompt
   * itself warns about — a queue nobody reads.
   */
  pairId: z.string().min(1),
  sourceText: z.string().min(1),
  filePath: z.string().min(1),
  componentName: z.string().nullable(),
  surroundingCode: z.string(),
  targetLocale: z.enum(TARGET_LOCALES),
  category: z.enum(AMBIGUITY_CATEGORIES),
  /** What the agent should do. The whole ground truth. */
  expected: z.enum(['escalate', 'confident']),
  /**
   * Why that is the right answer, in one sentence.
   *
   * Required, and load-bearing rather than documentation: a case whose
   * rationale cannot be written is a case whose ground truth is a guess, and
   * a corpus of guesses measures nothing. It is also what makes a
   * disagreement reviewable — when the agent and the corpus differ, this is
   * the sentence someone has to argue with.
   */
  rationale: z.string().min(1),
});
export type AmbiguityCase = z.infer<typeof AmbiguityCaseSchema>;

export const AmbiguityObservationSchema = z.object({
  caseId: z.string().min(1),
  /** What the model actually returned, or null when the call failed. */
  observed: z.enum(['escalate', 'confident']).nullable(),
  question: z.string().nullable(),
  alternativeCount: z.number().int().nonnegative(),
  error: z.string().nullable(),
});
export type AmbiguityObservation = z.infer<typeof AmbiguityObservationSchema>;
