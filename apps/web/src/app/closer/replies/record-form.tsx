'use client';

import {
  Button,
  SelectContent,
  SelectItem,
  SelectRoot,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@localize-infra/ui';
import { Inbox } from 'lucide-react';
import * as React from 'react';
import { type RecordReplyState, recordReply } from './actions';

export interface SentMessage {
  id: string;
  label: string;
}

/**
 * Pasting in what somebody wrote back.
 *
 * This is the whole intake path, and it is a textarea on purpose. Nothing in
 * this repository can receive an email — no inbox connector, no webhook, no
 * IMAP client — so a form that claimed to watch a mailbox would be a screen
 * that lies. What it can honestly do is take the text from the person who read
 * it, and record who that was.
 */
export function RecordReplyForm({ sent }: { sent: SentMessage[] }) {
  const [state, action, pending] = React.useActionState<
    RecordReplyState,
    FormData
  >(recordReply, {});
  const [messageId, setMessageId] = React.useState(sent[0]?.id ?? '');

  if (sent.length === 0) {
    return (
      <p className="text-small text-secondary">
        Nothing has been sent yet, so nothing can have answered. A reply is
        recorded against the message it answers.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="messageId" value={messageId} />

      <SelectRoot value={messageId} onValueChange={setMessageId}>
        <SelectTrigger className="w-full max-w-lg" aria-label="Answering">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {sent.map((message) => (
            <SelectItem key={message.id} value={message.id}>
              {message.label}
            </SelectItem>
          ))}
        </SelectContent>
      </SelectRoot>

      <Textarea
        name="body"
        rows={6}
        aria-label="What they wrote"
        placeholder="Paste their reply here, as they wrote it."
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={pending}>
          <Inbox aria-hidden="true" />
          {pending ? 'Recording…' : 'Record reply'}
        </Button>

        {state.error ? (
          <span role="alert" className="text-caption text-failed-text">
            {state.error}
          </span>
        ) : null}

        {state.done ? (
          <span aria-live="polite" className="text-caption text-secondary">
            {state.done.optedOut ? (
              <>
                Recorded — and suppressed on “
                <span className="font-mono">{state.done.phrase}</span>”, before
                anything read it.
              </>
            ) : (
              'Recorded.'
            )}
          </span>
        ) : null}
      </div>
    </form>
  );
}
