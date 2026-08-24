import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { CloserStage, StageCount } from '@localize-infra/closer-core';

export interface CloserOverview {
  companies: number;
  contacts: number;
  evidence: number;
  stages: StageCount[];
  jobs: { queued: number; running: number; failed: number };
  aiExecutions: number;
}

/**
 * The counts behind the overview, read under RLS.
 *
 * Every figure is a `count` against a real table. There is no fallback shape
 * and no sample: a workspace that has discovered nothing reports zero, and zero
 * is the honest answer rather than a reason to invent a demonstration.
 *
 * Read in parallel because they are independent, and none of them is expensive:
 * the largest table here is evidence, and a workspace with enough evidence for
 * a count to matter has other problems.
 */
export async function loadCloserOverview(): Promise<CloserOverview> {
  const supabase = await createClient();
  const head = { count: 'exact' as const, head: true };

  const [companies, contacts, evidence, leads, jobs, executions] =
    await Promise.all([
      supabase.from('closer_companies').select('*', head),
      supabase.from('closer_contacts').select('*', head),
      supabase.from('closer_evidence').select('*', head),
      supabase.from('closer_leads').select('stage'),
      supabase.from('closer_jobs').select('state'),
      supabase.from('closer_ai_executions').select('*', head),
    ]);

  /*
   * Stages are counted in the application rather than with a grouped query.
   *
   * PostgREST has no GROUP BY, and the alternatives are a database view or a
   * row per lead. A view is the right answer at a scale this will not reach for
   * a long time; counting a few hundred rows here costs nothing and keeps the
   * shape of the data one migration simpler.
   */
  const stageCounts = new Map<CloserStage, number>();
  for (const row of leads.data ?? []) {
    const stage = row.stage as CloserStage;
    stageCounts.set(stage, (stageCounts.get(stage) ?? 0) + 1);
  }

  const jobCounts = { queued: 0, running: 0, failed: 0 };
  for (const row of jobs.data ?? []) {
    const state = row.state as keyof typeof jobCounts;
    if (state in jobCounts) jobCounts[state] += 1;
  }

  return {
    companies: companies.count ?? 0,
    contacts: contacts.count ?? 0,
    evidence: evidence.count ?? 0,
    stages: [...stageCounts.entries()].map(([stage, count]) => ({
      stage,
      count,
    })),
    jobs: jobCounts,
    aiExecutions: executions.count ?? 0,
  };
}
