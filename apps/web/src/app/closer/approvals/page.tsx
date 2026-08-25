import { Page, PageHeader, PageMeta, PageSection } from '@/components/page';
import { optOutReason, suppressionSets } from '@/lib/closer/opt-out-block';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { createClient } from '@/lib/supabase/server';
import { EmptyState } from '@localize-infra/ui';
import { Inbox } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { type PendingMessage, ReviewCard } from './review-card';

export const metadata: Metadata = { title: 'Approvals · Closer' };

interface MessageRow {
  id: string;
  channel: 'email' | 'linkedin';
  state: 'pending_approval' | 'approved' | 'rejected' | 'sent';
  subject: string | null;
  body: string;
  grounded_in: string[];
  model: string | null;
  created_at: string;
  edited_at: string | null;
  closer_leads: {
    stage: string;
    closer_companies: { name: string; domain: string | null } | null;
  } | null;
  closer_contacts: { full_name: string | null; email: string | null } | null;
}

interface EvidenceRow {
  id: string;
  label: string;
  summary: string;
  source_url: string;
  observed_at: string;
}

/**
 * Everything waiting on a person, and everything a person has cleared but not
 * yet sent.
 *
 * Two states on one screen rather than two screens, because they are one queue:
 * a draft is not finished when it is approved, it is finished when it has left.
 * Splitting them would let approved messages accumulate somewhere nobody looks,
 * which is the failure mode of every approval workflow that has an "approved"
 * tab.
 *
 * Authorisation belongs to the layout above; this repeats only the cheap
 * environment precondition, because Next renders a layout and its page
 * concurrently and this would otherwise query a database that is not
 * configured.
 */
export default async function CloserApprovalsPage() {
  if (!isSupabaseConfigured()) notFound();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('closer_messages')
    .select(
      'id,channel,state,subject,body,grounded_in,model,created_at,edited_at,closer_leads(stage,closer_companies(name,domain)),closer_contacts(full_name,email)',
    )
    .in('state', ['pending_approval', 'approved'])
    .order('created_at', { ascending: true })
    .limit(50);

  const rows = (data ?? []) as unknown as MessageRow[];

  /*
   * The suppression list, read once for the whole queue.
   *
   * The lead's stage is the usual signal and would nearly always be enough —
   * `closer_suppress` moves it. This reads the list as well because "nearly
   * always" is doing too much work in a sentence about consent, and because a
   * suppression whose lead failed to move is precisely the case a stage check
   * cannot see. It is also a case this repository has already had once.
   */
  const { data: suppressionRows } = await supabase
    .from('closer_suppressions')
    .select('domain,email');
  const suppressions = suppressionSets(
    (suppressionRows ?? []) as {
      domain: string | null;
      email: string | null;
    }[],
  );

  /*
   * The cited evidence, fetched in one query for the whole queue.
   *
   * One request per message would be up to fifty round trips to render a list;
   * this is one `in` over the union of every cited id. The rows come back
   * scoped by RLS like everything else, so a message that somehow cited another
   * workspace's evidence resolves to nothing here — and the card says so rather
   * than quietly showing fewer observations than the message claims.
   */
  const citedIds = [...new Set(rows.flatMap((row) => row.grounded_in ?? []))];
  const evidenceById = new Map<string, EvidenceRow>();
  if (citedIds.length > 0) {
    const { data: evidence } = await supabase
      .from('closer_evidence')
      .select('id,label,summary,source_url,observed_at')
      .in('id', citedIds);
    for (const item of (evidence ?? []) as unknown as EvidenceRow[]) {
      evidenceById.set(item.id, item);
    }
  }

  const messages: PendingMessage[] = rows.map((row) => {
    const ids = row.grounded_in ?? [];
    return {
      id: row.id,
      channel: row.channel,
      state: row.state as PendingMessage['state'],
      subject: row.subject,
      body: row.body,
      companyName:
        row.closer_leads?.closer_companies?.name ?? 'Unknown company',
      blockedReason: optOutReason(
        {
          leadStage: row.closer_leads?.stage ?? null,
          companyDomain: row.closer_leads?.closer_companies?.domain ?? null,
          contactEmail: row.closer_contacts?.email ?? null,
        },
        suppressions,
      ),
      contactName: row.closer_contacts?.full_name ?? null,
      contactEmail: row.closer_contacts?.email ?? null,
      model: row.model,
      createdAt: row.created_at,
      editedAt: row.edited_at,
      cited: ids
        .map((id) => evidenceById.get(id))
        .filter((item): item is EvidenceRow => item !== undefined)
        .map((item) => ({
          id: item.id,
          label: item.label,
          summary: item.summary,
          sourceUrl: item.source_url,
          observedAt: item.observed_at,
        })),
      missing: ids.filter((id) => !evidenceById.has(id)),
    };
  });

  /*
   * Blocked first, and taken out of both working queues.
   *
   * A message an opt-out has overtaken is not a slower item in the same list —
   * it is one nobody may act on, and leaving it among the actionable ones would
   * mean the only thing standing between it and a recipient is the operator
   * remembering. It is shown rather than hidden, because a draft that vanishes
   * teaches nothing and a person who wrote it will look for it.
   */
  const blocked = messages.filter((m) => m.blockedReason !== null);
  const actionable = messages.filter((m) => m.blockedReason === null);
  const awaiting = actionable.filter((m) => m.state === 'pending_approval');
  const approved = actionable.filter((m) => m.state === 'approved');

  return (
    <Page>
      <PageHeader
        title="Approvals"
        purpose="Nothing reaches anybody until a person here says so."
        meta={<PageMeta label="Awaiting">{awaiting.length}</PageMeta>}
      />

      <PageSection
        title="Awaiting approval"
        description="Each draft is shown beside the observations it was written from. Approving means having checked them."
      >
        {error ? (
          <p className="text-small text-secondary">
            Could not read the queue: {error.message}
          </p>
        ) : awaiting.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="Nothing waiting"
            description="Drafts appear here when the drafting agent writes one. Nothing is ever sent without passing through this screen."
          />
        ) : (
          <ul className="space-y-3">
            {awaiting.map((message) => (
              <ReviewCard key={message.id} message={message} />
            ))}
          </ul>
        )}
      </PageSection>

      {/*
        Blocked, and said out loud rather than quietly filtered.

        This section exists because the alternative — dropping them from the
        page — would leave an operator who remembers writing a draft looking
        for it, and would teach them nothing about why it went. Naming the
        opt-out is also the only way they learn that the system caught
        something they would otherwise have had to remember themselves.
      */}
      {blocked.length > 0 ? (
        <PageSection
          title="Blocked by an opt-out"
          description="These were written or approved before somebody asked to be left alone. They cannot be approved or recorded as sent, and the database refuses both independently of this screen."
        >
          <ul className="space-y-3">
            {blocked.map((message) => (
              <ReviewCard key={message.id} message={message} />
            ))}
          </ul>
        </PageSection>
      ) : null}

      {approved.length > 0 ? (
        <PageSection
          title="Approved, not yet sent"
          description="This deployment has no mail provider, so sending is something you do and then record here."
        >
          <ul className="space-y-3">
            {approved.map((message) => (
              <ReviewCard key={message.id} message={message} />
            ))}
          </ul>
        </PageSection>
      ) : null}
    </Page>
  );
}
