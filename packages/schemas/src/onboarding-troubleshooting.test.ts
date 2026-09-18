import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Pins the onboarding troubleshooting table to the API it describes.
 *
 * `apps/web/src/lib/onboarding/troubleshooting.ts` tells a new user what each
 * refusal means and what to do about it. That is only useful while the statuses
 * it names are ones the API still returns — an entry for a refusal that has
 * been removed sends somebody chasing a condition that cannot occur, and a
 * refusal added with no entry is the one a first-time user will meet with no
 * guidance at all.
 *
 * Same technique, and the same reason, as `cli-config.test.ts`: the web app
 * cannot import from `apps/api`, so the agreement is asserted against the
 * source text rather than left to memory.
 */
const REPO_ROOT = join(import.meta.dirname, '../../..');

function apiSource(): string {
  const root = join(REPO_ROOT, 'apps/api/src');
  const read = (dir: string): string => {
    let out = '';
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) out += read(path);
      // Test files are excluded on purpose: a status that only ever appears in
      // an assertion is one the route no longer produces.
      else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
        out += readFileSync(path, 'utf8');
      }
    }
    return out;
  };
  return read(root);
}

const api = apiSource();
const troubleshooting = readFileSync(
  join(REPO_ROOT, 'apps/web/src/lib/onboarding/troubleshooting.ts'),
  'utf8',
);

/** The `status: N,` entries the table declares. */
function declaredStatuses(): number[] {
  return [
    ...new Set(
      [...troubleshooting.matchAll(/^\s*status:\s*(\d{3}),/gm)].map((m) =>
        Number(m[1]),
      ),
    ),
  ].sort((a, b) => a - b);
}

describe('the troubleshooting table describes the real API', () => {
  it('reads the sources it is meant to compare', () => {
    expect(troubleshooting).toContain('REFUSALS');
    expect(api).toContain('/v1/open-pr');
  });

  it('names at least the refusals a first run can hit', () => {
    const declared = declaredStatuses();
    // Not an exhaustive list of what the API can answer — an exhaustive table
    // would be a reference manual. These are the ones that stop a first run.
    for (const status of [401, 403, 404, 409, 412, 429, 502, 503]) {
      expect(declared, `status ${status}`).toContain(status);
    }
  });

  it('names no status the API cannot return', () => {
    for (const status of declaredStatuses()) {
      expect(
        new RegExp(`\\b${status}\\b`).test(api),
        `status ${status} is described to users but apps/api never returns it`,
      ).toBe(true);
    }
  });

  it('describes the two different 401s, which mean opposite things', () => {
    /*
     * "invalid, expired or revoked" means the token is wrong. "not enabled"
     * means the token is fine and the deployment cannot check it — the exact
     * pair CLAUDE.md records as the only way to tell an empty SUPABASE_URL
     * from a bad credential. Collapsing them into one entry would lose the
     * distinction that makes either actionable.
     */
    expect(api).toContain('invalid, expired or revoked');
    expect(api).toContain('not enabled on this API deployment');
    expect(troubleshooting).toContain('invalid, expired or revoked');
    expect(troubleshooting).toContain('personal tokens are not enabled');
  });

  it('gives every refusal a situation, a meaning and a fix', () => {
    const entries = [...troubleshooting.matchAll(/^\s*status:/gm)].length;
    expect(entries).toBeGreaterThan(0);
    for (const field of ['situation:', 'meaning:', 'fix:']) {
      expect(
        [...troubleshooting.matchAll(new RegExp(`^\\s*${field}`, 'gm'))].length,
        field,
      ).toBe(entries);
    }
  });

  it('keeps 409 described as a success, because it is one', () => {
    // A no-op run answering 409 is the guard working: no empty pull request,
    // no orphan branch. Presenting it as an error would teach a new user to
    // treat the correct outcome as a fault.
    const block = troubleshooting.slice(troubleshooting.indexOf('status: 409'));
    expect(block).toContain('Not a failure');
  });
});
