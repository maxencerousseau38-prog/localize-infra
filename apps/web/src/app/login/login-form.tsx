'use client';

import { Button, Field, Input } from '@localize-infra/ui';
import { useActionState } from 'react';
import { type AuthState, signIn, signUp } from './actions';

const EMPTY: AuthState = {};

/**
 * One form, two actions.
 *
 * Sign-in and sign-up take the same two fields, and splitting them across two
 * pages doubles the routes to make the visitor choose a label before they have
 * done anything. The submit buttons carry the intent instead.
 */
export function LoginForm({
  next,
  linkError,
}: {
  next?: string;
  linkError?: string;
}) {
  const [signInState, signInAction, signingIn] = useActionState(signIn, EMPTY);
  const [signUpState, signUpAction, signingUp] = useActionState(signUp, EMPTY);

  const busy = signingIn || signingUp;
  const error = linkError ?? signInState.error ?? signUpState.error;
  const notice = signUpState.notice;

  return (
    <form className="mt-8 flex flex-col gap-6">
      <input type="hidden" name="next" value={next ?? '/'} />

      {/* No id or htmlFor: Field owns the control id and hands it to Input
          through context, so wiring them by hand here would fight the
          primitive and risk two elements claiming the same id. */}
      <Field label="Email" required>
        <Input
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
        />
      </Field>

      <Field label="Password" required help="At least 8 characters.">
        <Input
          name="password"
          type="password"
          autoComplete="current-password"
          minLength={8}
          required
        />
      </Field>

      {/* Live region: the result of a submit must reach a screen reader
          without it having to hunt for what changed. */}
      <output aria-live="polite" className="contents">
        {error ? (
          <p className="rounded-md border border-failed bg-failed-bg px-3 py-2 text-small text-failed-text">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="rounded-md border border-line bg-surface px-3 py-2 text-small text-secondary">
            {notice}
          </p>
        ) : null}
      </output>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          type="submit"
          formAction={signInAction}
          variant="primary"
          size="lg"
          disabled={busy}
          className="w-full sm:flex-1"
        >
          {signingIn ? 'Signing in…' : 'Sign in'}
        </Button>
        <Button
          type="submit"
          formAction={signUpAction}
          variant="secondary"
          size="lg"
          disabled={busy}
          className="w-full sm:flex-1"
        >
          {signingUp ? 'Creating…' : 'Create account'}
        </Button>
      </div>
    </form>
  );
}
