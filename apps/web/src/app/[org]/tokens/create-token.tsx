'use client';

import { ShellInstructions } from '@/components/shell-instructions';
import type { CommandTarget } from '@/lib/onboarding/commands';
import { Button, Field, useFieldControl } from '@localize-infra/ui';
import type { ComponentProps } from 'react';
import { useActionState } from 'react';
import { type CreateTokenState, createCliToken } from './actions';

const EMPTY: CreateTokenState = {};

// The control has to claim the id its Field's label points at; same wrapper
// as RepositorySection and DangerSection.
function FieldInput(props: ComponentProps<'input'>) {
  return <input {...useFieldControl()} {...props} />;
}
function FieldSelect(props: ComponentProps<'select'>) {
  return <select {...useFieldControl()} {...props} />;
}

const CONTROL =
  'h-8 w-full max-w-sm rounded-md border border-line bg-canvas px-2 text-body text-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus';

/**
 * Issue a token, and show it exactly once.
 *
 * The plaintext lives only in this component's state. It is not in the page,
 * not in the URL, not in the database; reloading loses it, and the panel says
 * so, because a token a person cannot get back is the point.
 */
export function CreateToken({
  orgSlug,
  target = null,
}: {
  orgSlug: string;
  /**
   * The repository the run command should target, when one is usable. Null
   * produces the translate-only command instead of a broken `--owner null`.
   */
  target?: CommandTarget | null;
}) {
  const [state, action, pending] = useActionState(
    createCliToken.bind(null, orgSlug),
    EMPTY,
  );

  return (
    <section
      aria-labelledby="new-token"
      className="mt-6 rounded-lg border border-line bg-surface/40 px-5 py-5"
    >
      <h2 id="new-token" className="text-subtitle font-semibold text-primary">
        New CLI token
      </h2>
      <p className="mt-2 max-w-[64ch] text-small leading-6 text-secondary">
        A token lets <span className="font-mono">@localize-infra/cli</span> act
        for this workspace: translate, and open pull requests through this
        workspace’s own GitHub connection. It is yours — revoke it here at any
        time.
      </p>

      {state.token ? (
        <div className="mt-4 flex flex-col gap-3" data-testid="issued-token">
          <p className="text-small font-medium text-primary">
            “{state.name}” — copy it now. It is not shown again, and it is not
            stored anywhere you can read it back.
          </p>
          <ShellInstructions token={state.token} target={target} />
          <p className="max-w-[64ch] text-caption leading-5 text-tertiary">
            Treat it like a password: anyone holding it can translate on this
            workspace’s behalf until it is revoked or expires.
          </p>
        </div>
      ) : null}

      <form action={action} className="mt-4 flex flex-col gap-4">
        <Field
          label="Name"
          required
          help="Where it will be used — a laptop, a CI job — so you know which one to revoke."
        >
          <FieldInput
            type="text"
            name="name"
            required
            maxLength={80}
            autoComplete="off"
            placeholder="e.g. laptop"
            className={CONTROL}
          />
        </Field>
        <Field label="Expires after" required>
          <FieldSelect name="lifetime" defaultValue="90" className={CONTROL}>
            <option value="30">30 days</option>
            <option value="90">90 days</option>
            <option value="365">1 year</option>
          </FieldSelect>
        </Field>

        <output aria-live="polite" className="contents">
          {state.error ? (
            <p className="max-w-[64ch] rounded-md border border-failed bg-failed-bg px-3 py-2 text-small text-failed-text">
              {state.error}
            </p>
          ) : null}
        </output>

        <div>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? 'Creating…' : 'Create token'}
          </Button>
        </div>
      </form>
    </section>
  );
}
