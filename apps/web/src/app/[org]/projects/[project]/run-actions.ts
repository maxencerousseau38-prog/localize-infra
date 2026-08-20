'use server';

import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import {
  findOrganization,
  findProject,
  mayUsePrivateRepositories,
  requireSession,
} from '@/lib/data/workspace';
import { materialiseRepository } from '@/lib/github/materialise';
import { canReachRepository } from '@/lib/github/repositories';
import { createClient } from '@/lib/supabase/server';
import {
  buildKeyCatalog,
  detectFramework,
  extractFromProject,
  mergeLocaleFile,
  mergeTranslations,
  pendingKeys,
  readLocaleFile,
} from '@localize-infra/core';
import { TranslateBatchResponseSchema } from '@localize-infra/schemas';
import { revalidatePath } from 'next/cache';

export interface RunState {
  error?: string;
  runId?: string;
}

type Stage = 'detect' | 'extract' | 'translate' | 'pull_request';

/**
 * One run: detect, extract, translate, open a pull request.
 *
 * The same sequence the CLI performs, against a repository fetched from GitHub
 * instead of a local clone, and calling the same API the CLI calls rather than
 * re-implementing translation — one prompt, in one place.
 *
 * **It runs inside the request, and that is a limitation rather than a
 * design.** A repository with hundreds of strings across several locales will
 * outlive a serverless timeout and there is no worker to resume it. What the
 * request does guarantee is that a run is never silently lost: the row is
 * written before any work starts and closed in a finally block, so a crash
 * leaves a failed run carrying its reason instead of a row stuck at "running".
 *
 * Operator-gated for the same reason connecting a repository is — one shared
 * installation reaches every repository it was ever granted.
 */
export async function startRun(
  orgSlug: string,
  projectSlug: string,
  _prev: RunState,
  _formData: FormData,
): Promise<RunState> {
  await requireSession();
  /*
   * Ungated for the same reason as connecting: a run acts as the workspace's
   * own installation, so it can only reach repositories that installation was
   * granted. The allow-list was standing in for that guarantee while the
   * installation was shared.
   */

  const organization = await findOrganization(orgSlug);
  if (!organization) return { error: 'That workspace is not available.' };

  const project = await findProject(organization.id, projectSlug);
  if (!project) return { error: 'That project is not available.' };
  if (!project.repository_owner || !project.repository_name) {
    return { error: 'Connect a repository before running.' };
  }

  /*
   * Checked again here, not only at connect time.
   *
   * An entitlement can lapse after a repository was connected — a subscription
   * ends, a grant is withdrawn — and a check that only ran once would leave the
   * capability permanently attached to whoever had it first. Public
   * repositories are unaffected: /pricing promises those are free and
   * unlimited, so there is nothing to check for them.
   */
  const repository = await canReachRepository(
    project.repository_owner,
    project.repository_name,
    organization.id,
  );
  if (
    repository?.private &&
    !(await mayUsePrivateRepositories(organization.id))
  ) {
    return {
      error:
        'This project points at a private repository, which needs a paid plan. Public repositories are free and unlimited.',
    };
  }

  const supabase = await createClient();
  const { data: run, error: startError } = await supabase.rpc('start_run', {
    p_project_id: project.id,
  });
  if (startError || !run) {
    return {
      error: `Could not start a run: ${startError?.message ?? 'unknown'}`,
    };
  }

  let workdir: string | null = null;
  let stage: Stage = 'detect';
  let framework: string | null = null;
  let keysExtracted = 0;
  let keysTranslated = 0;
  let localesSucceeded = 0;
  let localesFailed = 0;
  let prUrl: string | null = null;
  let prNumber: number | null = null;
  const branch: string | null = null;
  let failure: string | null = null;

  const apiUrl = process.env.LOCALIZE_API_URL ?? 'http://127.0.0.1:8787';
  const apiToken = process.env.LOCALIZE_API_TOKEN ?? '';

  try {
    const materialised = await materialiseRepository(
      project.repository_owner,
      project.repository_name,
      project.repository_branch ?? 'main',
      organization.id,
    );
    workdir = materialised.dir;

    if (materialised.truncated) {
      throw new Error(
        'GitHub truncated the repository tree, so extraction would have run against an incomplete checkout. Refusing rather than reporting a partial key count as complete.',
      );
    }

    const detected = detectFramework(workdir);
    if (!detected) {
      throw new Error(
        'No supported framework detected. Supported: Next.js, Vite + React, React Native.',
      );
    }
    framework = detected.name;

    /*
     * Progress is written down, not accumulated in memory.
     *
     * `stage` was a local variable persisted once, by finish_run, at the end.
     * For the whole of a run — a checkout, an AST walk, one model call per
     * locale — the row said 'detect', so every reader was told the same thing
     * whether it was translating, waiting, or dead. Each call is awaited: a
     * fire-and-forget write is exactly the one that gets cancelled when the
     * request ends, which is when the record matters most.
     */
    const advance = async (
      to: typeof stage,
      counts: {
        keysExtracted?: number;
        keysTranslated?: number;
        localesSucceeded?: number;
        localesFailed?: number;
      } = {},
    ) => {
      stage = to;
      await supabase.rpc('advance_run', {
        p_run_id: run.id,
        p_stage: to,
        p_framework: framework,
        p_keys_extracted: counts.keysExtracted ?? null,
        p_keys_translated: counts.keysTranslated ?? null,
        p_locales_succeeded: counts.localesSucceeded ?? null,
        p_locales_failed: counts.localesFailed ?? null,
      });
    };

    await advance('extract');
    const extracted = extractFromProject(workdir, detected.sourceGlobs);
    const fresh = buildKeyCatalog(extracted);
    keysExtracted = Object.keys(fresh).length;

    if (keysExtracted === 0) {
      throw new Error(
        'No translatable strings found, so no pull request was opened.',
      );
    }

    const localesDir = join(workdir, detected.localesDir);
    const sourceLocale = project.source_locale;
    const mergedSource = mergeLocaleFile(localesDir, sourceLocale, fresh);

    await advance('translate', { keysExtracted });
    if (!apiToken) {
      throw new Error(
        'LOCALIZE_API_TOKEN is not set, so the translation API cannot be called.',
      );
    }

    const files: { path: string; content: string }[] = [
      {
        path: `${detected.localesDir}/${sourceLocale}.json`,
        content: `${JSON.stringify(mergedSource, null, 2)}\n`,
      },
    ];

    const strings = extracted.map((entry) => ({
      key: entry.key,
      text: entry.text,
      filePath: entry.filePath,
      componentName: entry.componentName,
      surroundingCode: entry.surroundingCode,
    }));

    for (const locale of project.target_locales) {
      try {
        const existing = readLocaleFile(localesDir, locale);

        // Only keys with no translation yet are sent. Two reasons, and both
        // matter to someone paying for this: a key that already has a value
        // carries somebody's decision, and re-translating every string on
        // every run bills a model for work finished months ago.
        const pending = new Set(pendingKeys(fresh, existing));
        const pendingStrings = strings.filter((entry) =>
          pending.has(entry.key),
        );

        let translated: Record<string, string> = {};

        if (pendingStrings.length > 0) {
          const response = await fetch(`${apiUrl}/v1/translate`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiToken}`,
            },
            body: JSON.stringify({
              targetLocale: locale,
              strings: pendingStrings,
            }),
          });

          if (!response.ok) {
            // Verbatim (DESIGN.md §8): a customer comparing this against their
            // own logs must see the same string.
            const detail = (await response.text()).slice(0, 300);
            throw new Error(
              `${response.status} ${response.statusText}: ${detail}`,
            );
          }

          // Parsed through the shared schema rather than cast, so a contract
          // drift surfaces here instead of as a confusing merge downstream.
          const body = TranslateBatchResponseSchema.parse(
            await response.json(),
          );
          translated = Object.fromEntries(
            body.translations.map((entry) => [entry.key, entry.text]),
          );
          keysTranslated += body.translations.length;
        }

        // Precedence lives in packages/core, next to its regression tests.
        // This was `{ ...existing, ...translated }`, which let fresh model
        // output overwrite a translation somebody had corrected by hand — the
        // opposite of what this product promises about manual changes.
        const merged = mergeTranslations(fresh, existing, translated);

        files.push({
          path: `${detected.localesDir}/${locale}.json`,
          content: `${JSON.stringify(merged, null, 2)}\n`,
        });
        localesSucceeded += 1;
      } catch (error) {
        // One locale failing must not abort the rest: that is the
        // per-language failure isolation the status board already claims.
        localesFailed += 1;
        failure = error instanceof Error ? error.message : String(error);
      }
    }

    if (localesSucceeded === 0) {
      throw new Error(
        `Every target locale failed. Last error: ${failure ?? 'unknown'}`,
      );
    }

    await advance('pull_request', {
      keysTranslated,
      localesSucceeded,
      localesFailed,
    });
    const prResponse = await fetch(`${apiUrl}/v1/open-pr`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify({
        owner: project.repository_owner,
        repo: project.repository_name,
        baseBranch: project.repository_branch ?? 'main',
        title: `Add translations (${project.target_locales.join(', ')})`,
        body: `Extracted ${keysExtracted} strings from ${framework}, translated ${keysTranslated} into ${localesSucceeded} locale(s).`,
        files,
      }),
    });

    if (!prResponse.ok) {
      const detail = (await prResponse.text()).slice(0, 300);
      throw new Error(
        `${prResponse.status} ${prResponse.statusText}: ${detail}`,
      );
    }

    const pr = (await prResponse.json()) as { prUrl: string; prNumber: number };
    prUrl = pr.prUrl;
    prNumber = pr.prNumber;
    // Deliberately not set. The API generates a timestamped branch name and
    // its response carries only the URL and number, so anything written here
    // would be a guess — and the first version guessed
    // "localize-infra/add-translations" while the real branch was
    // "localize-infra/add-translations-1786961416681". Recording the pull
    // request and leaving the branch null is the honest pair; surfacing the
    // branch needs the API to return it.
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
  } finally {
    if (workdir) {
      await rm(workdir, { recursive: true, force: true }).catch(() => {});
    }
  }

  /*
   * Closed exactly once, whatever happened.
   *
   * `partial` is a real outcome and not a rounding of success: a pull request
   * exists but at least one locale did not make it into it. Reporting that as
   * succeeded is precisely the lie this structure exists to prevent.
   */
  const status = prUrl
    ? localesFailed > 0
      ? 'partial'
      : 'succeeded'
    : 'failed';

  await supabase.rpc('finish_run', {
    p_run_id: run.id,
    p_status: status,
    p_stage: stage,
    p_framework: framework,
    p_keys_extracted: keysExtracted,
    p_keys_translated: keysTranslated,
    p_locales_succeeded: localesSucceeded,
    p_locales_failed: localesFailed,
    p_error: failure,
    p_pr_url: prUrl,
    p_pr_number: prNumber,
    p_branch: branch,
  });

  revalidatePath(`/${orgSlug}/projects/${projectSlug}`);
  return status === 'failed'
    ? { error: failure ?? 'The run failed.', runId: run.id }
    : { runId: run.id };
}
