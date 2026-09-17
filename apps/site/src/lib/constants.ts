/**
 * Single source of truth for external references used across the site.
 *
 * Every claim on this site must be verifiable today (see
 * docs/frontend/07-milestones.md, FE-1 risks).
 */
export const GITHUB_REPO_URL =
  'https://github.com/maxencerousseau38-prog/localize-infra';

/**
 * The pull request the landing page's run produced, **when a visitor can open
 * it** — and `null` while they cannot.
 *
 * This was `…/localize-infra-fixture-vite/pull/1`, described here as "a real,
 * merged pull request". Three things were wrong with that, all checkable in one
 * command each, and none checked:
 *
 *   - #1 was never merged. It was closed unmerged on 2026-09-02.
 *   - The fixture repository is **private**, so the link answered 404 to every
 *     visitor. The page's central piece of evidence was a dead link, in four
 *     places, and nothing caught it because the people testing it were signed
 *     in to GitHub as the owner.
 *   - The run the page showed was not #1's: its duration came from another run.
 *
 * The landing page now shows run `b6fbbf11`, which opened #9 — merged, and the
 * real product path. #9 lives in the same private repository, so there is
 * nothing a visitor can follow, and every component that linked here renders
 * the facts without a link instead of a link that fails.
 *
 * **Making the fixture repository public is the one-line fix**: set this to
 * `https://github.com/maxencerousseau38-prog/localize-infra-fixture-vite/pull/9`
 * and the links come back everywhere. Check it signed out.
 */
export const EXAMPLE_PR_URL: string | null = null;

/**
 * The hosted application.
 *
 * It exists — accounts, workspaces, projects, GitHub connection, runs — and
 * sign-up is open. The site said for weeks that none of that was built,
 * because the sentences were written before it was and nothing tied them to it.
 * Pages that mention the hosted app read this constant rather than spelling
 * the origin, so attaching a domain is one edit.
 */
export const APP_URL = 'https://localize-infra-web.vercel.app';

/** The hosted API, which the CLI uses by default from 0.3.0. */
export const API_URL = 'https://localize-infra-api.vercel.app';

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
 * The flag says *published*, not *which version*, and that is deliberate: it
 * gates copy about `npx` working at all. This sentence said `cli` was "at 0.2.0
 * in the repository and awaiting a publish" — true when written, stale from
 * 2026-09-12 07:43 UTC, when 0.2.0 went to npm and `latest` moved to it. The
 * drift cost nothing precisely because the flag gates the copy and a version
 * does not: the pages it drives say nothing a version could falsify.
 *
 * The earlier note here said the scope was "unclaimed". It was not — that read
 * a 404 on a *package* as evidence about the *scope*, which it never was.
 * `docs/releasing.md` carries the corrected check.
 */
export const CLI_PUBLISHED_TO_NPM = true;

/**
 * Whether the **published** CLI talks to the hosted API with a personal token.
 *
 * Two things have to be true together before this flips, and both happen
 * outside a merge: `@localize-infra/cli@0.3.0` is on npm (0.2.0 still defaults
 * to localhost), and the production API has `SUPABASE_URL` and
 * `SUPABASE_SERVICE_ROLE_KEY`, without which it refuses every personal token.
 * Until then the pages keep describing the CLI that people actually install.
 *
 * Tokens can be *created* in the hosted app before this flips; the pages do
 * not advertise that, because a token the API refuses is not a feature.
 *
 * Flipped in the same change as the 0.3.0 publish — `docs/releasing.md`.
 * `apps/site/e2e/interaction.spec.ts` reads this and asserts the copy follows
 * it in both directions.
 */
export const CLI_PERSONAL_TOKENS_LIVE = false;
