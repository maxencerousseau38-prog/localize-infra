/**
 * Single source of truth for external references used across the site.
 *
 * The PR link points at a real, merged pull request produced by the real CLI
 * during end-to-end validation. Every claim on this site must be verifiable
 * today (see docs/frontend/07-milestones.md, FE-1 risks) — linking to a genuine
 * artefact instead of a screenshot is the point.
 */
export const GITHUB_REPO_URL =
  'https://github.com/maxencerousseau38-prog/localize-infra';

export const EXAMPLE_PR_URL =
  'https://github.com/maxencerousseau38-prog/localize-infra-fixture-vite/pull/1';

/**
 * Shown on the landing page as the shape the tool is heading for.
 *
 * It does not work yet: `@localize-infra/cli` is not published to npm, so this
 * command 404s today. The hero says so directly and links to /docs for the
 * from-source path — the alternative was leaving a primary call to action that
 * fails for every visitor who copies it, on a site whose stated constraint is
 * that every claim must be true today.
 */
export const INSTALL_COMMAND = 'npx @localize-infra/cli init';
