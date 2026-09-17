/**
 * The two questions the CLI asks the API before it writes or spends anything.
 *
 * Validated here rather than with schemas from `@localize-infra/schemas`: the
 * published CLI depends on the published schemas (0.1.0), which predate these
 * endpoints, and a CLI release should not require a schemas release to parse
 * two small objects.
 */

/**
 * A readable sentence for a failed API response.
 *
 * The API answers `{ "error": "…" }`, and every refusal it makes is written
 * for the person reading the terminal. Printing the raw JSON around it made
 * those sentences harder to read than they need to be.
 */
export function apiErrorMessage(status: number, bodyText: string): string {
  try {
    const parsed: unknown = JSON.parse(bodyText);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'error' in parsed &&
      typeof (parsed as { error: unknown }).error === 'string'
    ) {
      return `${(parsed as { error: string }).error} (HTTP ${status})`;
    }
  } catch {
    // Not JSON: fall through to the raw text.
  }
  const text = bodyText.trim();
  return text ? `${text} (HTTP ${status})` : `HTTP ${status}`;
}

/**
 * The API could not be reached at all — DNS, refused connection, TLS, offline.
 *
 * Kept apart from a refusal because the two call for different sentences: a
 * refusal is the API's own words, this is "check the URL or your network".
 * Reported as "Refused by http://127.0.0.1:9: fetch failed" before, which
 * blamed a server that never answered.
 */
export class ApiUnreachableError extends Error {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
    this.name = 'ApiUnreachableError';
  }
}

async function send(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (error) {
    throw new ApiUnreachableError(error);
  }
}

export type WhoAmI =
  | { kind: 'operator' }
  | { kind: 'workspace'; workspace: string; githubConnected: boolean }
  /** An API older than this CLI, which has no `/v1/whoami`. */
  | { kind: 'unknown' };

export async function whoami(
  apiUrl: string,
  apiToken: string,
): Promise<WhoAmI> {
  const response = await send(`${apiUrl}/v1/whoami`, {
    headers: { authorization: `Bearer ${apiToken}` },
  });
  // A self-hosted API from before 0.3.0: not a failure, just no answer.
  if (response.status === 404) return { kind: 'unknown' };
  if (!response.ok) {
    throw new Error(apiErrorMessage(response.status, await response.text()));
  }
  const body: unknown = await response.json();
  if (typeof body === 'object' && body !== null && 'kind' in body) {
    const b = body as Record<string, unknown>;
    if (b.kind === 'operator') return { kind: 'operator' };
    if (
      b.kind === 'workspace' &&
      typeof b.workspace === 'string' &&
      typeof b.githubConnected === 'boolean'
    ) {
      return {
        kind: 'workspace',
        workspace: b.workspace,
        githubConnected: b.githubConnected,
      };
    }
  }
  throw new Error('The API answered /v1/whoami with an unexpected shape.');
}

/**
 * Can a pull request be opened on `owner/repo` at `baseBranch`? Resolves when
 * it can, throws the API's own sentence when it cannot.
 *
 * Returns `false` for an API that predates the endpoint, so the caller can go
 * on as before rather than refuse.
 */
export async function preflightPullRequest(
  apiUrl: string,
  apiToken: string,
  target: { owner: string; repo: string; baseBranch: string },
): Promise<boolean> {
  const response = await send(`${apiUrl}/v1/open-pr/preflight`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiToken}`,
    },
    body: JSON.stringify(target),
  });
  if (response.status === 404) {
    // Two different 404s: the route missing (old API, plain "Not Found"), or
    // the repository unreachable (JSON with an `error`). Only the first is
    // "unsupported".
    const text = await response.text();
    if (!text.trim().startsWith('{')) return false;
    throw new Error(apiErrorMessage(404, text));
  }
  if (!response.ok) {
    throw new Error(apiErrorMessage(response.status, await response.text()));
  }
  return true;
}
