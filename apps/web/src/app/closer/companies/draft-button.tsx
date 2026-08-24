'use client';

import { Button } from '@localize-infra/ui';
import { PenLine } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { type DraftState, draftOutreach } from './actions';

/**
 * Ask for a first message, for one lead.
 *
 * Nothing is sent and nothing is queued: the draft lands in the approvals
 * screen, which is the only place a message can leave from — and it leaves by a
 * person copying it out, because this deployment has no mail provider.
 *
 * When no model key is configured the button is not rendered at all and the
 * reason is written in its place. A disabled button says "later"; a sentence
 * says which variable is missing.
 */
export function DraftButton({
  leadId,
  enabled,
}: { leadId: string; enabled: boolean }) {
  const [state, action, pending] = React.useActionState<DraftState, FormData>(
    draftOutreach,
    {},
  );

  if (!enabled) {
    return (
      <span className="text-caption text-tertiary">
        Drafting needs <span className="font-mono">ANTHROPIC_API_KEY</span>,
        which this deployment does not have.
      </span>
    );
  }

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="leadId" value={leadId} />
      <input type="hidden" name="channel" value="email" />
      <Button type="submit" variant="secondary" size="sm" disabled={pending}>
        <PenLine aria-hidden="true" />
        {pending ? 'Writing…' : 'Draft outreach'}
      </Button>

      {state.error ? (
        <span role="alert" className="text-caption text-failed-text">
          {state.error}
        </span>
      ) : null}

      {state.done ? (
        <span aria-live="polite" className="text-caption text-secondary">
          Written from {state.done.citations} observation
          {state.done.citations === 1 ? '' : 's'} —{' '}
          <Link
            href="/closer/approvals"
            className="underline underline-offset-2"
          >
            waiting for approval
          </Link>
        </span>
      ) : null}
    </form>
  );
}
