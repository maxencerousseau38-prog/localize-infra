'use client';

import {
  Button,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
  Field,
  Input,
} from '@localize-infra/ui';
import { useActionState, useEffect, useRef, useState } from 'react';
import { type ProjectState, createProject } from './actions';

const EMPTY: ProjectState = {};

export function NewProject({ orgSlug }: { orgSlug: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(
    createProject.bind(null, orgSlug),
    EMPTY,
  );

  /*
   * Close on success, and only on success.
   *
   * The action returns `{}` when it worked and `{ error }` when it did not, so
   * "no error" alone is not the signal — the initial state has no error either
   * and would close the dialog the moment it opened. Tracking the submission
   * count distinguishes "never submitted" from "submitted and succeeded".
   */
  const submissions = useRef(0);
  const settled = useRef(0);

  useEffect(() => {
    if (pending) {
      submissions.current += 1;
      return;
    }
    if (submissions.current > settled.current) {
      settled.current = submissions.current;
      if (!state.error) setOpen(false);
    }
  }, [pending, state]);

  return (
    <DialogRoot open={open} onOpenChange={setOpen}>
      <Button variant="primary" onClick={() => setOpen(true)}>
        New project
      </Button>

      <DialogContent size="md">
        <form action={action}>
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
          </DialogHeader>

          <DialogBody className="flex flex-col gap-6">
            <Field
              label="Project name"
              required
              help="Used to build the address."
            >
              <Input name="name" required />
            </Field>

            <Field
              label="Source locale"
              required
              help="The language your code is written in. A BCP-47 tag such as en or en-GB."
            >
              <Input name="source_locale" defaultValue="en" required />
            </Field>

            <Field
              label="Target locales"
              help="The languages to translate into, separated by commas — for example de, ja, es, pt-BR. You can change this later."
            >
              <Input name="target_locales" placeholder="de, ja, es, pt-BR" />
            </Field>

            <output aria-live="polite" className="contents">
              {state.error ? (
                <p className="rounded-md border border-failed bg-failed-bg px-3 py-2 text-small text-failed-text">
                  {state.error}
                </p>
              ) : null}
            </output>
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? 'Creating…' : 'Create project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </DialogRoot>
  );
}
