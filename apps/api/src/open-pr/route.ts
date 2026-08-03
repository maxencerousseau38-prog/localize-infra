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

export async function openPrRouteHandler(
  body: unknown,
  config: GitHubAppConfig | null,
  ops: GitHubAppOperations,
): Promise<{ status: number; body: unknown }> {
  if (!config) {
    return {
      status: 501,
      body: {
        error:
          'GitHub App is not configured (GITHUB_APP_ID/GITHUB_APP_PRIVATE_KEY/GITHUB_APP_INSTALLATION_ID missing)',
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

  try {
    const octokit = await ops.createClient(config);
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
