'use client';

import { Button } from '@localize-infra/ui';
import { useActionState } from 'react';
import { type RevokeTokenState, revokeCliToken } from './actions';

const EMPTY: RevokeTokenState = {};

export function RevokeToken({
  orgSlug,
  tokenId,
  name,
}: {
  orgSlug: string;
  tokenId: string;
  name: string;
}) {
  const [state, action, pending] = useActionState(
    revokeCliToken.bind(null, orgSlug, tokenId),
    EMPTY,
  );
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <Button
        type="submit"
        variant="danger"
        size="sm"
        disabled={pending}
        aria-label={`Revoke ${name}`}
      >
        {pending ? 'Revoking…' : 'Revoke'}
      </Button>
      {state.error ? (
        <p role="alert" className="text-caption text-failed-text">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
