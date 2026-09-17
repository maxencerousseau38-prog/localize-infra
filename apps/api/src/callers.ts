import { createHash } from 'node:crypto';

/**
 * Who is calling, once the bearer token has been checked.
 *
 * Two kinds, and the difference decides which GitHub installation a pull
 * request may be opened through:
 *
 * - `operator` — the server-to-server token (`API_AUTH_TOKEN`). Held by
 *   `apps/web`, which resolves the workspace's installation itself and names it
 *   in the request, and by a self-hosted deployment's own CLI. Never handed to
 *   end users.
 * - `workspace` — a personal CLI token (`lit_…`) issued in the web app. It acts
 *   for exactly one workspace, through that workspace's own installation, and
 *   can be revoked on its own.
 */
export type Caller =
  | { kind: 'operator' }
  | {
      kind: 'workspace';
      tokenId: string;
      userId: string;
      organizationId: string;
      organizationSlug: string;
      installationId: number | null;
      privateRepositories: boolean;
    };

export type WorkspaceCaller = Extract<Caller, { kind: 'workspace' }>;

export const OPERATOR: Caller = { kind: 'operator' };

/**
 * SHA-256 of the whole token, hex. The database stores this and only this.
 *
 * `apps/web/src/lib/cli-tokens/token.ts` computes the same digest when it
 * issues a token; both are pinned to one test vector.
 */
export function hashCliToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export interface TokenResolver {
  /** The workspace a token hash belongs to, or null if it resolves to nothing. */
  resolve(tokenHash: string): Promise<WorkspaceCaller | null>;
}

export interface TokenResolverConfig {
  supabaseUrl: string;
  serviceRoleKey: string;
}

/**
 * Personal tokens are verified against the database, so the API needs the
 * database URL and the service-role key. Both or nothing: without them this
 * deployment accepts only the operator token, and says so.
 */
export function readTokenResolverConfig(
  env: NodeJS.ProcessEnv = process.env,
): TokenResolverConfig | null {
  const supabaseUrl = env.SUPABASE_URL?.trim();
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceRoleKey) return null;
  return { supabaseUrl: supabaseUrl.replace(/\/+$/, ''), serviceRoleKey };
}

interface ResolvedRow {
  token_id: string;
  user_id: string;
  organization_id: string;
  organization_slug: string;
  installation_id: number | string | null;
  private_repositories: boolean | null;
}

/**
 * Resolves through PostgREST (`rpc/resolve_cli_token`) with plain `fetch`.
 *
 * Not `@supabase/supabase-js`: one RPC does not justify a client that builds a
 * realtime socket at construction, and the function needs nothing else.
 * `resolve_cli_token` is executable by `service_role` only, and it only ever
 * receives the hash — the plaintext token never leaves this process.
 */
export function createPostgrestResolver(
  config: TokenResolverConfig,
  fetchImpl: typeof fetch = fetch,
): TokenResolver {
  return {
    async resolve(tokenHash) {
      const response = await fetchImpl(
        `${config.supabaseUrl}/rest/v1/rpc/resolve_cli_token`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            apikey: config.serviceRoleKey,
            authorization: `Bearer ${config.serviceRoleKey}`,
          },
          body: JSON.stringify({ p_token_hash: tokenHash }),
        },
      );
      if (!response.ok) {
        throw new Error(`token resolution failed (${response.status})`);
      }
      const rows = (await response.json()) as ResolvedRow[];
      const row = Array.isArray(rows) ? rows[0] : undefined;
      if (!row) return null;
      return {
        kind: 'workspace',
        tokenId: row.token_id,
        userId: row.user_id,
        organizationId: row.organization_id,
        organizationSlug: row.organization_slug,
        installationId:
          row.installation_id === null ? null : Number(row.installation_id),
        privateRepositories: row.private_repositories === true,
      };
    },
  };
}
