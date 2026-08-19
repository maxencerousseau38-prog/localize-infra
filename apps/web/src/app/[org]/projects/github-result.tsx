import { StateRule } from '@localize-infra/ui';

/**
 * What the GitHub callback decided, said out loud.
 *
 * `/github/callback` redirects here with `?github=<reason>` on every outcome,
 * including every refusal — and nothing rendered them, so an install that was
 * rejected for a good reason looked identical to one that silently did
 * nothing. A customer whose state had expired, or who returned from a cancelled
 * install, simply saw an unchanged page.
 *
 * Every message names what happened and what to do next. None of them says
 * "an error occurred": the callback already distinguished these cases, and
 * flattening them here would throw away the only diagnosis anyone gets.
 */

type Tone = 'confident' | 'degraded' | 'failed';

const OUTCOMES: Record<string, { tone: Tone; title: string; body: string }> = {
  connected: {
    tone: 'confident',
    title: 'GitHub connected',
    body: 'This workspace now reads the repositories you granted, and nothing else.',
  },
  'invalid-state': {
    tone: 'degraded',
    title: 'That install link had expired',
    body: 'Install links are signed and last ten minutes, so a stale or tampered one is refused rather than trusted. Start the connection again.',
  },
  'missing-installation': {
    tone: 'degraded',
    title: 'GitHub did not say what was installed',
    body: 'The callback arrived without an installation id. Nothing was recorded. Try the connection again from this page.',
  },
  'missing-code': {
    tone: 'degraded',
    title: 'The install was not authorised',
    body: 'GitHub returns an authorisation code only when you approve the app as well as install it. Without it, ownership of the installation cannot be proven, so nothing was stored. Run through the install again and accept the authorisation step.',
  },
  'oauth-not-configured': {
    tone: 'failed',
    title: 'Connecting your own account is switched off here',
    body: 'This deployment has no OAuth client secret, so the callback cannot prove that whoever completes an install actually owns it. Rather than store an installation id it cannot verify, the flow is disabled.',
  },
  'not-your-installation': {
    tone: 'failed',
    title: 'That installation is not yours to connect',
    body: 'GitHub was asked, with your own token, which installations you can reach — and this one was not among them. Nothing was recorded.',
  },
  'link-failed': {
    tone: 'failed',
    title: 'The connection could not be saved',
    body: 'Connecting GitHub is limited to a workspace owner or admin. If you are one, try again; if it keeps failing, the workspace may have been removed.',
  },
};

export function GitHubResult({ reason }: { reason: string | undefined }) {
  if (!reason) return null;
  const outcome = OUTCOMES[reason];
  // An unknown code is not rendered at all. The query string is user-writable,
  // and echoing whatever it contains would put attacker-chosen text on the page.
  if (!outcome) return null;

  return (
    <StateRule
      tone={outcome.tone}
      // Not `role="status"`: this arrives on a full page navigation from the
      // GitHub callback, so it is page content that was there at render, not a
      // live update an assistive technology needs interrupting for.
      className="mt-6 rounded-e-lg bg-surface/60 py-4 pe-4"
    >
      <p className="text-body font-medium text-primary">{outcome.title}</p>
      <p className="mt-1 max-w-[68ch] text-small leading-6 text-secondary">
        {outcome.body}
      </p>
    </StateRule>
  );
}
