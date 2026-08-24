import { Page, PageHeader, PageMeta, PageSection } from '@/components/page';
import { ProposalsTable } from '@/components/proposals-table';
import { RunPipeline } from '@/components/run-pipeline';
import {
  findRun,
  listRunAmbiguities,
  listRunTranslations,
  requireSession,
} from '@/lib/data/workspace';
import { pipelineStageId, runProgress } from '@/lib/runs/progress';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import {
  Badge,
  Button,
  PIPELINE_STAGES,
  type Tone,
  localeDisplayName,
} from '@localize-infra/ui';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  return { title: `Run ${id.slice(0, 8)}` };
}

const RUN_STATE: Record<string, { tone: Tone; label: string }> = {
  queued: { tone: 'neutral', label: 'Queued' },
  running: { tone: 'neutral', label: 'Running' },
  awaiting_review: { tone: 'ambiguous', label: 'Needs your call' },
  succeeded: { tone: 'confident', label: 'Succeeded' },
  partial: { tone: 'degraded', label: 'Partial' },
  failed: { tone: 'failed', label: 'Failed' },
};

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

  const state = RUN_STATE[run.status] ?? RUN_STATE.failed;
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
      progress.kind === 'finished' && run.status !== 'failed'
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
  const shortfall = Math.max(0, owed - run.keys_translated);

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
        meta={
          <>
            <PageMeta label="Status">{state?.label}</PageMeta>
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
        action={
          prHref ? (
            <Button variant="primary" size="sm" asChild>
              <a href={prHref} target="_blank" rel="noreferrer noopener">
                Pull request #{run.pr_number}
                <ExternalLink aria-hidden="true" />
              </a>
            </Button>
          ) : null
        }
      />

      {/* The next action, when there is one. A run waiting on a person is the
          one state where the page should say what to do about it. */}
      {run.status === 'awaiting_review' ? (
        <div className="mt-6 rounded-lg border border-ambiguous-border bg-ambiguous-bg px-4 py-3">
          <p className="text-body font-medium text-primary">
            {openQuestions.length === 0
              ? 'Every question is answered. This run is ready to approve.'
              : `${openQuestions.length} question${openQuestions.length === 1 ? '' : 's'} waiting on you.`}
          </p>
          <p className="mt-1 max-w-[68ch] text-small leading-6 text-secondary">
            Answering and approving happen on the run’s project page, where the
            proposal it will commit is shown alongside the questions.
          </p>
        </div>
      ) : null}

      {progress.kind === 'stalled' ? (
        <div className="mt-6 rounded-lg border border-degraded-border bg-degraded-bg px-4 py-3">
          <p className="text-body font-medium text-primary">
            This run stopped reporting{' '}
            {Math.round(progress.silentForMs / 60000)} minutes ago
          </p>
          <p className="mt-1 max-w-[68ch] text-small leading-6 text-secondary">
            The request that was carrying it probably ended. Nothing was
            committed. Start another run.
          </p>
        </div>
      ) : null}

      {/* A shortfall is not a failure and is not a success, and the status word
          says neither. Stated here because the pull request this run opened is
          missing these strings, and the reviewer is about to approve it. */}
      {shortfall > 0 ? (
        <div className="mt-6 rounded-lg border border-degraded-border bg-degraded-bg px-4 py-3">
          <p className="text-body font-medium text-primary">
            {shortfall} translation{shortfall === 1 ? '' : 's'} missing across
            the {run.locales_succeeded} language
            {run.locales_succeeded === 1 ? '' : 's'} that answered
          </p>
          <p className="mt-1 max-w-[68ch] text-small leading-6 text-secondary">
            {owed} were expected — {run.keys_extracted} string
            {run.keys_extracted === 1 ? '' : 's'} in each. The missing ones are
            absent from the files this run proposed, not translated badly.
            Running again attempts only what is still missing.
          </p>
        </div>
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
        {byLocale.size === 0 && unattempted.length === 0 ? (
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
                    className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-subtle py-3 first:border-t-0"
                  >
                    <span className="font-medium text-primary">
                      {localeDisplayName(locale)}{' '}
                      <span className="font-mono text-caption text-tertiary">
                        {locale}
                      </span>
                    </span>
                    {waiting > 0 ? (
                      <Badge tone="ambiguous">
                        {waiting} question{waiting === 1 ? '' : 's'}
                      </Badge>
                    ) : (
                      <Badge tone="confident">Translated</Badge>
                    )}
                    <span className="font-mono text-caption tabular-nums text-secondary">
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
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-subtle py-3 first:border-t-0"
              >
                <span className="font-medium text-primary">
                  {localeDisplayName(locale)}{' '}
                  <span className="font-mono text-caption text-tertiary">
                    {locale}
                  </span>
                </span>
                <Badge tone="failed">No proposals</Badge>
                <span className="font-mono text-caption tabular-nums text-secondary">
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

      {/* Verbatim, per DESIGN.md §8: the provider's own wording is what a
          customer will search for. One error per run, not per locale — that is
          what the pipeline records. */}
      {run.error ? (
        <PageSection
          title="What failed"
          description="Reported exactly as the provider returned it."
        >
          <pre className="overflow-x-auto rounded-lg border border-failed-border bg-failed-bg px-4 py-3 font-mono text-caption leading-5 text-secondary">
            {run.error}
          </pre>
        </PageSection>
      ) : null}
    </Page>
  );
}
