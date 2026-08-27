'use client';

import { Button } from '@localize-infra/ui';
import { Search } from 'lucide-react';
import * as React from 'react';
import { type ScanState, scanProject } from './scan-actions';

/**
 * What this repository needs, before anything is spent finding out.
 *
 * The numbers are read from the repository at the moment the button is pressed
 * — the same extraction the run performs, stopping before the first model call.
 * Nothing here is an estimate and nothing is remembered: a scan is not a run,
 * so it leaves no row behind.
 *
 * The run button stays where it was. This screen answers "is it worth it?"; the
 * existing control is still the one that does it.
 */
export function ScanSection({
  orgSlug,
  projectSlug,
  canScan,
}: { orgSlug: string; projectSlug: string; canScan: boolean }) {
  const [state, action, pending] = React.useActionState<ScanState, FormData>(
    scanProject,
    {},
  );

  if (!canScan) return null;

  return (
    <section
      aria-labelledby="scan"
      className="mt-6 rounded-lg border border-line bg-surface/40 px-5 py-5"
    >
      <h2 id="scan" className="text-subtitle font-semibold text-primary">
        What needs translating
      </h2>
      <p className="mt-2 max-w-[64ch] text-small leading-6 text-secondary">
        Reads the repository and counts what is missing. No translation is
        generated and nothing is billed.
      </p>

      <form action={action} className="mt-4 flex flex-wrap items-center gap-3">
        <input type="hidden" name="orgSlug" value={orgSlug} />
        <input type="hidden" name="projectSlug" value={projectSlug} />
        <Button type="submit" variant="secondary" size="sm" disabled={pending}>
          <Search aria-hidden="true" />
          {pending ? 'Reading the repository…' : 'Scan repository'}
        </Button>

        {state.error ? (
          <span role="alert" className="text-caption text-failed-text">
            {state.error}
          </span>
        ) : null}
      </form>

      {state.scan ? (
        <div aria-live="polite" className="mt-5">
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
            <div>
              <dt className="text-caption text-tertiary">Translation keys</dt>
              <dd className="font-mono text-primary">
                {state.scan.coverage.keys}
              </dd>
            </div>
            <div>
              <dt className="text-caption text-tertiary">Target locales</dt>
              <dd className="font-mono text-primary">
                {state.scan.coverage.locales.length}
              </dd>
            </div>
            <div>
              <dt className="text-caption text-tertiary">Missing</dt>
              <dd className="font-mono text-primary">
                {state.scan.coverage.totalMissing}
              </dd>
            </div>
          </dl>

          <p className="mt-3 text-caption text-tertiary">
            {state.scan.framework} · source{' '}
            <span className="font-mono">{state.scan.sourceLocale}</span> ·{' '}
            <span className="font-mono">{state.scan.localesDir}</span>
          </p>

          {state.scan.coverage.complete ? (
            /*
             * An empty state that says what it means. "0 missing" on its own
             * reads like a failed scan; this says the repository is finished,
             * which is the good outcome.
             */
            <p className="mt-4 text-small leading-6 text-secondary">
              Every target locale has every key. There is nothing for a run to
              do until the source changes.
            </p>
          ) : (
            <>
              <ul className="mt-4 space-y-1">
                {state.scan.coverage.locales
                  .filter((locale) => locale.missing > 0)
                  .map((locale) => (
                    <li
                      key={locale.locale}
                      className="text-small text-secondary"
                    >
                      <span className="font-mono text-primary">
                        {locale.locale}
                      </span>{' '}
                      {locale.missing} missing
                      <span className="text-tertiary">
                        {' '}
                        · {locale.percent}% translated
                      </span>
                    </li>
                  ))}
              </ul>
              <p className="mt-4 max-w-[64ch] text-small leading-6 text-secondary">
                Running a localization will translate these{' '}
                {state.scan.coverage.totalMissing} string
                {state.scan.coverage.totalMissing === 1 ? '' : 's'}, check them,
                and open a pull request. Keys that already have a translation
                are left alone.
              </p>
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
