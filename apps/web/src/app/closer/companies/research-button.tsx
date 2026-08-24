'use client';

import { Button } from '@localize-infra/ui';
import { Microscope } from 'lucide-react';
import * as React from 'react';
import { type ResearchState, researchCompany } from './actions';

/**
 * Research, one company at a time.
 *
 * Per row rather than a bulk action, because reading ninety days of history is
 * the expensive half — three or four GitHub requests each — and because
 * choosing which company deserves the closer look is the reason the list shows
 * its evidence.
 */
export function ResearchButton({ companyId }: { companyId: string }) {
  const [state, action, pending] = React.useActionState<
    ResearchState,
    FormData
  >(researchCompany, {});

  return (
    <form action={action} className="mt-2 flex flex-wrap items-center gap-2">
      <input type="hidden" name="companyId" value={companyId} />
      <Button type="submit" variant="secondary" size="sm" disabled={pending}>
        <Microscope aria-hidden="true" />
        {pending ? 'Reading history…' : 'Research'}
      </Button>

      {state.error ? (
        <span role="alert" className="text-caption text-failed-text">
          {state.error}
        </span>
      ) : null}

      {state.done ? (
        <span aria-live="polite" className="text-caption text-secondary">
          {state.done.company}: pain{' '}
          <span className="font-mono">{state.done.pain}</span>/100, fit{' '}
          <span className="font-mono">{state.done.icp}</span>/
          <span className="font-mono">{state.done.assessable}</span> assessable
        </span>
      ) : null}
    </form>
  );
}
