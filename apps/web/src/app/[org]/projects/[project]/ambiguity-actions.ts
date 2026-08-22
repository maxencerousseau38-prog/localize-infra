'use server';

import {
  findOrganization,
  findProject,
  requireSession,
} from '@/lib/data/workspace';
import { createClient } from '@/lib/supabase/server';
import {
  buildLocaleFiles,
  describeApprovedPullRequest,
  unresolvedCount,
} from '@localize-infra/core';
import { OpenPrApiResponseSchema } from '@localize-infra/schemas';
import { revalidatePath } from 'next/cache';

export interface AmbiguityState {
  error?: string;
}

/**
 * Answering one of the agent's questions.
 *
 * Authorization is not re-implemented here. `resolve_ambiguity` runs as
 * definer and checks membership against the row's own organization, so a
 * forged id in the form body reaches a function that refuses it rather than a
 * query this action forgot to scope.
 */
export async function resolveAmbiguity(
  _prev: AmbiguityState,
  formData: FormData,
): Promise<AmbiguityState> {
  await requireSession();

  const id = String(formData.get('ambiguityId') ?? '');
  const org = String(formData.get('org') ?? '');
  const projectSlug = String(formData.get('project') ?? '');
  const dismiss = formData.get('intent') === 'dismiss';
  const text = String(formData.get('resolvedText') ?? '').trim();

  if (!id) return { error: 'No ambiguity was identified.' };
  if (!dismiss && !text) {
    return { error: 'Choose an option or write a translation.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('resolve_ambiguity', {
    p_ambiguity_id: id,
    p_resolved_text: dismiss ? '' : text,
    p_dismiss: dismiss,
  });

  if (error) {
    // Verbatim, per DESIGN.md §8. The database's own message names the reason
    // — not a member, already gone, empty resolution — better than a summary.
    return { error: error.message };
  }

  revalidatePath(`/${org}/projects/${projectSlug}`);
  return {};
}

export interface ApprovalState {
  error?: string;
  prUrl?: string;
}

/**
 * Approving a reviewed run, which is the step that opens the pull request.
 *
 * The property that matters is that this commits **what was reviewed**. Locale
 * files are rebuilt from `run_translations` — the rows written during the run
 * — with resolved ambiguities applied over them. Nothing is re-translated, so
 * the diff somebody approved is the diff that lands. Re-running the model here
 * would produce a fresh sample from a probability distribution and quietly
 * make the review screen a decoration.
 *
 * It refuses while any question is still open, and that check is here rather
 * than only in the UI because a form body is something anyone can post.
 */
export async function approveRun(
  _prev: ApprovalState,
  formData: FormData,
): Promise<ApprovalState> {
  await requireSession();

  const runId = String(formData.get('runId') ?? '');
  const orgSlug = String(formData.get('org') ?? '');
  const projectSlug = String(formData.get('project') ?? '');
  if (!runId) return { error: 'No run was identified.' };

  const organization = await findOrganization(orgSlug);
  if (!organization) return { error: 'Workspace not found.' };
  const project = await findProject(organization.id, projectSlug);
  if (!project) return { error: 'Project not found.' };
  if (!project.repository_owner || !project.repository_name) {
    return {
      error:
        'This project has no repository connected, so there is nowhere to open a pull request.',
    };
  }

  const supabase = await createClient();

  // Read the run first: finish_run writes every count it is given, and the
  // parameters it is not given default to zero. Approving without carrying
  // these forward would report a successful run that extracted nothing.
  const { data: runRow, error: runError } = await supabase
    .from('runs')
    .select(
      'id,status,framework,keys_extracted,keys_translated,locales_succeeded,locales_failed,locales_dir',
    )
    .eq('id', runId)
    .maybeSingle();

  if (runError || !runRow) {
    return { error: 'That run is not available in this workspace.' };
  }
  const run = runRow as {
    status: string;
    framework: string | null;
    keys_extracted: number;
    keys_translated: number;
    locales_succeeded: number;
    locales_failed: number;
    locales_dir: string | null;
  };

  if (run.status !== 'awaiting_review') {
    return {
      error: `This run is ${run.status.replace('_', ' ')}, so there is nothing to approve.`,
    };
  }

  const { data: ambiguities, error: ambiguityError } = await supabase
    .from('run_ambiguities')
    .select('translation_key,locale,state,resolved_text,proposed_text')
    .eq('run_id', runId);

  if (ambiguityError) {
    return {
      error: `Could not read this run's questions: ${ambiguityError.message}`,
    };
  }

  /*
   * Both the gate and the file contents come from `packages/core` now.
   *
   * This was forty lines inline, reachable only through Supabase, a GitHub
   * App and a live model — so the function deciding the exact bytes that land
   * in a customer's repository had no test at all. It sits next to
   * `writeLocaleFile` because the two must agree on key ordering byte for
   * byte, and keeping them in separate packages is how that drifts.
   */
  const decisions = (ambiguities ?? []).map((row) => {
    const record = row as {
      translation_key: string;
      locale: string;
      state: 'unresolved' | 'resolved' | 'dismissed';
      resolved_text: string | null;
      proposed_text: string;
    };
    return record;
  });

  const openCount = unresolvedCount(decisions);
  if (openCount > 0) {
    return {
      error:
        openCount === 1
          ? 'One question is still unanswered. Answer it before opening a pull request.'
          : `${openCount} questions are still unanswered. Answer them before opening a pull request.`,
    };
  }

  const { data: rows, error: rowsError } = await supabase
    .from('run_translations')
    .select('locale,translation_key,proposed_text')
    .eq('run_id', runId);

  if (rowsError) {
    return {
      error: `Could not read this run's proposals: ${rowsError.message}`,
    };
  }
  if (!rows || rows.length === 0) {
    return {
      error:
        'This run recorded nothing to commit. Start a new run rather than opening an empty pull request.',
    };
  }

  /*
   * The path comes from the run, never from the form.
   *
   * It is discovered by framework detection during the run and stamped onto
   * the row then. This used to read a form field and fall back to a hardcoded
   * 'src/locales', which is wrong for any project detected elsewhere — the
   * fixture repository on this product's own landing page uses 'locales/'.
   * Approving would have committed a second, parallel tree of locale files
   * rather than updating the real one: a pull request wrong in a way that
   * looks right.
   *
   * A run with no stamp predates the column. Refusing is the honest move; the
   * alternative is guessing the path again, which is the bug.
   */
  const localesDir = run.locales_dir;
  if (!localesDir) {
    return {
      error:
        'This run predates locale-path tracking, so there is no reliable place to write. Start a new run.',
    };
  }

  const files = buildLocaleFiles(
    rows as {
      locale: string;
      translation_key: string;
      proposed_text: string;
    }[],
    decisions,
    localesDir,
  );

  const apiUrl = process.env.LOCALIZE_API_URL ?? 'http://127.0.0.1:8787';
  const apiToken = process.env.LOCALIZE_API_TOKEN ?? '';
  if (!apiToken) {
    return {
      error:
        'LOCALIZE_API_TOKEN is not set on this deployment, so no pull request can be opened.',
    };
  }

  let prUrl: string;
  let prNumber: number;

  try {
    const response = await fetch(`${apiUrl}/v1/open-pr`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify({
        owner: project.repository_owner,
        repo: project.repository_name,
        baseBranch: project.repository_branch ?? 'main',
        /*
         * `title` and `body` were absent, and both are required by
         * `OpenPrApiRequestSchema`. Approving a reviewed run answered
         * 400 Bad Request and recorded the run failed — so the review gate,
         * which is the product's differentiator, had never once opened a pull
         * request.
         *
         * It survived because the two callers built their request bodies
         * separately and only `run-actions.ts` was ever exercised end to end.
         * Built by a pure function in `packages/core` now, tested against the
         * same schema the API validates with.
         */
        ...describeApprovedPullRequest({
          locales: project.target_locales,
          keyCount: run.keys_extracted,
          framework: run.framework,
          decisions: decisions.map((d) => ({
            state: d.state,
            resolvedText: d.resolved_text,
          })),
        }),
        files,
      }),
    });

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 300);
      throw new Error(`${response.status} ${response.statusText}: ${detail}`);
    }

    const body = OpenPrApiResponseSchema.parse(await response.json());
    prUrl = body.prUrl;
    prNumber = body.prNumber;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await supabase.rpc('finish_run', {
      p_run_id: runId,
      p_status: 'failed',
      p_stage: 'pull_request',
      p_framework: run.framework,
      p_keys_extracted: run.keys_extracted,
      p_keys_translated: run.keys_translated,
      p_locales_succeeded: run.locales_succeeded,
      p_locales_failed: run.locales_failed,
      p_error: message,
    });
    revalidatePath(`/${orgSlug}/projects/${projectSlug}`);
    return { error: message };
  }

  await supabase.rpc('finish_run', {
    p_run_id: runId,
    p_status: 'succeeded',
    p_stage: 'pull_request',
    p_framework: run.framework,
    p_keys_extracted: run.keys_extracted,
    p_keys_translated: run.keys_translated,
    p_locales_succeeded: run.locales_succeeded,
    p_locales_failed: run.locales_failed,
    p_pr_url: prUrl,
    p_pr_number: prNumber,
  });

  revalidatePath(`/${orgSlug}/projects/${projectSlug}`);
  return { prUrl };
}
