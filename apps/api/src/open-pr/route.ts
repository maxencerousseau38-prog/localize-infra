import type {
  GitHubAppConfig,
  Octokit,
  OpenPrRequest,
  OpenPrResult,
} from '@localize-infra/github-app';
import {
  OpenPrApiRequestSchema,
  OpenPrApiResponseSchema,
} from '@localize-infra/schemas';

const HEAD_BRANCH_PREFIX = 'localize-infra/add-translations';

export interface GitHubAppOperations {
  createClient: (config: GitHubAppConfig) => Promise<Octokit>;
  openPr: (octokit: Octokit, request: OpenPrRequest) => Promise<OpenPrResult>;
}

/**
 * What the App is, kept apart from which installation to act as.
 *
 * These used to be one `GitHubAppConfig`, which is what made every tenant's
 * pull request come out of the operator's installation: the identity of the
 * App and the choice of installation arrived together, from the environment,
 * with no way for a request to influence the second. `apps/web` split the same
 * pair in #24 for the read path and the isolation followed from the split; this
 * is that split applied to the write path.
 *
 * `defaultInstallationId` is a fallback for single-tenant deployments, not a
 * shared installation for multi-tenant ones — see `installationId` on
 * `OpenPrApiRequestSchema` for which caller relies on which.
 */
export interface OpenPrEnvironment {
  app: { appId: string; privateKey: string } | null;
  defaultInstallationId: number | null;
}

export async function openPrRouteHandler(
  body: unknown,
  env: OpenPrEnvironment,
  ops: GitHubAppOperations,
): Promise<{ status: number; body: unknown }> {
  if (!env.app) {
    return {
      status: 501,
      body: {
        error:
          'GitHub App is not configured (GITHUB_APP_ID/GITHUB_APP_PRIVATE_KEY missing)',
      },
    };
  }

  const parsed = OpenPrApiRequestSchema.safeParse(body);
  if (!parsed.success) {
    return {
      status: 400,
      body: { error: 'Invalid request body', details: parsed.error.flatten() },
    };
  }

  /*
   * The request wins over the environment, and a request that names no
   * installation on a service configured with no default is refused rather
   * than guessed at. 501 rather than 400 because the caller's request is
   * well-formed — it is this deployment that cannot serve it.
   */
  const installationId =
    parsed.data.installationId ?? env.defaultInstallationId;
  if (installationId === null) {
    return {
      status: 501,
      body: {
        error:
          'No GitHub App installation to act as: the request carried no installationId and GITHUB_APP_INSTALLATION_ID is not set.',
      },
    };
  }

  try {
    const octokit = await ops.createClient({ ...env.app, installationId });
    const result = await ops.openPr(octokit, {
      owner: parsed.data.owner,
      repo: parsed.data.repo,
      baseBranch: parsed.data.baseBranch,
      headBranch: `${HEAD_BRANCH_PREFIX}-${Date.now()}`,
      title: parsed.data.title,
      body: parsed.data.body,
      files: parsed.data.files,
    });
    return { status: 200, body: OpenPrApiResponseSchema.parse(result) };
  } catch (err) {
    // Log the full error server-side for the operator's own diagnostics, but
    // never echo it back to the caller: Octokit/GitHub errors can contain
    // rate-limit details, repo internals, or auth hints that shouldn't leak
    // to whoever can reach this endpoint.
    console.error('open-pr failed:', err);
    return {
      status: 502,
      body: {
        error: 'Failed to open pull request. Check server logs for details.',
      },
    };
  }
}
