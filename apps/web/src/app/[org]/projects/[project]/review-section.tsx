'use client';

import type {
  AmbiguityRecord,
  ProposedTranslation,
} from '@/lib/data/workspace';
import {
  Badge,
  Button,
  StateRule,
  cn,
  localeDisplayName,
  localeFontClass,
  localeTextProps,
} from '@localize-infra/ui';
import { Check, ExternalLink, GitPullRequest } from 'lucide-react';
import * as React from 'react';
import {
  type AmbiguityState,
  approveRun,
  resolveAmbiguity,
} from './ambiguity-actions';

/**
 * The review gate, as a surface.
 *
 * The pipeline already refuses to open a pull request while a question is
 * open — `approveRun` re-checks it server-side, because a form body is
 * something anyone can post. This screen is where the questions get answered
 * and where the proposal is read before it becomes a commit.
 *
 * Everything shown is a real row: the questions come from `run_ambiguities`,
 * the proposal from `run_translations`. Approving commits those rows verbatim
 * rather than re-running the model, which is the difference between a review
 * and a picture of one.
 */
export function ReviewSection({
  runId,
  org,
  project,
  ambiguities,
  proposals,
}: {
  runId: string;
  org: string;
  project: string;
  ambiguities: AmbiguityRecord[];
  proposals: ProposedTranslation[];
}) {
  const open = ambiguities.filter((a) => a.state === 'unresolved');
  const byLocale = new Map<string, ProposedTranslation[]>();
  for (const row of proposals) {
    byLocale.set(row.locale, [...(byLocale.get(row.locale) ?? []), row]);
  }

  return (
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-subtitle font-semibold text-primary">
            Waiting for your call
          </h2>
          <p className="mt-1 max-w-[68ch] text-small text-secondary">
            This run stopped rather than guessing. Answer what it asked, read
            what it proposes, then open the pull request.
          </p>
        </div>
        <Badge tone={open.length > 0 ? 'ambiguous' : 'confident'}>
          {open.length > 0
            ? `${open.length} unanswered`
            : 'Every question answered'}
        </Badge>
      </div>

      {ambiguities.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {ambiguities.map((item) => (
            <li key={item.id}>
              <AmbiguityCard item={item} org={org} project={project} />
            </li>
          ))}
        </ul>
      ) : null}

      <ProposalSummary byLocale={byLocale} />

      <ApproveForm
        runId={runId}
        org={org}
        project={project}
        blocked={open.length}
      />
    </section>
  );
}

/** One question, its alternatives, and the two ways to settle it. */
function AmbiguityCard({
  item,
  org,
  project,
}: {
  item: AmbiguityRecord;
  org: string;
  project: string;
}) {
  const [state, action, pending] = React.useActionState<
    AmbiguityState,
    FormData
  >(resolveAmbiguity, {});
  const [choice, setChoice] = React.useState(item.proposed_text);
  const settled = item.state !== 'unresolved';

  return (
    <StateRule
      tone={settled ? 'confident' : 'ambiguous'}
      className={cn(
        'rounded-e-lg border border-s-0 border-subtle py-4 pe-4',
        settled && 'opacity-70',
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="font-mono text-caption text-tertiary">
          {item.translation_key}
        </p>
        <span className="font-mono text-micro uppercase tracking-wide text-tertiary">
          {localeDisplayName(item.locale)}
        </span>
      </div>

      <p className="mt-1.5 text-subtitle font-medium text-primary">
        {item.source_text}
      </p>
      <p className="mt-1.5 max-w-[68ch] text-small leading-6 text-secondary">
        {item.question}
      </p>

      {settled ? (
        <p className="mt-3 text-small text-secondary">
          {item.state === 'resolved' ? (
            <>
              Answered:{' '}
              <span
                {...localeTextProps(item.locale)}
                className={cn('text-primary', localeFontClass(item.locale))}
              >
                {item.resolved_text}
              </span>
            </>
          ) : (
            <>
              Kept the suggestion:{' '}
              <span
                {...localeTextProps(item.locale)}
                className={cn('text-primary', localeFontClass(item.locale))}
              >
                {item.proposed_text}
              </span>
            </>
          )}
        </p>
      ) : (
        <form action={action} className="mt-3">
          <input type="hidden" name="ambiguityId" value={item.id} />
          <input type="hidden" name="org" value={org} />
          <input type="hidden" name="project" value={project} />

          <fieldset className="flex flex-col gap-2">
            <legend className="sr-only">
              Readings for {item.translation_key}
            </legend>
            {[
              {
                text: item.proposed_text,
                rationale: 'What the model proposed',
              },
              ...item.alternatives,
            ].map((option, i) => (
              <label
                key={option.text}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5',
                  choice === option.text
                    ? 'border-strong bg-surface'
                    : 'border-subtle',
                )}
              >
                <input
                  type="radio"
                  name="resolvedText"
                  value={option.text}
                  checked={choice === option.text}
                  onChange={() => setChoice(option.text)}
                  className="mt-1 size-3.5 shrink-0 accent-[var(--state-ambiguous)]"
                />
                <span className="min-w-0">
                  <span
                    {...localeTextProps(item.locale)}
                    className={cn(
                      'block text-body text-primary',
                      localeFontClass(item.locale),
                    )}
                  >
                    {option.text}
                  </span>
                  <span className="mt-0.5 block text-caption leading-5 text-tertiary">
                    {option.rationale}
                  </span>
                </span>
                <span className="ms-auto shrink-0 font-mono text-micro text-tertiary">
                  {i + 1}
                </span>
              </label>
            ))}
          </fieldset>

          {state.error ? (
            <p role="alert" className="mt-2 text-small text-failed-text">
              {state.error}
            </p>
          ) : null}

          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Button
              type="submit"
              name="intent"
              value="resolve"
              size="sm"
              variant="primary"
              disabled={pending}
            >
              <Check aria-hidden="true" />
              Use this reading
            </Button>
            <Button
              type="submit"
              name="intent"
              value="dismiss"
              size="sm"
              variant="secondary"
              disabled={pending}
            >
              Keep the suggestion
            </Button>
          </div>
        </form>
      )}
    </StateRule>
  );
}

/**
 * What the pull request will contain.
 *
 * Counts rather than every string: a run over four locales is hundreds of
 * rows, and the question this answers is "how much is about to change, and
 * where" — the diff itself is what the pull request is for.
 */
function ProposalSummary({
  byLocale,
}: {
  byLocale: Map<string, ProposedTranslation[]>;
}) {
  if (byLocale.size === 0) return null;

  return (
    <div className="mt-6 rounded-lg border border-subtle">
      <p className="border-b border-subtle px-4 py-2.5 text-eyebrow font-medium uppercase text-tertiary">
        Ready to commit
      </p>
      <ul>
        {[...byLocale.entries()]
          .sort(([a], [b]) => (a < b ? -1 : 1))
          .map(([locale, rows]) => {
            const preserved = rows.filter(
              (r) => r.origin === 'preserved',
            ).length;
            return (
              <li
                key={locale}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-subtle px-4 py-2.5 first:border-t-0"
              >
                <span className="font-mono text-caption text-primary">
                  {locale}.json
                </span>
                <span className="text-caption text-tertiary">
                  {rows.length} {rows.length === 1 ? 'key' : 'keys'}
                  {preserved > 0 ? ` · ${preserved} kept as they were` : null}
                </span>
              </li>
            );
          })}
      </ul>
    </div>
  );
}

/** The gate itself. Disabled while anything is unanswered, and refused server-side too. */
function ApproveForm({
  runId,
  org,
  project,
  blocked,
}: {
  runId: string;
  org: string;
  project: string;
  blocked: number;
}) {
  const [state, action, pending] = React.useActionState(approveRun, {});

  return (
    <form action={action} className="mt-6">
      <input type="hidden" name="runId" value={runId} />
      <input type="hidden" name="org" value={org} />
      <input type="hidden" name="project" value={project} />

      {state.error ? (
        <p role="alert" className="mb-3 text-small text-failed-text">
          {state.error}
        </p>
      ) : null}

      {state.prUrl ? (
        <p className="mb-3 text-small text-confident-text">
          Pull request opened.{' '}
          <a
            href={state.prUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 underline underline-offset-2"
          >
            Open it on GitHub
            <ExternalLink className="size-3.5" aria-hidden="true" />
          </a>
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending || blocked > 0}>
          <GitPullRequest aria-hidden="true" />
          {pending ? 'Opening…' : 'Approve and open the pull request'}
        </Button>
        {blocked > 0 ? (
          <span className="text-small text-tertiary">
            {blocked === 1
              ? 'One question is still unanswered.'
              : `${blocked} questions are still unanswered.`}
          </span>
        ) : null}
      </div>
    </form>
  );
}
