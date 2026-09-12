import { afterEach, describe, expect, it } from 'vitest';
import { readVersion } from './version';

/**
 * Which build is actually running, answerable without signing in.
 *
 * This exists because it was not answerable. When the Vercel Git integration
 * lost access to the repository for a week (2026-09-05 to 2026-09-12, recorded
 * in CLAUDE.md), `apps/site` could be checked — its deployment URLs are public,
 * so the alias could be compared to a named deployment byte for byte — and
 * `apps/web` could not: its deployment URLs are behind SSO, it exposes no build
 * identifier, and the commit that week changed nothing in its output, so the
 * bytes were identical either way. The only evidence left was Vercel's own
 * report that it had deployed.
 *
 * An endpoint that names the commit turns that into one request.
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
      VERCEL_GIT_COMMIT_SHA: 'd4ef40729cee13ca4b353205be380af17586deb3',
      VERCEL_ENV: 'production',
    });

    expect(readVersion()).toEqual({
      commit: 'd4ef40729cee13ca4b353205be380af17586deb3',
      environment: 'production',
    });
  });

  /*
   * A checkout run with `next dev` is not a Vercel deployment and has no
   * commit to report. Reporting `null` says so; inventing a value — reading
   * git, or falling back to "unknown" as though it were a sha — would make the
   * endpoint lie in exactly the situation it exists to clarify.
   */
  it('reports null off Vercel rather than inventing a value', () => {
    env({});

    expect(readVersion()).toEqual({ commit: null, environment: null });
  });

  /*
   * Same rule as `LOCALIZE_API_URL` in packages/cli (#73): a variable that is
   * present but empty is absent. Vercel sets the Git variables to '' when a
   * project is not connected to a repository, which is precisely the state
   * this endpoint has to be able to report.
   */
  it('treats an empty value as absent', () => {
    env({ VERCEL_GIT_COMMIT_SHA: '', VERCEL_ENV: '   ' });

    expect(readVersion()).toEqual({ commit: null, environment: null });
  });

  it('reports the environment, so a preview URL is not mistaken for production', () => {
    env({ VERCEL_GIT_COMMIT_SHA: 'abc123', VERCEL_ENV: 'preview' });

    expect(readVersion()).toEqual({ commit: 'abc123', environment: 'preview' });
  });
});
