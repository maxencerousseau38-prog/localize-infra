'use server';

import { closerOrganizationId } from '@/lib/closer/access';
import {
  type Inspected,
  inspectRepository,
  searchCandidates,
} from '@/lib/closer/discovery';
import { requireSession } from '@/lib/data/workspace';
import { createClient } from '@/lib/supabase/server';
import { companyDomain } from '@localize-infra/closer-core';
import { revalidatePath } from 'next/cache';

export interface DiscoveryState {
  error?: string;
  /** What the run did, in the words the operator needs to judge it. */
  summary?: {
    searched: number;
    qualified: number;
    recorded: number;
    skipped: string[];
  };
}

/**
 * One discovery run, synchronous and bounded.
 *
 * Ten candidates, two GitHub requests each, well inside a rate limit of 5,000
 * an hour. It runs inside the request rather than as a background job, and that
 * is a stated limit rather than an oversight: `closer_jobs` exists and has no
 * worker, so queueing here would mean a row nothing picks up — a button that
 * looks like it did something. Ten repositories take a few seconds; the day a
 * run needs a hundred, the table is already there.
 *
 * Runs as the operator, because every write path checks `is_org_member` against
 * `auth.uid()`. `apps/api` has no user session, so discovery could not live
 * there without giving that service a service-role key — a much larger change
 * than this feature is worth.
 */
export async function discoverCompanies(
  _prev: DiscoveryState,
  formData: FormData,
): Promise<DiscoveryState> {
  await requireSession();

  const organizationId = await closerOrganizationId();
  if (!organizationId) return { error: 'This workspace does not have Closer.' };

  const query = String(formData.get('query') ?? '').trim();
  if (!query) return { error: 'Enter something to search GitHub for.' };
  if (query.length > 200) return { error: 'That query is too long.' };

  let candidates: Awaited<ReturnType<typeof searchCandidates>>;
  try {
    candidates = await searchCandidates(organizationId, query);
  } catch (error) {
    return {
      error: `GitHub search failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  const inspected: Inspected[] = [];
  const skipped: string[] = [];

  for (const candidate of candidates) {
    const result = await inspectRepository(organizationId, candidate);
    if (result.qualifies) inspected.push(result);
    else skipped.push(candidate.fullName);
  }

  const supabase = await createClient();
  let recorded = 0;

  for (const repo of inspected) {
    const domain = companyDomain(repo.homepage);

    /*
     * The company is named by its GitHub owner and keyed by its domain.
     *
     * A repository without a resolvable homepage still becomes a company, with
     * a null domain — dropping it would discard exactly the early-stage teams
     * this is looking for. The cost is that two discoveries of two
     * repositories from one owner without homepages become two companies;
     * merging them would need a judgement this has no evidence for.
     */
    const { data: company, error: companyError } = await supabase.rpc(
      'closer_upsert_company',
      {
        p_organization_id: organizationId,
        p_name: repo.owner,
        p_domain: domain,
        p_discovered_from: 'github_repository',
        p_discovered_url: `https://github.com/${repo.fullName}`,
        p_repository: repo.fullName,
        p_locales: repo.locales,
      },
    );

    if (companyError || !company) {
      // A suppressed domain raises here, and that is the system working. It is
      // counted as skipped rather than surfaced as a failure of the run.
      skipped.push(
        `${repo.fullName} (${companyError?.message ?? 'not recorded'})`,
      );
      continue;
    }

    for (const signal of repo.signals) {
      await supabase.rpc('closer_record_evidence', {
        p_company_id: company.id,
        p_kind: 'localization_signal',
        p_label: signal.label,
        p_summary: signal.summary,
        p_source: 'github_repository',
        // The repository is the source a reader can open. The supporting paths
        // are inside the summary rather than in the URL, because a link to a
        // file on a branch that moves is a link that rots.
        p_source_url: `https://github.com/${repo.fullName}`,
        p_observed_at: repo.pushedAt ?? new Date().toISOString(),
        p_confidence: signal.confidence,
      });
    }

    // Idempotent: rediscovering a company returns the lead it already has, at
    // whatever stage it reached, rather than resetting it to `discovered`.
    await supabase.rpc('closer_open_lead', { p_company_id: company.id });
    recorded += 1;
  }

  revalidatePath('/closer/companies');
  revalidatePath('/closer');

  return {
    summary: {
      searched: candidates.length,
      qualified: inspected.length,
      recorded,
      skipped,
    },
  };
}
