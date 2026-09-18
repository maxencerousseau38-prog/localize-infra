'use client';

import { Button } from '@localize-infra/ui';
import { useActionState } from 'react';
import { verifyInstallation } from './actions';
import { IDLE } from './verify-state';

/**
 * "Connected" is a row in a table. This asks GitHub.
 *
 * The distinction is the reason the control exists: an owner can uninstall the
 * App from GitHub's own settings, and nothing tells this application when they
 * do. The row survives, the panel keeps saying Connected, and the first thing
 * to discover otherwise is a run that fails after every locale has been
 * translated and paid for.
 *
 * The result is deliberately three-valued — unasked, working, broken — rather
 * than a badge that is green until proven otherwise. Before the button is
 * pressed the honest state is *not checked*, and saying so is what makes the
 * green afterwards worth anything.
 */
export function VerifyInstallation({ orgSlug }: { orgSlug: string }) {
  const [state, action, pending] = useActionState(
    verifyInstallation.bind(null, orgSlug),
    IDLE,
  );

  return (
    <form action={action} className="mt-3">
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? 'Checking…' : 'Verify installation'}
      </Button>

      <output aria-live="polite" className="contents">
        {state.checked && state.ok ? (
          <div
            className="mt-3 max-w-[64ch] rounded-md border border-confident bg-confident-bg px-3 py-2"
            data-testid="verify-result"
          >
            <p className="text-small font-medium text-confident-text">
              Reachable — {state.repositories} repositor
              {state.repositories === 1 ? 'y' : 'ies'} granted to this
              installation.
            </p>
            <ul className="mt-1 space-y-0.5">
              {state.sample.map((name) => (
                <li
                  key={name}
                  className="font-mono text-caption text-secondary"
                >
                  {name}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {state.checked && !state.ok ? (
          <div
            className="mt-3 max-w-[64ch] rounded-md border border-failed bg-failed-bg px-3 py-2"
            data-testid="verify-result"
          >
            <p className="text-small text-failed-text">{state.problem}</p>
            {/*
              DESIGN.md §8: an error state reproduces machine output verbatim.
              GitHub's own sentence is often more specific than anything this
              app could say about it.
            */}
            {state.detail ? (
              <p className="mt-1 font-mono text-caption leading-5 text-secondary">
                {state.detail}
              </p>
            ) : null}
          </div>
        ) : null}
      </output>
    </form>
  );
}
