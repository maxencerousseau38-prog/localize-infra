'use client';

import { Button, Field, useFieldControl } from '@localize-infra/ui';
import type { ComponentProps } from 'react';
import { useActionState } from 'react';
import { type DeleteProjectState, deleteProject } from '../actions';

const EMPTY: DeleteProjectState = {};

/*
 * The control has to claim the id its Field's label points at, which is why
 * this cannot be a bare `<input>` in the JSX below — the provider lives inside
 * Field. RepositorySection carries the same wrapper and the same explanation;
 * it is repeated rather than shared because a third caller would be the point
 * at which extracting it stops being speculative.
 */
function FieldInput(props: ComponentProps<'input'>) {
  return <input {...useFieldControl()} {...props} />;
}

export interface DangerSectionProps {
  orgSlug: string;
  projectId: string;
  projectSlug: string;
  /** What deleting this project takes with it, counted from the database. */
  impact: { runs: number; proposals: number; questions: number };
}

/**
 * Deleting the project, and saying what that costs before it happens.
 *
 * `deleteProject` existed with no caller anywhere in the application: the
 * product could create a project and never remove one, so a project made by
 * mistake either stayed forever or came out through a hand-written `DELETE`
 * against production. That is how `localize-infra test` was removed.
 *
 * The counts are read rather than described. "This action cannot be undone" is
 * true of every delete button ever drawn and tells a person nothing about their
 * own data; `runs`, `run_translations` and `run_ambiguities` all carry
 * `on delete cascade` from this row, so these numbers are what actually goes.
 *
 * Rendered only for owners and admins, because `projects_delete_admin` admits
 * only them — a member would get a control that cannot work, which is what
 * DESIGN.md §11 refuses and what RepositorySection avoids two sections up.
 */
export function DangerSection({
  orgSlug,
  projectId,
  projectSlug,
  impact,
}: DangerSectionProps) {
  const [state, action, pending] = useActionState(
    deleteProject.bind(null, orgSlug, projectId),
    EMPTY,
  );

  const carries = [
    impact.runs > 0
      ? `${impact.runs} run${impact.runs === 1 ? '' : 's'}`
      : null,
    impact.proposals > 0
      ? `${impact.proposals} recorded translation${impact.proposals === 1 ? '' : 's'}`
      : null,
    impact.questions > 0
      ? `${impact.questions} logged question${impact.questions === 1 ? '' : 's'}`
      : null,
  ].filter((part): part is string => part !== null);

  return (
    <section
      aria-labelledby="delete-project"
      className="mt-8 rounded-lg border border-failed bg-failed-bg/40 px-5 py-6"
    >
      <h2
        id="delete-project"
        className="text-subtitle font-semibold text-primary"
      >
        Delete this project
      </h2>

      <p className="mt-4 max-w-[64ch] text-small leading-6 text-secondary">
        {carries.length > 0 ? (
          <>
            This also deletes {carries.join(', ')}. Pull requests already opened
            on GitHub stay where they are — what goes is what this workspace
            recorded about them, not the branches or the translations
            themselves.
          </>
        ) : (
          <>
            This project has recorded nothing yet, so only the project and its
            repository connection go.
          </>
        )}
      </p>

      <form action={action} className="mt-4 flex flex-col gap-4">
        <Field
          label="Project name"
          required
          help={`Type ${projectSlug} to confirm. Nothing is deleted until you do.`}
        >
          <FieldInput
            type="text"
            name="confirm"
            required
            autoComplete="off"
            spellCheck={false}
            placeholder={projectSlug}
            className="h-8 w-full max-w-sm rounded-md border border-line bg-canvas px-2 font-mono text-body text-primary placeholder:text-tertiary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus"
          />
        </Field>

        <output aria-live="polite" className="contents">
          {state.error ? (
            <p className="max-w-[64ch] rounded-md border border-failed bg-failed-bg px-3 py-2 text-small text-failed-text">
              {state.error}
            </p>
          ) : null}
        </output>

        <div>
          <Button type="submit" variant="danger" disabled={pending}>
            {pending ? 'Deleting…' : 'Delete project'}
          </Button>
        </div>
      </form>
    </section>
  );
}
