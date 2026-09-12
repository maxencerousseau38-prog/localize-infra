import { afterEach, describe, expect, it } from 'vitest';
import { readVersion } from './version.js';

/**
 * Which commit this service is running.
 *
 * `apps/web` gained this endpoint first (#88). This service needs it more, and
 * for a reason particular to it: **it is not connected to Git.** Merging to
 * `master` deploys the site and the web app; `apps/api` deploys only when
 * somebody runs `npx vercel deploy --prod --archive=tgz`. So the usual proxy
 * for "what is deployed" — the commit on `master` — is not evidence here at
 * all, and the gap between the two has already been observed once: on
 * 2026-08-23, PR #33 was merged while the last API production build still dated
 * from the previous day.
 *
 * That is the trap CLAUDE.md describes, and this endpoint is the cheapest thing
 * that closes it.
 */
const VARS = ['VERCEL_GIT_COMMIT_SHA', 'VERCEL_ENV'] as const;

const saved = new Map<string, string | undefined>();
for (const key of VARS) saved.set(key, process.env[key]);

function env(values: Partial<Record<(typeof VARS)[number], string>>) {
  for (const key of VARS) delete process.env[key];
  for (const [key, value] of Object.entries(values)) process.env[key] = value;
}

afterEach(() => {
  for (const [key, value] of saved) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('readVersion', () => {
  it('reports the commit Vercel built from', () => {
    env({
      VERCEL_GIT_COMMIT_SHA: 'd18dcff350fd2bdda36a9e3498cf1530cd4a0e99',
      VERCEL_ENV: 'production',
    });

    expect(readVersion()).toEqual({
      commit: 'd18dcff350fd2bdda36a9e3498cf1530cd4a0e99',
      environment: 'production',
    });
  });

  /*
   * `npm run dev`, a self-hosted run, or — and this is the case that actually
   * matters here — a CLI archive deployment that carried no Git metadata.
   * `null` reports that the service cannot tell. Reading git at runtime, or
   * writing "unknown" where a sha belongs, would turn "I do not know" into a
   * claim, which is the one thing this endpoint must never do.
   */
  it('reports null rather than inventing a value when the variable is absent', () => {
    env({});

    expect(readVersion()).toEqual({ commit: null, environment: null });
  });

  /*
   * Same rule as `LOCALIZE_API_URL` in packages/cli (#73). Vercel sets the Git
   * variables to an empty string on a project with no repository connected —
   * which is exactly this project's situation, so this is the likely case here
   * rather than a defensive one.
   */
  it('treats an empty value as absent', () => {
    env({ VERCEL_GIT_COMMIT_SHA: '', VERCEL_ENV: '   ' });

    expect(readVersion()).toEqual({ commit: null, environment: null });
  });

  it('reports the environment, so a preview is not mistaken for production', () => {
    env({ VERCEL_GIT_COMMIT_SHA: 'abc123', VERCEL_ENV: 'preview' });

    expect(readVersion()).toEqual({ commit: 'abc123', environment: 'preview' });
  });
});
