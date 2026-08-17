'use client';

import type { AvailableRepository } from '@/lib/github/repositories';
import { Badge, Button, Field } from '@localize-infra/ui';
import { useActionState } from 'react';
import { type ConnectState, connectRepository } from './connect-actions';

const EMPTY: ConnectState = {};

export interface RepositorySectionProps {
  orgSlug: string;
  projectSlug: string;
  /** Null when nothing is connected yet. */
  connected: { owner: string; name: string; branch: string | null } | null;
  /** Empty when GitHub is unconfigured or the caller is not an operator. */
  available: AvailableRepository[];
  isOperator: boolean;
  gitHubConfigured: boolean;
}

/**
 * The repository connection, and an honest account of who may use it.
 *
 * The banner is not a disclaimer bolted on — it is the most important thing on
 * the section. This deployment has one shared GitHub App installation, so the
 * feature genuinely is operator-only, and a customer who cannot use it deserves
 * to be told why rather than shown a disabled button.
 */
export function RepositorySection({
  orgSlug,
  projectSlug,
  connected,
  available,
  isOperator,
  gitHubConfigured,
}: RepositorySectionProps) {
  const [state, action, pending] = useActionState(
    connectRepository.bind(null, orgSlug, projectSlug),
    EMPTY,
  );

  return (
    <section
      aria-labelledby="repository"
      className="mt-8 rounded-lg border border-line bg-surface/40 px-5 py-6"
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
        <h2
          id="repository"
          className="text-subtitle font-semibold text-primary"
        >
          Repository
        </h2>
        {connected ? (
          <Badge tone="confident">Connected</Badge>
        ) : (
          <Badge tone="neutral">Not connected</Badge>
        )}
      </div>

      {connected ? (
        <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
          <div>
            <dt className="text-eyebrow font-medium uppercase text-tertiary">
              Repository
            </dt>
            <dd className="mt-1 font-mono text-caption text-primary">
              {connected.owner}/{connected.name}
            </dd>
          </div>
          <div>
            <dt className="text-eyebrow font-medium uppercase text-tertiary">
              Base branch
            </dt>
            <dd className="mt-1 font-mono text-caption text-primary">
              {connected.branch ?? 'default'}
            </dd>
          </div>
        </dl>
      ) : null}

      {!gitHubConfigured ? (
        <p className="mt-4 max-w-[64ch] text-small leading-6 text-secondary">
          This deployment has no GitHub App configured, so a repository cannot
          be connected. The CLI still works against a local clone.
        </p>
      ) : !isOperator ? (
        /*
         * The honest boundary. Not a disabled control: a control that looks
         * like it would work if you tried harder is worse than a sentence
         * explaining that it would not (DESIGN.md §11).
         */
        <p className="mt-4 max-w-[64ch] text-small leading-6 text-secondary">
          This deployment shares a single GitHub App installation, so connecting
          a repository is limited to its operators. Per-customer installation —
          where you authorise the App against your own repositories — is not
          built yet. Until then, run the CLI against a local clone.
        </p>
      ) : (
        <form action={action} className="mt-4 flex flex-col gap-4">
          <p className="max-w-[64ch] text-small leading-6 text-secondary">
            Operator access. These are the repositories this deployment’s shared
            installation can reach — not a customer’s own account.
          </p>

          <Field label="Repository" required>
            {/* A native select, not the Radix one in packages/ui: this form
                posts to a Server Action, and a native control carries its value
                without JavaScript. The Radix Select renders a button and would
                need a hidden input to submit at all. */}
            <select
              name="repository"
              required
              defaultValue={
                connected ? `${connected.owner}/${connected.name}` : ''
              }
              className="h-8 w-full rounded-md border border-line bg-canvas px-2 text-body text-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus"
            >
              <option value="">Choose a repository…</option>
              {available.map((repo) => (
                <option key={repo.fullName} value={repo.fullName}>
                  {repo.fullName} ({repo.private ? 'private' : 'public'},{' '}
                  {repo.defaultBranch})
                </option>
              ))}
            </select>
          </Field>

          <output aria-live="polite" className="contents">
            {state.error ? (
              <p className="rounded-md border border-failed bg-failed-bg px-3 py-2 text-small text-failed-text">
                {state.error}
              </p>
            ) : null}
          </output>

          <div>
            <Button type="submit" variant="primary" disabled={pending}>
              {pending
                ? 'Connecting…'
                : connected
                  ? 'Change repository'
                  : 'Connect repository'}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
