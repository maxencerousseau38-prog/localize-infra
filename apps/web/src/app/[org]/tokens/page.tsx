import { Page, PageHeader, PageMeta } from '@/components/page';
import { listCliTokens, tokenState } from '@/lib/cli-tokens/data';
import {
  currentRole,
  findGitHubInstallation,
  findOrganization,
  requireSession,
} from '@/lib/data/workspace';
import { Badge, type Tone } from '@localize-infra/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CreateToken } from './create-token';
import { RevokeToken } from './revoke-token';

export const metadata: Metadata = { title: 'CLI tokens' };

const STATE: Record<
  ReturnType<typeof tokenState>,
  { label: string; tone: Tone }
> = {
  active: { label: 'Active', tone: 'confident' },
  expired: { label: 'Expired', tone: 'neutral' },
  revoked: { label: 'Revoked', tone: 'neutral' },
};

const date = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

/**
 * Personal tokens for `@localize-infra/cli`.
 *
 * They replace the operator's shared bearer token, which could not be revoked
 * for one person and opened pull requests through the operator's GitHub
 * installation. A token here acts for this workspace only, through this
 * workspace's installation, and expires.
 *
 * Every member sees the workspace's tokens — who holds access is not a secret
 * inside the workspace — but only a token's creator, or an owner or admin, can
 * revoke it. The button is offered on that basis; `revoke_cli_token` enforces
 * the same rule, because a server action is a public endpoint.
 */
export default async function TokensPage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const session = await requireSession();
  const { org } = await params;
  const organization = await findOrganization(org);
  if (!organization) notFound();

  const [tokens, role, installation] = await Promise.all([
    listCliTokens(organization.id),
    currentRole(organization.id),
    findGitHubInstallation(organization.id),
  ]);
  const canManageAll = role === 'owner' || role === 'admin';
  const active = tokens.filter((t) => tokenState(t) === 'active').length;

  return (
    <Page>
      <PageHeader
        title="CLI tokens"
        purpose="Personal tokens that let the command-line tool act for this workspace."
        meta={
          <>
            <PageMeta label="Workspace">{organization.name}</PageMeta>
            <PageMeta label="Active">{active}</PageMeta>
          </>
        }
      />

      {installation ? null : (
        <p className="mt-6 max-w-[64ch] rounded-md border border-line bg-surface/40 px-4 py-3 text-small leading-6 text-secondary">
          This workspace has no GitHub connection yet. A token will translate,
          but <span className="font-mono">--open-pr</span> is refused until you{' '}
          <Link
            href={`/${org}/projects`}
            className="text-link underline underline-offset-2 hover:text-link-hover"
          >
            connect GitHub
          </Link>
          .
        </p>
      )}

      <CreateToken orgSlug={org} />

      <section aria-labelledby="issued" className="mt-8">
        <h2 id="issued" className="text-subtitle font-semibold text-primary">
          Issued in this workspace
        </h2>
        {tokens.length === 0 ? (
          <p className="mt-3 text-small text-secondary">No tokens yet.</p>
        ) : (
          <ul className="mt-3 border-t border-subtle">
            {tokens.map((token) => {
              const state = tokenState(token);
              const mine = token.created_by === session.userId;
              return (
                <li
                  key={token.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-subtle px-1 py-3"
                  data-testid="cli-token-row"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-body font-medium text-primary">
                      {token.name}
                      {mine ? (
                        <span className="ms-2 text-caption font-normal text-tertiary">
                          yours
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block font-mono text-caption text-tertiary">
                      {token.token_prefix}… · created {date(token.created_at)}
                      {' · '}
                      {state === 'revoked' && token.revoked_at
                        ? `revoked ${date(token.revoked_at)}`
                        : `expires ${date(token.expires_at)}`}
                      {' · '}
                      {token.last_used_at
                        ? `last used ${date(token.last_used_at)}`
                        : 'never used'}
                    </span>
                  </span>
                  <Badge tone={STATE[state].tone}>{STATE[state].label}</Badge>
                  {state === 'active' && (mine || canManageAll) ? (
                    <RevokeToken
                      orgSlug={org}
                      tokenId={token.id}
                      name={token.name}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </Page>
  );
}
