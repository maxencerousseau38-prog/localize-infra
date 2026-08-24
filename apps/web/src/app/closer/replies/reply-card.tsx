'use client';

import {
  INTENT_LABELS,
  REPLY_INTENTS,
  type ReplyIntent,
  suggestedStage,
} from '@localize-infra/closer-core';
import {
  Badge,
  Button,
  SelectContent,
  SelectItem,
  SelectRoot,
  SelectTrigger,
  SelectValue,
} from '@localize-infra/ui';
import { ShieldAlert, Sparkles } from 'lucide-react';
import * as React from 'react';
import {
  type ClassifyState,
  type ConfirmState,
  classifyReplyAction,
  confirmReplyIntent,
} from './actions';

export interface ReplyRow {
  id: string;
  body: string;
  receivedAt: string;
  companyName: string;
  contactName: string | null;
  leadStage: string;
  modelIntent: ReplyIntent | null;
  modelConfidence: number | null;
  modelEvidence: string | null;
  operatorIntent: ReplyIntent | null;
  optOutPhrase: string | null;
  optOutExcerpt: string | null;
  /** Stages the transition table says this lead may move to, with their notes. */
  legalMoves: { stage: string; note: string }[];
}

/**
 * One reply, with what the classifier thinks and what the person decides.
 *
 * The model's answer is shown as a proposal and never as the record. What the
 * database acts on is `operator_intent`, and the gap between the two is the
 * only measurement this system makes of its own classifier — which is why the
 * proposal is pre-selected but never submitted for you.
 */
export function ReplyCard({
  reply,
  classificationAvailable,
}: { reply: ReplyRow; classificationAvailable: boolean }) {
  const [classifyState, classify, classifying] = React.useActionState<
    ClassifyState,
    FormData
  >(classifyReplyAction, {});
  const [confirmState, confirm, confirming] = React.useActionState<
    ConfirmState,
    FormData
  >(confirmReplyIntent, {});

  const [intent, setIntent] = React.useState<ReplyIntent>(
    reply.operatorIntent ?? reply.modelIntent ?? 'unclear',
  );

  /*
   * The proposed move is the intersection of what the intent argues for and
   * what the funnel allows from where this lead actually stands. Offering a
   * stage the database will refuse would be a button that fails on press.
   */
  const proposed = suggestedStage(intent);
  const proposedIsLegal = reply.legalMoves.some((m) => m.stage === proposed);
  const [moveTo, setMoveTo] = React.useState<string>('');

  React.useEffect(() => {
    setMoveTo(proposed && proposedIsLegal ? proposed : '');
  }, [proposed, proposedIsLegal]);

  return (
    <li className="rounded-lg border border-subtle">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-subtle px-4 py-3">
        <span className="font-medium text-primary">
          {reply.companyName}
          <span className="ms-2 text-caption text-tertiary">
            {reply.contactName ?? 'contact unnamed'}
          </span>
        </span>
        <span className="flex items-center gap-2 font-mono text-caption text-tertiary">
          <span>{reply.receivedAt.slice(0, 10)}</span>
          <span>{reply.leadStage}</span>
        </span>
      </div>

      {/*
        The opt-out banner sits above the reply, not beside the controls.
        By the time this renders the suppression has already happened — it was
        applied on the words at the moment the reply was recorded, without
        waiting for a classification or for anybody to press anything.
      */}
      {reply.optOutPhrase ? (
        <p
          role="alert"
          className="flex items-start gap-2 border-b border-subtle bg-failed-bg px-4 py-2 text-caption text-failed-text"
        >
          <ShieldAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            Suppressed on “
            <span className="font-mono">{reply.optOutPhrase}</span>”. This
            company and address will not be written to again.
            {reply.optOutExcerpt ? (
              <span className="block text-tertiary">{reply.optOutExcerpt}</span>
            ) : null}
          </span>
        </p>
      ) : null}

      <div className="grid gap-4 px-4 py-3 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <p className="min-w-0 whitespace-pre-wrap text-small text-secondary">
          {reply.body}
        </p>

        <div className="min-w-0 border-t border-subtle pt-3 lg:border-s lg:border-t-0 lg:ps-4 lg:pt-0">
          {reply.modelIntent ? (
            <div className="space-y-1">
              <p className="text-caption font-medium text-tertiary">Read as</p>
              <p className="text-small text-primary">
                {INTENT_LABELS[reply.modelIntent]}{' '}
                <span className="font-mono text-caption text-tertiary">
                  {Math.round((reply.modelConfidence ?? 0) * 100)}%
                </span>
              </p>
              {/* The span it quoted, so the proposal can be checked against the
                  reply in less time than reading the reply again. */}
              {reply.modelEvidence ? (
                <p className="text-caption italic text-tertiary">
                  “{reply.modelEvidence}”
                </p>
              ) : null}
            </div>
          ) : classificationAvailable ? (
            <form action={classify}>
              <input type="hidden" name="replyId" value={reply.id} />
              <Button
                type="submit"
                variant="secondary"
                size="sm"
                disabled={classifying}
              >
                <Sparkles aria-hidden="true" />
                {classifying ? 'Reading…' : 'Read it'}
              </Button>
              {classifyState.error ? (
                <span
                  role="alert"
                  className="ms-2 text-caption text-failed-text"
                >
                  {classifyState.error}
                </span>
              ) : null}
            </form>
          ) : (
            <p className="text-caption text-tertiary">
              Classification needs{' '}
              <span className="font-mono">ANTHROPIC_API_KEY</span>, which this
              deployment does not have. Choose the intent yourself below.
            </p>
          )}
        </div>
      </div>

      <form
        action={confirm}
        className="flex flex-wrap items-center gap-2 border-t border-subtle px-4 py-3"
      >
        <input type="hidden" name="replyId" value={reply.id} />
        <input type="hidden" name="intent" value={intent} />
        <input type="hidden" name="moveTo" value={moveTo} />

        <SelectRoot
          value={intent}
          onValueChange={(value) => setIntent(value as ReplyIntent)}
        >
          <SelectTrigger className="w-56" aria-label="What the reply meant">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REPLY_INTENTS.map((value) => (
              <SelectItem key={value} value={value}>
                {INTENT_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </SelectRoot>

        {reply.legalMoves.length > 0 ? (
          <SelectRoot value={moveTo} onValueChange={setMoveTo}>
            <SelectTrigger className="w-56" aria-label="Move the lead to">
              <SelectValue placeholder="Leave the stage alone" />
            </SelectTrigger>
            <SelectContent>
              {reply.legalMoves.map((move) => (
                <SelectItem key={move.stage} value={move.stage}>
                  {move.stage} — {move.note}
                </SelectItem>
              ))}
            </SelectContent>
          </SelectRoot>
        ) : (
          <span className="text-caption text-tertiary">
            No move is legal from {reply.leadStage}.
          </span>
        )}

        <Button type="submit" size="sm" disabled={confirming}>
          {confirming ? 'Saving…' : 'Confirm'}
        </Button>

        {reply.operatorIntent ? (
          <Badge tone="neutral">
            Confirmed: {INTENT_LABELS[reply.operatorIntent]}
          </Badge>
        ) : null}

        {confirmState.error ? (
          <span role="alert" className="text-caption text-failed-text">
            {confirmState.error}
          </span>
        ) : null}
        {confirmState.done ? (
          <span aria-live="polite" className="text-caption text-secondary">
            {confirmState.done}
          </span>
        ) : null}
      </form>
    </li>
  );
}
