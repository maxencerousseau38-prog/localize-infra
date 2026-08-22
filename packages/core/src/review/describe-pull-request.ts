export interface ApprovedRunSummary {
  /** Target locales the run wrote, in the order the project lists them. */
  locales: string[];
  /** Distinct source strings the run extracted. */
  keyCount: number;
  /** What framework detection found, when it found something. */
  framework: string | null;
  /** One entry per question the run raised. */
  decisions: { state: string; resolvedText: string | null }[];
}

export interface PullRequestDescription {
  title: string;
  body: string;
}

/**
 * The title and body for a pull request a person approved.
 *
 * This exists because it was **missing**, not because it needed refining. The
 * approval path posted `owner`, `repo`, `baseBranch` and `files` to
 * `/v1/open-pr` and no `title` or `body`, both of which the request schema
 * requires — so approving a run answered 400 Bad Request and marked the run
 * failed. The review gate, which is the product's differentiator, could not
 * open a pull request at all.
 *
 * Nothing caught it because the two paths diverged: `run-actions.ts` builds its
 * own title and body inline and works, and the e2e tests exercise the review
 * screen against seeded rows without ever calling the API. It took an actual
 * end-to-end run to surface — the run that produced this file.
 *
 * Pure and here rather than inline in the server action so that it is testable
 * in CI, which is the other half of why the bug survived.
 *
 * The body names the human decisions. A reviewer opening this pull request is
 * being asked to trust wording that a person already adjudicated, and that is
 * the fact most worth telling them — it is the difference between this and a
 * machine translation dropped into their repository.
 */
export function describeApprovedPullRequest(
  summary: ApprovedRunSummary,
): PullRequestDescription {
  const { locales, keyCount, framework, decisions } = summary;

  // Deliberately the same shape as the unattended path in run-actions.ts. Two
  // wordings for the same artefact would read as two different products.
  const title = `Add translations (${locales.join(', ')})`;

  const answered = decisions.filter((d) => d.state === 'resolved').length;
  const overridden = decisions.filter(
    (d) => d.state === 'resolved' && d.resolvedText !== null,
  ).length;
  const dismissed = decisions.filter((d) => d.state === 'dismissed').length;

  const lines = [
    `Extracted ${keyCount} string${keyCount === 1 ? '' : 's'}${
      framework ? ` from ${framework}` : ''
    }, translated into ${locales.length} locale${
      locales.length === 1 ? '' : 's'
    }.`,
  ];

  if (answered + dismissed === 0) {
    // Worth saying rather than leaving blank: a run that asked nothing is a
    // different claim from a run whose questions were skipped.
    lines.push('', 'The agent raised no questions on this run.');
  } else {
    lines.push('', 'A person reviewed this before it was opened:');
    if (answered > 0) {
      lines.push(
        `- ${answered} question${answered === 1 ? '' : 's'} answered${
          overridden > 0
            ? `, ${overridden} of them by choosing wording other than the suggestion`
            : ''
        }.`,
      );
    }
    if (dismissed > 0) {
      lines.push(
        `- ${dismissed} question${dismissed === 1 ? '' : 's'} dismissed, keeping the suggested wording.`,
      );
    }
  }

  return { title, body: lines.join('\n') };
}
