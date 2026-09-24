import { Button, StateRule, type Tone } from '@localize-infra/ui';
import { ExternalLink } from 'lucide-react';
import type * as React from 'react';

/**
 * What this run's state is, said once and said first.
 *
 * It used to be the word `Needs your call` in a metadata row, typographically
 * identical to the timestamp two columns along — five facts at one weight, of
 * which one is the answer to the question every reader opens this page with and
 * four are measurements. §3.5 is about hierarchy contrast and this was its
 * plainest failure: the page had no dominant element at all.
 *
 * It also had no State Rule, on the surface this product exists to make
 * legible. §1.4 calls the rule the signature and says it goes everywhere copy
 * appears; the run detail is where confidence is the whole subject.
 *
 * ## The pull request moves here
 *
 * It was the header's `action`. An action floating beside a title is a control;
 * the same button beside the sentence explaining the state is an outcome, which
 * is what a pull request is in this product (invariant 2). One primary action
 * per surface, §8, and this is it.
 *
 * ## The repository is derived, not fetched
 *
 * `RUN_SELECT` carries no `project_id` and no join, so the run record genuinely
 * does not know which repository it touched — and adding a column and a query
 * to this page would be a schema-shaped answer to a layout question. The pull
 * request URL already contains it, parsed and origin-checked by
 * `asGitHubPullRequest` before it reaches here, so a run that opened one can
 * say where it landed for free. A run that opened none says nothing, rather
 * than guessing.
 */
export interface RunStatusBandProps {
  tone: Tone;
  label: string;
  /** One line: what the state means, or what to do about it. */
  detail: React.ReactNode;
  /** An already-validated github.com pull request URL, or null. */
  prHref: string | null;
  prNumber: number | null;
}

/** `owner/name` out of a pull request URL that has already been vetted. */
export function repositoryFrom(prHref: string | null): string | null {
  if (!prHref) return null;
  const parts = new URL(prHref).pathname.split('/');
  // `/owner/name/pull/123` → ['', 'owner', 'name', 'pull', '123']. The shape is
  // guaranteed by the caller's regex; this only reads it.
  return parts.length >= 3 ? `${parts[1]}/${parts[2]}` : null;
}

export function RunStatusBand({
  tone,
  label,
  detail,
  prHref,
  prNumber,
}: RunStatusBandProps) {
  const repository = repositoryFrom(prHref);

  return (
    <StateRule
      tone={tone}
      className="mt-6 rounded-e-lg bg-surface/40 py-5 pe-5"
      /*
       * Not `role="status"`. This is page content that was there at render, not
       * a live update — the same reasoning `github-result.tsx` records for the
       * same shape. A run that changes state does so on a reload.
       */
    >
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          <p className="text-title font-semibold text-primary">{label}</p>
          <p className="mt-1.5 max-w-[68ch] text-small leading-6 text-secondary">
            {detail}
          </p>
        </div>

        {prHref && prNumber !== null ? (
          <Button variant="primary" size="sm" asChild>
            <a href={prHref} target="_blank" rel="noreferrer noopener">
              Pull request #{prNumber}
              <ExternalLink aria-hidden="true" />
            </a>
          </Button>
        ) : null}
      </div>

      {repository ? (
        <p className="mt-4 truncate font-mono text-caption text-tertiary">
          {repository}
        </p>
      ) : null}
    </StateRule>
  );
}
