'use client';

import { Badge, Button, Input } from '@localize-infra/ui';
import { Search } from 'lucide-react';
import * as React from 'react';
import { type DiscoveryState, discoverCompanies } from './actions';

/**
 * Running a discovery, and reporting what it actually did.
 *
 * The result names the number searched, the number that qualified and the ones
 * skipped — because a run that reports only what it kept cannot be judged. Ten
 * candidates producing two companies is either a precise filter or a bad query,
 * and the eight names are the only way to tell which.
 */
export function DiscoverForm() {
  const [state, action, pending] = React.useActionState<
    DiscoveryState,
    FormData
  >(discoverCompanies, {});

  return (
    <div>
      <form action={action} className="flex flex-wrap items-center gap-2">
        <label htmlFor="query" className="sr-only">
          GitHub search query
        </label>
        <Input
          id="query"
          name="query"
          required
          maxLength={200}
          defaultValue="next-intl in:name,description stars:>20"
          placeholder="next-intl in:name,description stars:>20"
          className="w-full sm:w-[28rem]"
        />
        <Button type="submit" variant="primary" size="md" disabled={pending}>
          <Search aria-hidden="true" />
          {pending ? 'Searching GitHub…' : 'Discover'}
        </Button>
      </form>

      {/*
       * Stated next to the control that spends it. GitHub allows 30 searches a
       * minute and 5,000 other requests an hour; one run costs one of the
       * first and twenty of the second.
       */}
      <p className="mt-2 text-caption text-tertiary">
        Ten public repositories per run, read through GitHub&rsquo;s own API.
        Each is inspected before it is recorded — search only proposes.
      </p>

      {state.error ? (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-failed-border bg-failed-bg px-4 py-3 text-small text-primary"
        >
          {state.error}
        </p>
      ) : null}

      {state.summary ? (
        <div
          aria-live="polite"
          className="mt-3 rounded-lg border border-line bg-surface/40 px-4 py-3"
        >
          <p className="text-small text-primary">
            Searched <span className="font-mono">{state.summary.searched}</span>
            , <span className="font-mono">{state.summary.qualified}</span>{' '}
            qualified,{' '}
            <span className="font-mono">{state.summary.recorded}</span>{' '}
            recorded.
          </p>
          {state.summary.skipped.length > 0 ? (
            <details className="mt-2">
              <summary className="cursor-pointer text-caption text-tertiary">
                {state.summary.skipped.length} skipped
              </summary>
              <ul className="mt-2 space-y-1">
                {state.summary.skipped.map((name) => (
                  <li
                    key={name}
                    className="font-mono text-caption text-secondary"
                  >
                    {name}
                  </li>
                ))}
              </ul>
            </details>
          ) : (
            <p className="mt-1 text-caption text-tertiary">
              <Badge tone="confident">Nothing skipped</Badge>
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
