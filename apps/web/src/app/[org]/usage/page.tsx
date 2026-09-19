import { Page, PageHeader, PageMeta } from '@/components/page';
import { RunsTable } from '@/components/runs-table';
import { findOrganization, requireSession } from '@/lib/data/workspace';
import { toRunTableRow } from '@/lib/runs/table-row';
import { loadUsage } from '@/lib/usage/load';
import { describeLastUsed } from '@/lib/usage/summary';
import { Badge } from '@localize-infra/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const metadata: Metadata = { title: 'Usage' };

/**
 * What this workspace has spent against the ceiling that can refuse it.
 *
 * ## This is not a meter, and the distinction is load-bearing
 *
 * Invariant 3 forbids billing by word, character, key or reviewer, and the PRD
 * forbids metering them "not even as a displayed statistic". Nothing here is
 * billed, nothing accumulates into an invoice, and no figure on this page
 * changes what anybody pays — the plan is flat and `/[org]/billing` still says
 * no price exists.
 *
 * What these numbers *are* is the denominator of a refusal. The hosted API
 * stops a workspace at 5000 strings a day to kill runaway scripts, `/pricing`
 * names that ceiling in public, and until now a member could hit it with no way
 * to see where they stood. A limit somebody can hit and cannot see is the kind
 * of claim this repository does not leave standing.
 *
 * The migration that created these counters anticipated exactly this surface:
 * it granted `api_usage_daily` to members and `api_limits()` to `authenticated`
 * with the note "a workspace reading its own usage needs the denominator".
 *
 * ## It reads; it never recounts
 *
 * Every figure comes from `api_usage_daily`, the row `consume_api_quota` writes
 * as it charges. Nothing is re-derived from `runs` or `run_translations`: a
 * second tally would be free to disagree with the one the ceiling is enforced
 * against, and the disagreement would show up as a page promising budget the
 * API refuses.
 *
 * ## Colour
 *
 * DESIGN.md §6.3: colour reports the state of something that exists. Being
 * under the ceiling is not a state worth a colour — a bar shading from green to
 * red would be encoding a plan position, not a fact. Only *reaching* the
 * ceiling gets a tone, because at that point the refusal is real and present.
 */
export default async function UsagePage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  await requireSession();
  const { org } = await params;

  const organization = await findOrganization(org);
  // A workspace that exists but is not yours must look like one that does not.
  if (!organization) notFound();

  const { summary, runs, tokens, limitsUnavailable } = await loadUsage(
    organization.id,
  );
  const { today, month, limits } = summary;

  const rows = runs.map(toRunTableRow);
  const usedTokens = tokens.filter((token) => token.last_used_at !== null);

  return (
    <Page>
      <PageHeader
        title="Usage"
        purpose="What this workspace has spent against the hosted API's daily ceiling. Nothing here is billed."
        meta={
          <>
            <PageMeta label="Workspace">{organization.name}</PageMeta>
            <PageMeta label="UTC day">{summary.todayDate}</PageMeta>
          </>
        }
      />

      <section aria-labelledby="today" className="mt-6">
        <h2 id="today" className="text-subtitle font-semibold text-primary">
          Today
        </h2>
        <p className="mt-1 max-w-[64ch] text-small leading-6 text-secondary">
          The ceiling exists to stop a runaway script, not to charge you. It
          resets at 00:00 UTC, and it lifts on request.
        </p>

        {limitsUnavailable ? (
          /*
           * No denominator, so none is printed. Saying "0 of 0" would be a
           * fabricated ceiling, and inventing 5000 here would be a number this
           * page believes rather than one the database enforces.
           */
          <p
            className="mt-4 max-w-[64ch] rounded-md border border-line bg-surface/40 px-4 py-3 text-small leading-6 text-secondary"
            data-testid="limits-unavailable"
          >
            The hosted API's limits could not be read, so this page will not
            claim what they are. The figures below are still this workspace's
            real spending.
          </p>
        ) : null}

        <dl
          className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2"
          data-testid="today-totals"
        >
          <div data-testid="today-strings">
            <dt className="text-caption text-tertiary">Strings translated</dt>
            <dd className="mt-1 flex flex-wrap items-baseline gap-2">
              <span className="font-mono text-title text-primary">
                {today.strings.toLocaleString('en-US')}
              </span>
              {limitsUnavailable ? null : (
                <span className="font-mono text-body text-tertiary">
                  of {limits.strings_per_day.toLocaleString('en-US')}
                </span>
              )}
              {summary.atStringCeiling ? (
                <Badge tone="degraded">Ceiling reached</Badge>
              ) : null}
            </dd>
          </div>

          <div data-testid="today-prs">
            <dt className="text-caption text-tertiary">Pull requests opened</dt>
            <dd className="mt-1 flex flex-wrap items-baseline gap-2">
              <span className="font-mono text-title text-primary">
                {today.pullRequests.toLocaleString('en-US')}
              </span>
              {limitsUnavailable ? null : (
                <span className="font-mono text-body text-tertiary">
                  of {limits.prs_per_day.toLocaleString('en-US')}
                </span>
              )}
              {summary.atPullRequestCeiling ? (
                <Badge tone="degraded">Ceiling reached</Badge>
              ) : null}
            </dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="month" className="mt-8">
        <h2 id="month" className="text-subtitle font-semibold text-primary">
          This month
        </h2>
        <p className="mt-1 max-w-[64ch] text-small leading-6 text-secondary">
          No monthly ceiling exists — this is the total, for your own reference.
        </p>
        <dl
          className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-3"
          data-testid="month-totals"
        >
          <div>
            <dt className="text-caption text-tertiary">Strings translated</dt>
            <dd className="mt-1 font-mono text-title text-primary">
              {month.strings.toLocaleString('en-US')}
            </dd>
          </div>
          <div>
            <dt className="text-caption text-tertiary">Pull requests opened</dt>
            <dd className="mt-1 font-mono text-title text-primary">
              {month.pullRequests.toLocaleString('en-US')}
            </dd>
          </div>
          <div>
            <dt className="text-caption text-tertiary">Days with activity</dt>
            <dd className="mt-1 font-mono text-title text-primary">
              {month.activeDays}
            </dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="runs" className="mt-8">
        <h2 id="runs" className="text-subtitle font-semibold text-primary">
          Recent runs
        </h2>
        <p className="mt-1 max-w-[64ch] text-small leading-6 text-secondary">
          The last {rows.length === 0 ? 'few' : rows.length} in this workspace.{' '}
          <Link
            href="/runs"
            className="text-link underline underline-offset-2 hover:text-link-hover"
          >
            Every run
          </Link>
          .
        </p>
        <div className="mt-4">
          {/*
            The same component /runs uses, not a second table of the same
            object (DESIGN.md §8). It brings its own filter, search and
            URL-addressable sort, so this surface is complete without
            reimplementing any of them.
          */}
          <RunsTable runs={rows} />
        </div>
      </section>

      <section aria-labelledby="tokens" className="mt-8">
        <h2 id="tokens" className="text-subtitle font-semibold text-primary">
          CLI tokens
        </h2>
        <p className="mt-1 max-w-[64ch] text-small leading-6 text-secondary">
          When each token last reached the API.{' '}
          <Link
            href={`/${org}/tokens`}
            className="text-link underline underline-offset-2 hover:text-link-hover"
          >
            Manage tokens
          </Link>
          .
        </p>

        {tokens.length === 0 ? (
          <p className="mt-3 text-small text-secondary">
            No tokens in this workspace yet.
          </p>
        ) : (
          <ul className="mt-3 border-t border-subtle">
            {tokens.map((token) => (
              <li
                key={token.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-subtle px-1 py-3"
                data-testid="token-use"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-body text-primary">
                    {token.name}
                  </span>
                  <span className="mt-0.5 block font-mono text-caption text-tertiary">
                    {token.token_prefix}…
                  </span>
                </span>
                <span
                  className="font-mono text-caption text-secondary"
                  data-testid="token-last-used"
                >
                  {describeLastUsed(token.last_used_at)}
                </span>
                {token.revoked_at ? (
                  <Badge tone="neutral">Revoked</Badge>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {tokens.length > 0 && usedTokens.length === 0 ? (
          <p className="mt-3 max-w-[64ch] text-caption leading-5 text-tertiary">
            None of them has been used yet. `last_used_at` is stamped the first
            time a token reaches the API, so this stays empty until one does.
          </p>
        ) : null}
      </section>
    </Page>
  );
}
