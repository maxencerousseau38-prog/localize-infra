'use client';

import { Button, Field, Input } from '@localize-infra/ui';
import { useActionState } from 'react';
import { type WorkspaceState, createWorkspace } from './actions';

const EMPTY: WorkspaceState = {};

export function WorkspaceForm() {
  const [state, action, pending] = useActionState(createWorkspace, EMPTY);

  return (
    <form action={action} className="mt-8 flex flex-col gap-6">
      <Field
        label="Workspace name"
        required
        help="Used to build the address. You can change the name later."
      >
        <Input name="name" autoComplete="organization" required autoFocus />
      </Field>

      <output aria-live="polite" className="contents">
        {state.error ? (
          <p className="rounded-md border border-failed bg-failed-bg px-3 py-2 text-small text-failed-text">
            {state.error}
          </p>
        ) : null}
      </output>

      <Button type="submit" variant="primary" size="lg" disabled={pending}>
        {pending ? 'Creating…' : 'Create workspace'}
      </Button>
    </form>
  );
}
