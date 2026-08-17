import { installUrl, readOAuthConfig, signState } from '@/lib/github/install';
import { Badge } from '@localize-infra/ui';

/**
 * Whether this workspace has its own GitHub installation, and how to get one.
 *
 * Three states, and the difference between them is the difference between a
 * product and a demo, so none of them is smoothed over:
 *
 *  - **connected** — the workspace installed the App itself. Its token reaches
 *    its own repositories and nothing else. This is the real thing.
 *  - **available** — nothing connected yet, and a customer can do it now.
 *  - **unavailable** — the App has no OAuth client secret, so the callback
 *    cannot prove that whoever completes it actually owns the installation it
 *    names. The button is absent rather than disabled, and the reason is
 *    stated, because a flow that stores an unverified installation id is an
 *    account takeover wearing a feature's clothes.
 */
export function GitHubConnection({
  organizationId,
  appSlug,
  connected,
}: {
  organizationId: string;
  appSlug: string | null;
  connected: {
    account_login: string;
    account_type: string;
    connected_at: string;
  } | null;
}) {
  const oauth = readOAuthConfig();
  const state = signState(organizationId);
  const canInstall = Boolean(oauth && appSlug && state);

  return (
    <section
      aria-labelledby="github"
      className="mt-6 rounded-lg border border-line bg-surface/40 px-5 py-5"
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
        <h2 id="github" className="text-subtitle font-semibold text-primary">
          GitHub
        </h2>
        {connected ? (
          <Badge tone="confident">Connected</Badge>
        ) : (
          <Badge tone="neutral">Not connected</Badge>
        )}
      </div>

      {connected ? (
        <p className="mt-3 text-small leading-6 text-secondary">
          Installed on{' '}
          <span className="font-mono text-primary">
            {connected.account_login}
          </span>{' '}
          ({connected.account_type === 'Organization' ? 'organisation' : 'user'}
          ). This workspace reads only the repositories that installation was
          granted.
        </p>
      ) : canInstall && state && appSlug ? (
        <>
          <p className="mt-3 max-w-[64ch] text-small leading-6 text-secondary">
            Install the app on your own account and choose which repositories it
            may read. You can change or revoke that selection on GitHub at any
            time, and nothing here can widen it.
          </p>
          <a
            href={installUrl(appSlug, state)}
            className="mt-4 inline-flex h-8 items-center rounded-md bg-primary px-3 text-body font-medium text-inverse transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            Connect GitHub
          </a>
        </>
      ) : (
        <p className="mt-3 max-w-[64ch] text-small leading-6 text-secondary">
          Connecting your own GitHub account is not available on this
          deployment: the app has no OAuth client secret, so the callback cannot
          prove that whoever completes an install actually owns it. Rather than
          store an installation id it cannot verify, the flow is switched off.
          Operators can still connect repositories through the shared
          installation.
        </p>
      )}
    </section>
  );
}
