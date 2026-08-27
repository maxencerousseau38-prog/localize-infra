import {
  isIcuMessage,
  placeholdersIntact,
  validateIcu,
} from '@localize-infra/eval';

/**
 * The deterministic checks, run against what a run is about to commit.
 *
 * These checks already existed, were already tested, and were already gated in
 * CI at 99.5% — and they ran nowhere near the product. `packages/eval` imported
 * them, `apps/api/eval/run.ts` imported them, and the path that opens a real
 * pull request in somebody's repository did not. A run could therefore commit a
 * translation whose `%{count}` had become `%{compte}` and open the pull request
 * with a clean description.
 *
 * `packages/eval/src/index.ts` says in its own header that it was given an
 * entry point because "the first consumer outside this package had nowhere to
 * import from". This is that consumer.
 *
 * Nothing is re-implemented here. This composes the existing checks over the
 * shape a run actually produces, and decides which failures may reach a
 * repository.
 */

/** A check that a specific string failed, in terms a developer can act on. */
export interface QualityFinding {
  locale: string;
  key: string;
  /** Which check refused it. */
  check: 'placeholders' | 'icu';
  /** What was wrong, naming the source and the proposal. */
  detail: string;
}

export interface QualityReport {
  /** Strings examined, across every locale. */
  checked: number;
  findings: QualityFinding[];
  /** True when nothing was found. The pull request is gated on this. */
  passed: boolean;
}

export interface LocaleProposal {
  locale: string;
  /** The full merged file this run would commit, key to text. */
  entries: Record<string, string>;
}

/**
 * Check every proposed translation against its source string.
 *
 * Two checks, both deterministic and both already the subject of a CI gate:
 *
 *   **placeholders** — every `%s`, `{{name}}`, `{count}` in the source must
 *   survive into the translation, unaltered. A lost or renamed placeholder is
 *   not a style disagreement, it is a string that will throw or print a token
 *   at a user.
 *
 *   **ICU** — a source that is an ICU message must translate to a parseable ICU
 *   message. A malformed one breaks at format time rather than at review time.
 *
 * Deliberately *not* checked here: whether the translation is any good. chrF
 * and glossary consistency need a reference translation, which a real
 * repository does not have — they belong to the eval harness, where there is
 * one. A check that cannot run on real input does not belong on this path.
 *
 * A key with no source text is skipped rather than failed: it means the catalog
 * and the locale file disagree, which the merge step owns and which would
 * produce a confusing finding here.
 */
export function checkTranslations(
  source: Record<string, string>,
  proposals: readonly LocaleProposal[],
): QualityReport {
  const findings: QualityFinding[] = [];
  let checked = 0;

  for (const proposal of proposals) {
    for (const [key, translated] of Object.entries(proposal.entries)) {
      const original = source[key];
      if (original === undefined) continue;

      checked += 1;

      if (!placeholdersIntact(original, translated)) {
        findings.push({
          locale: proposal.locale,
          key,
          check: 'placeholders',
          detail: `placeholders differ — source ${JSON.stringify(original)} against ${JSON.stringify(translated)}`,
        });
      }

      /*
       * Only when the source is ICU. Running the ICU parser over an ordinary
       * string would reject perfectly good translations containing a brace,
       * and a false failure here blocks a pull request somebody was waiting
       * for.
       */
      if (isIcuMessage(original) && !validateIcu(translated)) {
        findings.push({
          locale: proposal.locale,
          key,
          check: 'icu',
          detail: `ICU message did not parse — ${JSON.stringify(translated)}`,
        });
      }
    }
  }

  return { checked, findings, passed: findings.length === 0 };
}

/**
 * The report as one line for a run's failure message, and as a block for a
 * pull request body.
 *
 * Capped at five findings. A run that broke two hundred strings has one
 * problem, not two hundred, and a failure message nobody reads to the end is a
 * failure message that did not explain anything.
 */
export function describeFindings(report: QualityReport, limit = 5): string {
  if (report.passed) return '';
  const shown = report.findings.slice(0, limit);
  const lines = shown.map(
    (f) => `${f.locale} · ${f.key} · ${f.check}: ${f.detail}`,
  );
  const remaining = report.findings.length - shown.length;
  if (remaining > 0) lines.push(`…and ${remaining} more`);
  return lines.join('\n');
}
