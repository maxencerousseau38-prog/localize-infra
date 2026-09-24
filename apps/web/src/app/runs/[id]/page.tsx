import { Page, PageHeader, PageMeta, PageSection } from '@/components/page';
import { ProposalsTable } from '@/components/proposals-table';
import { RunPipeline } from '@/components/run-pipeline';
import {
  findRun,
  listRunAmbiguities,
  listRunTranslations,
  requireSession,
} from '@/lib/data/workspace';
import {
  type RunStatus,
  pipelineStageId,
  runProgress,
} from '@/lib/runs/progress';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import {
  Alert,
  Badge,
  Button,
  PIPELINE_STAGES,
  type Tone,
  localeDisplayName,
} from '@localize-infra/ui';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { RunStatusBand } from './run-status';

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  return { title: `Run ${id.slice(0, 8)}` };
}

/**
 * `meaning` is what the status band says under the label.
 *
 * A sentence per state, and each one is a claim, so each is narrower than the
 * obvious phrasing. `failed` does not say "nothing was committed": a run can
 * stop at `open_pr` with translations already recorded, and the only honest
 * statement is where it stopped. `succeeded` has two readings because a
 * succeeded run may or may not have been asked to open a pull request, and the
 * page knows which from the URL rather than from the status.
 */
const RUN_STATE: Record<
  RunStatus,
  { tone: Tone; label: string; meaning: string }
> = {
  queued: {
    tone: 'neutral',
    label: 'Queued',
    meaning: 'Waiting to start. Nothing has been extracted yet.',
  },
  running: {
    tone: 'neutral',
    label: 'Running',
    meaning:
      'In progress. This page does not refresh itself — reload to see where it reached.',
  },
  awaiting_review: {
    tone: 'ambiguous',
    label: 'Needs your call',
    // Replaced at render with the question count. Kept non-empty so the map
    // stays exhaustive and a missing branch is a blank line, not a crash.
    meaning: 'The run stopped to ask something before it could finish.',
  },
  succeeded: {
    tone: 'confident',
    label: 'Succeeded',
    meaning: 'Every target language came back translated.',
  },
  partial: {
    tone: 'degraded',
    label: 'Partial',
    meaning:
      'Some languages did not come back. The ones that did are recorded below.',
  },
  failed: {
    tone: 'failed',
    label: 'Failed',
    meaning: 'The run stopped before finishing. What it recorded is below.',
  },
  no_changes: {
    tone: 'neutral',
    label: 'No changes needed',
    meaning:
      'Every key already had a translation, so there was nothing to commit.',
  },
};

/**
 * Guards the one place a run's stored status crosses into this exhaustive
 * map. `RUN_STATE` is now `Record<RunStatus, …>`, so a status this file knows
 * about but forgot to render is a compile error — that is the point. But
 * `runs` has no generated types (see `database.types.ts`), so `findRun` casts
 * its row to `RunRecord` without checking the enum at runtime: a value
 * Postgres accepts that this union does not yet know about would otherwise
 * index `RUN_STATE` with a key it does not have and throw, taking the whole
 * page down instead of mis-rendering one badge. This is the runtime half of
 * that safety; `Record<RunStatus, …>` above is the compile-time half.
 */
function isKnownRunStatus(status: string): status is RunStatus {
  return status in RUN_STATE;
}

function duration(ms: number | null): string {
  if (ms === null) return '—';
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Whether a stored value may become a live link.
 *
 * The database constrains `pr_url` to a github.com pull request, so this is the
 * second lock rather than the only one. Parsed rather than pattern-matched:
 * `new URL` resolves the scheme the way the browser will.
 */
function asGitHubPullRequest(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return null;
    if (url.hostname !== 'github.com') return null;
    if (!/^\/[^/]+\/[^/]+\/pull\/\d+$/.test(url.pathname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * One run, as it was actually recorded.
 *
 * This read `SAMPLE_RUN_DETAILS[id]` — a fixture keyed by three invented ids,
 * carrying a trigger command, per-stage results and per-locale errors that no
 * run ever produced. Every one of those is now a real column or a real row:
 * `runs`, `run_translations`, `run_ambiguities`. RLS confines the lookup, so a
 * run belonging to another workspace is a 404 rather than a permission error —
 * a workspace that exists but is not yours must be indistinguishable from one
 * that does not.
 *
 * Two things the fixture had that a real run does not, and which are therefore
 * absent rather than approximated: a `trigger` command string, because runs are
 * started from a project page, and a per-locale error, because the pipeline
 * records one error for the run rather than one per language.
 */
export default async function RunDetailPage({ params }: Params) {
  // A run detail with no database has no run to detail. 404 rather than a
  // sentence: the id in the URL names something that cannot exist here.
  if (!isSupabaseConfigured()) notFound();

  await requireSession();
  const { id } = await params;

  const run = await findRun(id);
  if (!run) notFound();

  const [ambiguities, proposals] = await Promise.all([
    listRunAmbiguities(run.id),
    listRunTranslations(run.id),
  ]);

  const state = isKnownRunStatus(run.status)
    ? RUN_STATE[run.status]
    : RUN_STATE.failed;
  const progress = runProgress({
    status: run.status,
    stage: run.stage,
    progressAt: run.progress_at,
  });
  const prHref = asGitHubPullRequest(run.pr_url);

  const elapsed =
    run.started_at && run.finished_at
      ? Date.parse(run.finished_at) - Date.parse(run.started_at)
      : null;

  // Reached, in progress, or not yet: derived from where the run actually got
  // to rather than from a stored per-stage list, which no run writes.
  const reachedIndex = PIPELINE_STAGES.findIndex(
    (s) => s.id === pipelineStageId(run.stage),
  );
  const stages = PIPELINE_STAGES.map((stage, i) => ({
    id: stage.id,
    name: stage.name,
    state:
      // `no_changes` reaches `finished` without opening a pull request — it
      // stops at `translate` on purpose (see run-actions.ts) — so it must not
      // take this branch, or the Pull request stage paints itself done for a
      // run that never touched it. `reachedIndex` already knows where it
      // stopped; let it govern instead.
      progress.kind === 'finished' &&
      run.status !== 'failed' &&
      run.status !== 'no_changes'
        ? ('done' as const)
        : i < reachedIndex
          ? ('done' as const)
          : i === reachedIndex
            ? run.status === 'failed'
              ? ('failed' as const)
              : ('active' as const)
            : ('pending' as const),
  }));

  const byLocale = new Map<string, number>();
  for (const row of proposals) {
    byLocale.set(row.locale, (byLocale.get(row.locale) ?? 0) + 1);
  }
  const openQuestions = ambiguities.filter((a) => a.state === 'unresolved');

  /*
   * The languages the run was asked for and never delivered.
   *
   * `locales_failed` counts them and cannot name them. This can: a target with
   * no proposals produced nothing, whatever the counter says. Naming them is
   * the difference between "Partial" — a word that tells a reader to go
   * looking — and knowing which language to re-run.
   */
  const unattempted = run.target_locales.filter((l) => !byLocale.has(l));

  /*
   * Translations the run owed and did not deliver.
   *
   * `keys_extracted` and `keys_translated` are **not the same unit**, and
   * subtracting one from the other — the obvious move — is meaningless.
   * `run-actions.ts` sets the first to `Object.keys(fresh).length`, distinct
   * source strings, and accumulates the second across locales
   * (`keysTranslated += body.translations.length`). The seeded run makes the
   * trap visible: 1 extracted, 2 translated, nothing missing.
   *
   * So the comparison is against what the succeeded locales owed. Locales that
   * delivered nothing are excluded on purpose — they are counted by
   * `locales_failed` and named by `unattempted` below, and folding them in here
   * would report the same gap twice.
   *
   * The pipeline does compute the exact figure, as `keysMissing`, and no column
   * stores it. This derivation is the closest honest thing until one does.
   */
  const owed = run.keys_extracted * run.locales_succeeded;
  // `no_changes` succeeds every locale and translates nothing, by design —
  // every key already had a value. Without this guard the arithmetic above
  // reads that as a shortfall the size of the whole catalogue instead of the
  // zero it is.
  const shortfall =
    run.status === 'no_changes' ? 0 : Math.max(0, owed - run.keys_translated);

  /*
   * The sentence under the status label.
   *
   * Two states know more than the map can: `awaiting_review` knows how many
   * questions are open, and this is the copy the separate Iris notice used to
   * carry — moved here rather than reworded, so the page says it once instead
   * of stating the state in the band and restating it in a box underneath.
   * `succeeded` knows whether a pull request exists, which the status alone
   * does not: a run can translate everything and never be asked to open one.
   */
  const meaning =
    run.status === 'awaiting_review'
      ? openQuestions.length === 0
        ? 'Every question is answered. This run is ready to approve. Answering and approving happen on the run’s project page, where the proposal it will commit is shown alongside the questions.'
        : `${openQuestions.length} question${openQuestions.length === 1 ? '' : 's'} waiting on you. Answering and approving happen on the run’s project page, where the proposal it will commit is shown alongside the questions.`
      : run.status === 'succeeded' && !prHref
        ? 'Every target language came back translated. No pull request was opened for this run.'
        : state.meaning;

  return (
    <Page>
      <div className="pt-6">
        <Button asChild variant="ghost" size="sm">
          <Link href="/runs">
            <ArrowLeft aria-hidden="true" />
            All runs
          </Link>
        </Button>
      </div>

      <PageHeader
        title={`Run ${run.id.slice(0, 8)}`}
        purpose={run.framework ?? undefined}
        /*
         * `Status` is gone from here. It was one of five labelled facts,
         * indistinguishable from the timestamp, and it is now the band below —
         * with a rule, a tone and a sentence. What is left in this row is
         * measurements, which is what a metadata row is for.
         */
        meta={
          <>
            <PageMeta label="Duration">{duration(elapsed)}</PageMeta>
            {/* Distinct source strings. Deliberately not "translated of
                extracted": those two columns count different things, and a
                ratio between them would read as a completeness figure while
                being arithmetic on mismatched units. */}
            <PageMeta label="Strings">{run.keys_extracted || '—'}</PageMeta>
            {run.source_locale ? (
              <PageMeta label="From">
                {localeDisplayName(run.source_locale)}
              </PageMeta>
            ) : null}
            <PageMeta label="When">
              {new Date(run.created_at)
                .toISOString()
                .slice(0, 16)
                .replace('T', ' ')}
            </PageMeta>
          </>
        }
      />

      <RunStatusBand
        tone={state.tone}
        label={state.label}
        detail={meaning}
        prHref={prHref}
        prNumber={run.pr_number}
      />

      {/*
        The failure, immediately after the state that reports it.
        ────────────────────────────────────────────────────────
        It was the last section on the page, below the pipeline, the locales and
        a table of every proposal — justified at the time as "the reason to stop
        reading". For a run that failed it is the reason to *start*: a reader
        who came to find out why has to scroll past three sections of what did
        work, one of which can be hundreds of rows.

        Verbatim, per §8, and unchanged: the provider's own wording is what a
        customer will search for. One error per run, not per locale — that is
        what the pipeline records.
      */}
      {run.error ? (
        <PageSection
          title="What failed"
          description="Reported exactly as the provider returned it."
        >
          <pre className="overflow-x-auto rounded-lg border border-failed bg-failed-bg px-4 py-3 font-mono text-caption leading-5 text-secondary">
            {run.error}
          </pre>
        </PageSection>
      ) : null}

      {/*
        The Iris notice that stood here is gone, and its copy is not.
        ─────────────────────────────────────────────────────────────
        It said "N questions waiting on you" in a box directly beneath a status
        row that already said "Needs your call" — the state twice, in two
        registers, neither of them dominant. The band above now carries both the
        state and the sentence, so the page makes the claim once.

        Nothing was reworded: the same count and the same "project page"
        pointer, which is what the end-to-end suite asserts and, more to the
        point, what a reader needs. This surface cannot resolve an ambiguity; it
        can only say where that happens.
      */}

      {progress.kind === 'stalled' ? (
        <Alert
          tone="degraded"
          size="section"
          className="mt-6"
          heading={
            <>
              This run stopped reporting{' '}
              {Math.round(progress.silentForMs / 60000)} minutes ago
            </>
          }
        >
          The request that was carrying it probably ended. Nothing was
          committed. Start another run.
        </Alert>
      ) : null}

      {/* A shortfall is not a failure and is not a success, and the status word
          says neither. Stated here because the pull request this run opened is
          missing these strings, and the reviewer is about to approve it. */}
      {shortfall > 0 ? (
        <Alert
          tone="degraded"
          size="section"
          className="mt-6"
          heading={
            <>
              {shortfall} translation{shortfall === 1 ? '' : 's'} missing across
              the {run.locales_succeeded} language
              {run.locales_succeeded === 1 ? '' : 's'} that answered
            </>
          }
        >
          {owed} were expected — {run.keys_extracted} string
          {run.keys_extracted === 1 ? '' : 's'} in each. The missing ones are
          absent from the files this run proposed, not translated badly. Running
          again attempts only what is still missing.
        </Alert>
      ) : null}

      <PageSection
        title="Pipeline"
        description="What this run did, in the order it did it."
      >
        <div className="rounded-lg border border-subtle p-5">
          <RunPipeline stages={stages} />
        </div>
      </PageSection>

      <PageSection
        title="Locales"
        description="What the run proposed for each target language."
      >
        {run.status === 'no_changes' ? (
          // The branch that reaches `no_changes` returns before recording any
          // proposal (run-actions.ts), so `byLocale` is empty and every target
          // locale would otherwise fall into `unattempted` below and render a
          // red "No proposals" badge — the same red a locale that genuinely
          // failed gets. Every target locale did succeed here; there was
          // nothing left to translate.
          <p className="text-small text-tertiary">
            Every key already had a translation. Nothing was proposed.
          </p>
        ) : byLocale.size === 0 && unattempted.length === 0 ? (
          <p className="text-small text-tertiary">
            This run recorded no proposals.
          </p>
        ) : (
          <ul>
            {[...byLocale.entries()]
              .sort(([a], [b]) => (a < b ? -1 : 1))
              .map(([locale, count]) => {
                const waiting = openQuestions.filter(
                  (q) => q.locale === locale,
                ).length;
                return (
                  <li
                    key={locale}
                    /*
                     * Columns, not `justify-between`.
                     *
                     * Three children spread across the full width put the badge
                     * at a different x on every row — its position was a
                     * function of how long the language name happened to be, so
                     * a reader scanning states had to read each row instead of
                     * the column. Fixed widths from `sm` up align them; below
                     * it they wrap, which is what §12 asks for rather than
                     * shrinking a desktop row.
                     */
                    className="flex flex-wrap items-baseline gap-x-4 gap-y-1.5 border-t border-subtle py-3 first:border-t-0"
                  >
                    <span className="min-w-0 flex-1 truncate font-medium text-primary">
                      {localeDisplayName(locale)}{' '}
                      <span className="font-mono text-caption text-tertiary">
                        {locale}
                      </span>
                    </span>
                    <span className="shrink-0 sm:w-[10rem]">
                      {waiting > 0 ? (
                        <Badge tone="ambiguous">
                          {waiting} question{waiting === 1 ? '' : 's'}
                        </Badge>
                      ) : (
                        <Badge tone="confident">Translated</Badge>
                      )}
                    </span>
                    <span className="shrink-0 font-mono text-caption tabular-nums text-secondary sm:w-[4.5rem] sm:text-end">
                      {count} key{count === 1 ? '' : 's'}
                    </span>
                  </li>
                );
              })}

            {/* Asked for, never delivered. Listed alongside the rest rather
                than in a section of their own: a reader scanning target
                languages should find all of them in one place, with the ones
                that produced nothing marked instead of missing. */}
            {unattempted.sort().map((locale) => (
              <li
                key={locale}
                className="flex flex-wrap items-baseline gap-x-4 gap-y-1.5 border-t border-subtle py-3 first:border-t-0"
              >
                <span className="min-w-0 flex-1 truncate font-medium text-primary">
                  {localeDisplayName(locale)}{' '}
                  <span className="font-mono text-caption text-tertiary">
                    {locale}
                  </span>
                </span>
                <span className="shrink-0 sm:w-[10rem]">
                  <Badge tone="failed">No proposals</Badge>
                </span>
                <span className="shrink-0 font-mono text-caption tabular-nums text-secondary sm:w-[4.5rem] sm:text-end">
                  0 keys
                </span>
              </li>
            ))}
          </ul>
        )}
      </PageSection>

      {/* Every proposal the run recorded.
          Placed after Locales, which summarises, and before the failure, which
          is the reason to stop reading. The rows were already being fetched to
          produce the counts above. */}
      {proposals.length > 0 ? (
        <PageSection
          title="Proposals"
          description="Every string this run would write, exactly as it would write it."
        >
          <ProposalsTable proposals={proposals} />
        </PageSection>
      ) : null}
    </Page>
  );
}
