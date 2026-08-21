import { NotConnected } from '@/components/not-connected';
import { Page, PageHeader, PageMeta } from '@/components/page';
import {
  listOpenAmbiguitiesForViewer,
  requireSession,
} from '@/lib/data/workspace';
import { EmptyState } from '@localize-infra/ui';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import type { Metadata } from 'next';
import { AmbiguityInbox } from './ambiguity-inbox';

export const metadata: Metadata = { title: 'Ambiguity' };

/**
 * Every question waiting on this person, across their workspaces.
 *
 * This rendered `SAMPLE_AMBIGUITIES` — three invented escalations with a banner
 * saying so — because until recently there was nowhere to store a real one. The
 * table exists now, the pipeline writes to it, and RLS confines reads to
 * workspaces the caller belongs to, so the sample is gone rather than being
 * relabelled.
 *
 * Not scoped to one workspace on purpose: the route has no org in its path, and
 * a queue that answers "what is blocked on me" is more useful spanning all of
 * them than one arbitrarily chosen. Answering happens on the project page,
 * where the run and its proposal are in view — this is the inbox, not the desk.
 */
export default async function AmbiguityPage() {
  // Before the session check: without a database there is no session to
  // require, and `requireSession` would throw where a sentence belongs.
  if (!isSupabaseConfigured()) {
    return (
      <Page>
        {/* The header stays. A page whose only content is an empty state
            still needs its one h1 — dropping it made this route headingless,
            which is an accessibility failure and not a test artefact. */}
        <PageHeader
          title="Ambiguity"
          purpose="Strings the agent would not guess at. Each one is a judgement call it escalated rather than getting wrong quietly."
        />
        <NotConnected noun="questions" />
      </Page>
    );
  }

  await requireSession();
  const ambiguities = await listOpenAmbiguitiesForViewer();

  return (
    <Page>
      <PageHeader
        title="Ambiguity"
        purpose="Strings the agent would not guess at. Each one is a judgement call it escalated rather than getting wrong quietly."
        meta={<PageMeta label="Waiting">{ambiguities.length}</PageMeta>}
      />

      {ambiguities.length === 0 ? (
        <div className="mt-8">
          {/*
           * An empty queue is the product working, not a blank screen. It says
           * so, rather than showing sample rows that imply work is pending.
           */}
          <EmptyState
            title="Nothing is waiting on you"
            description="When a run finds a string it will not guess at, the question appears here and the pull request waits until you answer it."
          />
        </div>
      ) : (
        <AmbiguityInbox items={ambiguities} />
      )}
    </Page>
  );
}
