import { Page, PageHeader, PageMeta, PageSection } from '@/components/page';
import { classificationModelConfigured } from '@/lib/closer/classification';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { createClient } from '@/lib/supabase/server';
import {
  INTENT_LABELS,
  type ReplyIntent,
  summariseLearning,
} from '@localize-infra/closer-core';
import { EmptyState } from '@localize-infra/ui';
import { MessageSquare } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RecordReplyForm, type SentMessage } from './record-form';
import { ReplyCard, type ReplyRow } from './reply-card';

export const metadata: Metadata = { title: 'Replies · Closer' };

interface ReplyRecord {
  id: string;
  body: string;
  received_at: string;
  model_intent: ReplyIntent | null;
  model_confidence: number | null;
  model_evidence: string | null;
  operator_intent: ReplyIntent | null;
  opt_out_phrase: string | null;
  opt_out_excerpt: string | null;
  closer_leads: {
    stage: string;
    closer_companies: { name: string } | null;
  } | null;
  closer_contacts: { full_name: string | null } | null;
}

/**
 * What came back, what it was read as, and what a person decided it meant.
 *
 * The three sections are the loop: record, confirm, learn. The last one is the
 * reason the first two store two intents rather than one, and it is also the
 * one most likely to lie — a rate computed from four replies reads exactly like
 * a rate computed from four hundred. `summariseLearning` withholds the
 * percentage until there is enough to support it and says how short it is.
 */
export default async function CloserRepliesPage() {
  if (!isSupabaseConfigured()) notFound();

  const supabase = await createClient();

  const [repliesResult, sentResult, transitionsResult] = await Promise.all([
    supabase
      .from('closer_replies')
      .select(
        'id,body,received_at,model_intent,model_confidence,model_evidence,operator_intent,opt_out_phrase,opt_out_excerpt,closer_leads(stage,closer_companies(name)),closer_contacts(full_name)',
      )
      .order('received_at', { ascending: false })
      .limit(50),
    supabase
      .from('closer_messages')
      .select(
        'id,subject,sent_at,closer_leads(closer_companies(name)),closer_contacts(full_name)',
      )
      .eq('state', 'sent')
      .order('sent_at', { ascending: false })
      .limit(50),
    // The funnel's shape, so the card offers only moves the database will
    // accept. Read rather than mirrored in TypeScript: one source of truth.
    supabase
      .from('closer_stage_transitions')
      .select('from_stage,to_stage,note'),
  ]);

  const records = (repliesResult.data ?? []) as unknown as ReplyRecord[];

  const movesFrom = new Map<string, { stage: string; note: string }[]>();
  for (const row of (transitionsResult.data ?? []) as unknown as {
    from_stage: string;
    to_stage: string;
    note: string;
  }[]) {
    const list = movesFrom.get(row.from_stage) ?? [];
    list.push({ stage: row.to_stage, note: row.note });
    movesFrom.set(row.from_stage, list);
  }

  const replies: ReplyRow[] = records.map((row) => {
    const stage = row.closer_leads?.stage ?? 'discovered';
    return {
      id: row.id,
      body: row.body,
      receivedAt: row.received_at,
      companyName:
        row.closer_leads?.closer_companies?.name ?? 'Unknown company',
      contactName: row.closer_contacts?.full_name ?? null,
      leadStage: stage,
      modelIntent: row.model_intent,
      modelConfidence: row.model_confidence,
      modelEvidence: row.model_evidence,
      operatorIntent: row.operator_intent,
      optOutPhrase: row.opt_out_phrase,
      optOutExcerpt: row.opt_out_excerpt,
      legalMoves: movesFrom.get(stage) ?? [],
    };
  });

  const sent: SentMessage[] = (
    (sentResult.data ?? []) as unknown as {
      id: string;
      subject: string | null;
      sent_at: string | null;
      closer_leads: { closer_companies: { name: string } | null } | null;
      closer_contacts: { full_name: string | null } | null;
    }[]
  ).map((row) => ({
    id: row.id,
    label: `${row.closer_leads?.closer_companies?.name ?? 'Unknown'} · ${
      row.closer_contacts?.full_name ?? 'contact unnamed'
    } · ${row.subject ?? 'no subject'}`,
  }));

  const learning = summariseLearning(
    records.map((row) => ({
      modelIntent: row.model_intent,
      operatorIntent: row.operator_intent,
    })),
  );

  const awaiting = replies.filter((reply) => reply.operatorIntent === null);

  return (
    <Page>
      <PageHeader
        title="Replies"
        purpose="What came back, read by a model and decided by a person."
        meta={<PageMeta label="Unconfirmed">{awaiting.length}</PageMeta>}
      />

      <PageSection
        title="Record a reply"
        description="This deployment has no mailbox connector, so a reply enters the system when the person who read it pastes it in."
      >
        <RecordReplyForm sent={sent} />
      </PageSection>

      <PageSection
        title="Received"
        description="Newest first. A model proposes what each one means; nothing acts on the proposal until somebody confirms it."
      >
        {repliesResult.error ? (
          <p className="text-small text-secondary">
            Could not read replies: {repliesResult.error.message}
          </p>
        ) : replies.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="Nothing has come back"
            description="Replies appear here once one is recorded above. An opt-out is acted on the moment it is recorded, without waiting for a classification."
          />
        ) : (
          <ul className="space-y-3">
            {replies.map((reply) => (
              <ReplyCard
                key={reply.id}
                reply={reply}
                classificationAvailable={classificationModelConfigured()}
              />
            ))}
          </ul>
        )}
      </PageSection>

      <PageSection
        title="What this has learned"
        description="How often the classifier agreed with the person who checked it."
      >
        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-caption text-tertiary">Replies recorded</dt>
            <dd className="font-mono text-primary">{learning.replies}</dd>
          </div>
          <div>
            <dt className="text-caption text-tertiary">
              Confirmed by a person
            </dt>
            <dd className="font-mono text-primary">{learning.compared}</dd>
          </div>
          <div>
            <dt className="text-caption text-tertiary">Classifier agreed</dt>
            <dd className="font-mono text-primary">
              {/*
                A percentage or nothing. "67%" from three replies is read as a
                trend and moves seventeen points on one disagreement, so the
                figure is withheld rather than shown beside a caveat nobody
                reads — and the sentence says how short it is.
              */}
              {learning.agreementPercent !== null ? (
                `${learning.agreementPercent}%`
              ) : (
                <span className="text-small text-tertiary">
                  {learning.withheld}
                </span>
              )}
            </dd>
          </div>
        </dl>

        {learning.byOperatorIntent.length > 0 ? (
          <ul className="mt-4 space-y-1">
            {learning.byOperatorIntent.map((row) => (
              <li key={row.intent} className="text-small text-secondary">
                <span className="font-mono text-tertiary">{row.count}</span>{' '}
                {INTENT_LABELS[row.intent]}
              </li>
            ))}
          </ul>
        ) : null}
      </PageSection>
    </Page>
  );
}
