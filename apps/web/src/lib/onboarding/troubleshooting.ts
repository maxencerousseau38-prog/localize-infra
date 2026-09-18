/**
 * The refusals a first run actually hits, and what to do about each.
 *
 * ## Why these are keyed by status rather than by message
 *
 * The API's sentences are written to be read in a terminal and they carry
 * interpolated values — a workspace slug, a repository, a wait in seconds.
 * Copying them here would be duplicating prose that is free to drift, and this
 * repository has a long record of a sentence copied between files and then
 * only fixed in one.
 *
 * A status code is a contract. `packages/cli` prints whatever the API said, so
 * the reader already has the exact words; what they do not have is what the
 * words mean for them, which is the only thing this table adds.
 *
 * `onboarding-troubleshooting.test.ts` in `packages/schemas` asserts that every
 * status named here is one `apps/api` can actually return, so an entry for a
 * refusal that no longer exists fails the build rather than misleading a reader.
 */

export interface Refusal {
  /** The HTTP status the API answers with, or 'cli' when the CLI stops first. */
  status: number | 'cli';
  /** What the reader was trying to do when they saw it. */
  situation: string;
  /** What it means. One sentence, no blame. */
  meaning: string;
  /** The action that resolves it. */
  fix: string;
  /** Where in this app to go, when there is somewhere. Relative to /[org]. */
  href?: string;
}

/**
 * Ordered by when a reader meets them, not by status number: a first run fails
 * at the token before it can fail at the repository.
 */
export const REFUSALS: Refusal[] = [
  {
    status: 401,
    situation: 'The CLI says the token is invalid, expired or revoked',
    meaning:
      'The API did not recognise the token. Tokens expire, and revoking one takes effect immediately — including when the person who created it leaves the workspace.',
    fix: 'Issue a new token and set LOCALIZE_API_TOKEN again.',
    href: '/tokens',
  },
  {
    status: 401,
    situation: 'The CLI says personal tokens are not enabled',
    meaning:
      'A different sentence from the one above, and it means the opposite thing: your token is fine, but the API deployment you pointed at cannot resolve personal tokens at all.',
    fix: 'Check --api-url or LOCALIZE_API_URL. A self-hosted API needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before it accepts personal tokens.',
  },
  {
    status: 412,
    situation:
      'The CLI refuses --open-pr because the workspace has no GitHub connection',
    meaning:
      'Translation works without GitHub; opening a pull request does not. This is refused before anything is translated, so it costs nothing.',
    fix: 'Connect GitHub, then run again.',
    href: '/projects',
  },
  {
    status: 403,
    situation: 'The repository is refused, or a private repository is',
    meaning:
      'The installation does not reach that repository. An installation can be granted only some repositories, and private ones additionally need this workspace to be entitled to them.',
    fix: 'Check the installation reaches it — the button above asks GitHub — and select the repository in the GitHub App’s settings if it is missing.',
    href: '/projects',
  },
  {
    status: 404,
    situation: 'The owner, repository or base branch is not reachable',
    meaning:
      'GitHub could not find it as this installation. Usually a typo in --owner or --repo, or a base branch that does not exist on that repository.',
    fix: 'Check the three values against the repository on GitHub. The preflight runs before any translation, so a typo costs nothing.',
  },
  {
    status: 429,
    situation: 'Too many requests, with a Retry-After',
    meaning:
      'A rate window or this workspace’s daily ceiling. The message names which one and how long to wait, and nothing was translated.',
    fix: 'Wait the number of seconds in Retry-After. If a real project keeps hitting the daily ceiling, ask the operator to lift it.',
  },
  {
    status: 502,
    situation: 'The translation provider failed',
    meaning:
      'The API reached the model and the model failed. The provider’s own error is in the operator’s logs and is deliberately not returned — it can quote parts of an API key.',
    fix: 'Run again. If it keeps failing, the operator has the detail.',
  },
  {
    status: 503,
    situation: 'The API cannot be reached, or cannot check something',
    meaning:
      'Either the URL is wrong or the deployment is missing a provider key or its database. Nothing ran — a check that failed is not evidence that there was budget.',
    fix: 'Confirm the API answers: open its /health in a browser. Then check --api-url.',
  },
  {
    status: 409,
    situation: 'No pull request was opened because nothing changed',
    meaning:
      'Not a failure. Every translation in the run is already on the base branch, so there was nothing to deliver — and no empty pull request or orphan branch was created.',
    fix: 'Nothing to do. This is the expected answer when you re-run against a repository that is already up to date.',
  },
  {
    status: 'cli',
    situation: 'The CLI says no supported framework was detected',
    meaning:
      'It runs in the directory you are in, and it looks for Next.js, Vite + React or React Native. Nothing was translated and nothing was written.',
    fix: 'Run it from the root of the application — the directory holding package.json.',
  },
];

/** Every distinct HTTP status this table claims the API can return. */
export function refusalStatuses(): number[] {
  return [
    ...new Set(
      REFUSALS.map((refusal) => refusal.status).filter(
        (status): status is number => typeof status === 'number',
      ),
    ),
  ].sort((a, b) => a - b);
}
