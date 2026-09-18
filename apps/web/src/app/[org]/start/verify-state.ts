import type { InstallationHealth } from '@/lib/github/health';

/**
 * The shape the verification control holds, kept out of `actions.ts`.
 *
 * **A `'use server'` file may export only async functions.** The initial state
 * lived beside the action and Next refused the module at runtime — `A "use
 * server" file can only export async functions, found object` — while `next
 * build` and `tsc` both passed. The failure surfaced as the button silently
 * doing nothing, which is why it was found by running the page rather than by
 * compiling it.
 *
 * A type-only export would have been fine (types are erased); a const is not.
 */
export type VerifyState =
  | { checked: false }
  | ({ checked: true } & InstallationHealth);

export const IDLE: VerifyState = { checked: false };
