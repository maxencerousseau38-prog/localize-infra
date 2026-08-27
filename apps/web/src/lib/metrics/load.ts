import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { type Funnel, buildFunnel } from './funnel';

/**
 * The funnel for one workspace, read under RLS.
 *
 * Three queries against tables that already exist. No events table is written
 * or read: every timestamp here was recorded by the code that performed the
 * thing, and a second account of the same facts would be free to disagree with
 * the first.
 *
 * Read in parallel because they are independent and none is expensive — the
 * largest is `runs`, and a workspace with enough runs for the count to matter
 * has better problems.
 */
export async function loadFunnel(
  organizationId: string,
  workspaceCreatedAt: string,
): Promise<Funnel> {
  const supabase = await createClient();

  const [installation, projects, runs] = await Promise.all([
    supabase
      .from('organization_github_installations')
      .select('connected_at')
      .eq('organization_id', organizationId)
      .maybeSingle(),
    supabase
      .from('projects')
      .select('repository_connected_at')
      .eq('organization_id', organizationId)
      .not('repository_connected_at', 'is', null),
    /*
     * `pr_merged_at` is deliberately absent from this select: the column does
     * not exist. `buildFunnel` distinguishes "no run carries a merge time" from
     * "no run was merged", and leaving the field off every row is what tells it
     * the question has not been asked.
     */
    supabase
      .from('runs')
      .select('created_at,finished_at,status,pr_url')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: true })
      .limit(500),
  ]);

  return buildFunnel({
    workspaceCreatedAt,
    githubConnectedAt: installation.data?.connected_at ?? null,
    repositoriesConnectedAt: (projects.data ?? [])
      .map((row) => row.repository_connected_at as string | null)
      .filter((value): value is string => value !== null),
    runs: (runs.data ?? []) as Parameters<typeof buildFunnel>[0]['runs'],
  });
}
