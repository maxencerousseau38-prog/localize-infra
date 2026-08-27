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
import {
  canReachRepository,
  installationIdFor,
} from '@/lib/github/repositories';
import { checkTranslations, describeFindings } from '@/lib/runs/quality';
import { createClient } from '@/lib/supabase/server';
import {
  buildKeyCatalog,
  buildOpenPrRequest,
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

// 'escalate' is a real stopping point, not a step passed through: a run that
// raised a question ends here and waits for a person. The database enum has
// always carried it; the pipeline never used it, because until now there was
// nothing that could be raised.
type Stage = 'detect' | 'extract' | 'translate' | 'escalate' | 'pull_request';

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
 * This said "operator-gated for the same reason connecting a repository is —
 * one shared installation reaches every repository it was ever granted", which
 * the body of the function has contradicted since the gate was removed.
 *
 * Reading the repository and writing the pull request now act as the same
 * installation — the workspace's own. They did not: `/v1/open-pr` took no
 * installation id, so every tenant's pull request came out of whichever one the
 * API had in its environment, and a workspace the operator's installation did
 * not cover would translate and then fail at the last step. The id is resolved
 * once here, by `installationIdFor`, and used for both halves.
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
  /*
   * Strings the model was asked for and did not return.
   *
   * The API has always reported these — `handleTranslateBatch` computes them
   * and the CLI prints them — and this function read `body.translations` and
   * nothing else. A locale that came back with three strings out of eight
   * hundred was counted a success and the run finished `succeeded`.
   */
  let keysMissing = 0;
  let localesSucceeded = 0;
  let localesFailed = 0;
  const proposals: {
    locale: string;
    translation_key: string;
    source_text: string;
    proposed_text: string;
    origin: 'model' | 'preserved' | 'resolved';
  }[] = [];
  const escalations: {
    key: string;
    locale: string;
    sourceText: string;
    proposedText: string;
    question: string;
    alternatives: { text: string; rationale: string }[];
  }[] = [];
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
          keysMissing += body.missingKeys.length;

          /*
           * Why keys are missing, when the API knows.
           *
           * `missingKeys` alone cannot tell a model that answered and left a
           * string out from a chunk whose every attempt came back unparseable,
           * and those deserve different reactions: the first is the model being
           * incomplete, the second is a run that lost work to a fault and has
           * already retried it three times.
           *
           * Recorded verbatim (DESIGN.md §8) and only when there is nothing
           * worse to report — a locale that failed outright sets `failure` in
           * the catch below, and that is the more useful message of the two.
           */
          for (const chunkFailure of body.failures) {
            failure ??= `${locale}: ${chunkFailure.keys.length} string(s) lost after ${chunkFailure.attempts} attempts — ${chunkFailure.error}`;
          }

          // Invariant 4, at the only point where it can actually be enforced.
          // A string the model refused to guess at becomes a question in the
          // queue, and its proposal is still used so the file is complete —
          // the PR is what waits, not the translation.
          for (const entry of body.translations) {
            if (entry.confidence !== 'ambiguous' || !entry.question) continue;
            escalations.push({
              key: entry.key,
              locale,
              sourceText: fresh[entry.key] ?? entry.text,
              proposedText: entry.text,
              question: entry.question,
              alternatives: entry.alternatives,
            });
          }
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
        // Written down so the review screen shows what will actually be
        // committed. If approval re-ran the model, the diff a developer
        // approved and the diff that landed would be two different samples
        // from the same distribution.
        for (const [key, value] of Object.entries(merged)) {
          proposals.push({
            locale,
            translation_key: key,
            source_text: fresh[key] ?? '',
            proposed_text: value,
            origin: existing[key] !== undefined ? 'preserved' : 'model',
          });
        }

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

    // Everything proposed is written down before anything is decided, so the
    // review screen and the pull request are the same object seen twice.
    if (proposals.length > 0) {
      await supabase.rpc('record_run_translations', {
        p_run_id: run.id,
        p_rows: proposals,
        // Stamped here because this is the only moment the path is known: it
        // comes from framework detection against a checkout this request is
        // holding open, and approval happens later with no checkout in reach.
        p_locales_dir: detected.localesDir,
      });
    }

    /*
     * The quality gate, before every other decision about this run.
     *
     * `packages/eval` has carried deterministic placeholder and ICU checks
     * since Sprint 0, gated in CI at 99.5% — and nothing on this path ran
     * them. A run could commit a translation whose `%{count}` had become
     * `%{compte}` and open the pull request with a clean description.
     *
     * First, and not after the ambiguity gate, because these two failures are
     * different in kind. An escalation says a human must choose between two
     * defensible readings; a broken placeholder says the file is wrong. Sending
     * a wrong file to `awaiting_review` would invite somebody to approve it.
     */
    const byLocale = new Map<string, Record<string, string>>();
    for (const proposal of proposals) {
      const entries = byLocale.get(proposal.locale) ?? {};
      entries[proposal.translation_key] = proposal.proposed_text;
      byLocale.set(proposal.locale, entries);
    }
    const quality = checkTranslations(
      fresh,
      [...byLocale].map(([locale, entries]) => ({ locale, entries })),
    );

    if (!quality.passed) {
      await supabase.rpc('finish_run', {
        p_run_id: run.id,
        p_status: 'failed',
        p_stage: 'translate',
        p_framework: framework,
        p_keys_extracted: keysExtracted,
        p_keys_translated: keysTranslated,
        p_locales_succeeded: localesSucceeded,
        p_locales_failed: localesFailed,
        // Verbatim, like every other failure this pipeline reports: a developer
        // comparing this against their own files must see the same strings.
        p_error: `${quality.findings.length} of ${quality.checked} translation(s) failed a quality check, so no pull request was opened.
${describeFindings(quality)}`,
      });
      revalidatePath(`/${organization.slug}/projects/${project.slug}`);
      return {
        error: `Quality checks failed on ${quality.findings.length} translation(s). No pull request was opened.`,
      };
    }

    // The gate. Invariant 4 says the agent raises ambiguities rather than
    // guessing them, and a pipeline that raised them and opened the pull
    // request anyway would be guessing with extra steps.
    if (escalations.length > 0) {
      // Reported, not just assigned: a run that stops to ask a question is one
      // a reader is most likely to be watching, so `escalate` has to reach the
      // row rather than living in a local variable until finish_run.
      await advance('escalate', {
        keysTranslated,
        localesSucceeded,
        localesFailed,
      });

      for (const escalation of escalations) {
        await supabase.rpc('record_ambiguity', {
          p_run_id: run.id,
          p_translation_key: escalation.key,
          p_locale: escalation.locale,
          p_source_text: escalation.sourceText,
          p_proposed_text: escalation.proposedText,
          p_question: escalation.question,
          p_alternatives: escalation.alternatives,
        });
      }

      await supabase.rpc('finish_run', {
        p_run_id: run.id,
        p_status: 'awaiting_review',
        p_stage: 'escalate',
        p_framework: framework,
        p_keys_extracted: keysExtracted,
        p_keys_translated: keysTranslated,
        p_locales_succeeded: localesSucceeded,
        p_locales_failed: localesFailed,
        p_error: null,
        p_pr_url: null,
        p_pr_number: null,
        p_branch: null,
      });

      revalidatePath(`/${organization.slug}/projects/${project.slug}`);
      return { runId: run.id };
    }

    await advance('pull_request', {
      keysTranslated,
      localesSucceeded,
      localesFailed,
    });

    /*
     * The same installation the tree was read through.
     *
     * `materialiseRepository` has already resolved and used it above, so this
     * cannot be null here in practice — it is re-resolved rather than threaded
     * through because the alternative is a parameter that exists only to be
     * carried, and re-reading is the cheaper of the two to keep correct. The
     * refusal below is what makes the type non-optional at the call site rather
     * than an assumption about the code above.
     */
    const installationId = await installationIdFor(organization.id);
    if (!installationId) {
      throw new Error(
        'This workspace has no GitHub installation, so no pull request can be opened.',
      );
    }

    const prResponse = await fetch(`${apiUrl}/v1/open-pr`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiToken}`,
      },
      // Same builder as the approval path in ambiguity-actions.ts, so the two
      // cannot drift on what the envelope must contain. They have twice.
      body: JSON.stringify(
        buildOpenPrRequest(
          {
            owner: project.repository_owner,
            repo: project.repository_name,
            baseBranch: project.repository_branch ?? 'main',
            installationId,
          },
          {
            title: `Add translations (${project.target_locales.join(', ')})`,
            // The shortfall is named in the pull request itself, because that
            // is where the reviewer is. A body reporting only what worked
            // leaves them to notice the gap by diffing key counts by hand.
            body: `Extracted ${keysExtracted} strings from ${framework}, translated ${keysTranslated} into ${localesSucceeded} locale(s).${
              keysMissing > 0
                ? `\n\nNote: ${keysMissing} string(s) were not translated and are absent from these files. Re-run to attempt them again.`
                : ''
            }`,
          },
          files,
        ),
      ),
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
    ? // `keysMissing` belongs in this condition and was absent from it. The
      // file is still written with what did arrive — a partial translation
      // merged over the existing one is better than nothing, and
      // `mergeTranslations` protects anything edited by hand. What must not
      // happen is calling it finished.
      localesFailed > 0 || keysMissing > 0
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
