'use client';

import { Button, Input, Textarea } from '@localize-infra/ui';
import { Check, ExternalLink, PenLine, Send, X } from 'lucide-react';
import * as React from 'react';
import {
  type ReviewState,
  approveMessage,
  markMessageSent,
  rejectMessage,
  reviseMessage,
} from './actions';

export interface CitedEvidence {
  id: string;
  label: string;
  summary: string;
  sourceUrl: string;
  observedAt: string;
}

export interface PendingMessage {
  id: string;
  channel: 'email' | 'linkedin';
  state: 'pending_approval' | 'approved';
  subject: string | null;
  body: string;
  companyName: string;
  contactName: string | null;
  contactEmail: string | null;
  model: string | null;
  createdAt: string;
  editedAt: string | null;
  /** The evidence the draft cites, resolved. */
  cited: CitedEvidence[];
  /** Ids cited whose evidence row no longer exists. */
  missing: string[];
}

function Feedback({ state }: { state: ReviewState }) {
  if (state.error) {
    return (
      <span role="alert" className="text-caption text-failed-text">
        {state.error}
      </span>
    );
  }
  if (state.done) {
    return (
      <span aria-live="polite" className="text-caption text-secondary">
        {state.done}
      </span>
    );
  }
  return null;
}

/**
 * One draft, beside the evidence it claims to be written from.
 *
 * The layout is the argument: the message on the left, every observation it
 * cites on the right with a link and a date. Approving means checking, and a
 * screen that showed the message alone would make checking a separate errand
 * nobody runs at the end of a long queue.
 */
export function ReviewCard({ message }: { message: PendingMessage }) {
  const [editing, setEditing] = React.useState(false);

  const [approveState, approve, approving] = React.useActionState<
    ReviewState,
    FormData
  >(approveMessage, {});
  const [rejectState, reject, rejecting] = React.useActionState<
    ReviewState,
    FormData
  >(rejectMessage, {});
  const [reviseState, revise, revising] = React.useActionState<
    ReviewState,
    FormData
  >(reviseMessage, {});
  const [sentState, markSent, marking] = React.useActionState<
    ReviewState,
    FormData
  >(markMessageSent, {});

  const awaiting = message.state === 'pending_approval';

  return (
    <li className="rounded-lg border border-subtle">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-subtle px-4 py-3">
        <span className="font-medium text-primary">
          {message.companyName}
          <span className="ms-2 text-caption text-tertiary">
            {message.contactName ?? 'contact unnamed'}
            {message.contactEmail ? ` · ${message.contactEmail}` : null}
          </span>
        </span>
        <span className="flex items-center gap-2 font-mono text-caption text-tertiary">
          <span>{message.channel}</span>
          {message.model ? <span>{message.model}</span> : null}
          {message.editedAt ? (
            <span className="text-secondary">edited</span>
          ) : null}
        </span>
      </div>

      <div className="grid gap-4 px-4 py-3 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="min-w-0">
          {editing ? (
            <form action={revise} className="space-y-2">
              <input type="hidden" name="messageId" value={message.id} />
              {message.channel === 'email' ? (
                <Input
                  name="subject"
                  defaultValue={message.subject ?? ''}
                  aria-label="Subject"
                />
              ) : null}
              <Textarea
                name="body"
                rows={8}
                defaultValue={message.body}
                aria-label="Message"
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button type="submit" size="sm" disabled={revising}>
                  {revising ? 'Saving…' : 'Save'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </Button>
                <Feedback state={reviseState} />
              </div>
            </form>
          ) : (
            <>
              {message.subject ? (
                <p className="font-medium text-primary">{message.subject}</p>
              ) : null}
              <p className="mt-1 whitespace-pre-wrap text-small text-secondary">
                {message.body}
              </p>
            </>
          )}
        </div>

        <div className="min-w-0 border-t border-subtle pt-3 lg:border-s lg:border-t-0 lg:ps-4 lg:pt-0">
          <p className="text-caption font-medium text-tertiary">
            Written from {message.cited.length} observation
            {message.cited.length === 1 ? '' : 's'}
          </p>
          <ul className="mt-2 space-y-2">
            {message.cited.map((item) => (
              <li key={item.id} className="text-caption">
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 font-mono text-secondary hover:text-primary"
                >
                  {item.label}
                  <ExternalLink aria-hidden="true" className="size-3" />
                </a>
                <span className="ms-1 text-tertiary">
                  {item.observedAt.slice(0, 10)}
                </span>
                <p className="text-tertiary">{item.summary}</p>
              </li>
            ))}
          </ul>

          {/*
            A cited row that no longer exists is not a rendering gap to skip
            over — it is a claim in the message that nothing supports any more.
            Said out loud, because the reviewer is about to vouch for the text.
          */}
          {message.missing.length > 0 ? (
            <p role="alert" className="mt-2 text-caption text-failed-text">
              {message.missing.length} cited observation
              {message.missing.length === 1 ? ' has' : 's have'} since been
              deleted. Whatever the message claims from{' '}
              {message.missing.length === 1 ? 'it' : 'them'} is now unsupported.
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-subtle px-4 py-3">
        {awaiting ? (
          <>
            <form action={approve}>
              <input type="hidden" name="messageId" value={message.id} />
              <Button type="submit" size="sm" disabled={approving}>
                <Check aria-hidden="true" />
                {approving ? 'Approving…' : 'Approve'}
              </Button>
            </form>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setEditing((value) => !value)}
            >
              <PenLine aria-hidden="true" />
              {editing ? 'Stop editing' : 'Edit'}
            </Button>

            <form action={reject} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="messageId" value={message.id} />
              <Input
                name="reason"
                placeholder="Why not?"
                aria-label="Reason for rejecting"
                className="h-8 w-44"
              />
              <Button
                type="submit"
                variant="secondary"
                size="sm"
                disabled={rejecting}
              >
                <X aria-hidden="true" />
                {rejecting ? 'Rejecting…' : 'Reject'}
              </Button>
            </form>

            <Feedback state={approveState} />
            <Feedback state={rejectState} />
          </>
        ) : (
          <>
            {/*
              "I sent this", not "Send".

              Nothing in this deployment can send an email, so a Send button
              would be a button that pretends to work. This records a fact about
              the world: somebody copied the text out and sent it.
            */}
            <form action={markSent}>
              <input type="hidden" name="messageId" value={message.id} />
              <Button type="submit" size="sm" disabled={marking}>
                <Send aria-hidden="true" />
                {marking ? 'Recording…' : 'I sent this'}
              </Button>
            </form>
            <span className="text-caption text-tertiary">
              Approved. Copy the text above and send it from your own client —
              this deployment has no mail provider.
            </span>
            <Feedback state={sentState} />
          </>
        )}
      </div>
    </li>
  );
}
