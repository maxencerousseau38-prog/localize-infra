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
 * The evaluation harness, which is MIT-licensed.
 *
 * Linked instead of the repository root wherever the surrounding copy claims
 * something is open source: the repository is deliberately mixed-licence
 * (see LICENSE), so "the open-source repository" was never quite true.
 */
export const EVAL_PACKAGE_URL = `${GITHUB_REPO_URL}/tree/master/packages/eval`;

/**
 * Shown on the landing page and in /docs as the way to install the CLI.
 *
 * Whether it *works* is `CLI_PUBLISHED_TO_NPM` below, not something each page
 * decides for itself. The doc comment describing this constant had drifted
 * away from it — two comment blocks in a row, the first orphaned above the
 * second — so the explanation for the command sat on a different export.
 */
export const INSTALL_COMMAND = 'npx @localize-infra/cli init';

/**
 * Whether `@localize-infra/cli` exists on the public npm registry.
 *
 * **One fact, one place.** Two pages make a claim that depends on it — the
 * hero's qualification under the copyable command, and the first paragraph of
 * /docs — and they were separately worded prose. Two hand-written sentences
 * about one external fact is one sentence that gets forgotten, on a site whose
 * stated constraint is that every claim must be true *today*
 * (see docs/frontend/07-milestones.md, FE-1 risks).
 *
 * **Flipping this is part of publishing, not a follow-up.** `docs/releasing.md`
 * lists it as a step in the publish sequence, and e2e tests assert that both
 * pages say whatever this says — so the suite goes red if the flag and the copy
 * ever disagree, in either direction.
 *
 * It is a constant rather than a registry lookup on purpose. Querying npm at
 * build time would make a green build depend on a third party being reachable,
 * and would let the site's honesty change without a commit.
 *
 * Published on 2026-08-28: `@localize-infra/schemas`, `@localize-infra/core`
 * and `@localize-infra/cli`, all at 0.1.0, into an organisation scope that
 * `/-/org/localize-infra/package` now lists all three names under.
 *
 * The earlier note here said the scope was "unclaimed". It was not — that read
 * a 404 on a *package* as evidence about the *scope*, which it never was.
 * `docs/releasing.md` carries the corrected check.
 */
export const CLI_PUBLISHED_TO_NPM = true;
