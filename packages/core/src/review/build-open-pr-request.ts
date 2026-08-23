export interface OpenPrTarget {
  owner: string;
  repo: string;
  baseBranch: string;
  /**
   * The App installation that should open the pull request.
   *
   * Required, and required specifically because the field it feeds is optional
   * on the wire. `/v1/open-pr` falls back to the service's own configured
   * installation when the request omits one, so a caller that forgets does not
   * get an error — it gets a pull request opened by the wrong account, or one
   * that works for the operator and fails for every other customer. Making it
   * mandatory *here* is what turns that into a compile error at the two call
   * sites that must not forget.
   */
  installationId: number;
}

export interface OpenPrFile {
  path: string;
  content: string;
}

export interface OpenPrRequestBody {
  owner: string;
  repo: string;
  baseBranch: string;
  installationId: number;
  title: string;
  body: string;
  files: OpenPrFile[];
}

/**
 * The request body for `/v1/open-pr`, built in one place for both callers.
 *
 * Two server actions post to this endpoint — the unattended run and the
 * approval that follows a human review — and each used to assemble its own
 * object literal. That has now caused the same class of bug twice:
 *
 *   1. the approval path sent no `title` and no `body`, both required, so
 *      approving a reviewed run answered 400 and the review gate had never
 *      once opened a pull request;
 *   2. neither path sent an `installationId`, so every tenant's pull request
 *      came out of whichever installation the service itself was configured
 *      with (blocker 2b).
 *
 * Both survived for the same structural reason rather than by coincidence: the
 * bodies were built separately, only one path was exercised, and a missing
 * field is invisible in an object literal. The first was fixed by moving the
 * description into `describeApprovedPullRequest`; this moves the envelope, so
 * there is no longer a place where one caller can drift from the other.
 *
 * Pure, and in `packages/core` rather than in `apps/web`, because server
 * actions have no unit-test seam there — which was the other half of why the
 * first bug reached production.
 */
export function buildOpenPrRequest(
  target: OpenPrTarget,
  description: { title: string; body: string },
  files: OpenPrFile[],
): OpenPrRequestBody {
  return {
    owner: target.owner,
    repo: target.repo,
    baseBranch: target.baseBranch,
    installationId: target.installationId,
    title: description.title,
    body: description.body,
    files,
  };
}
