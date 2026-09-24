import { describe, expect, it } from 'vitest';
import { type ProjectShape, READINESS, readiness } from './readiness';

/**
 * That a project row's colour agrees with what the product would actually do.
 *
 * This is a claim rendered as the State Rule — the signature element §1.4 says
 * must never be diluted — so it is worth more than a glance. The two inputs
 * mirror the two refusals in `startRun`, and if either drifts the list paints a
 * project green that cannot run.
 */

const project = (over: Partial<ProjectShape> = {}): ProjectShape => ({
  repository_owner: 'acme',
  repository_name: 'web',
  target_locales: ['fr'],
  ...over,
});

describe('readiness', () => {
  it('is ready only with both a repository and a language', () => {
    expect(readiness(project())).toBe('ready');
  });

  it('reads no-repository when either half of the pointer is missing', () => {
    /*
     * `projects_repository_is_whole` makes the half-set state unrepresentable
     * in the database, so in practice only the both-null case occurs. Both
     * halves are checked anyway: the constraint is the reason this is safe, not
     * a reason to depend on it from here — a function that trusts a constraint
     * in another file is a function that breaks when the file moves.
     */
    expect(readiness(project({ repository_owner: null }))).toBe(
      'no-repository',
    );
    expect(readiness(project({ repository_name: null }))).toBe('no-repository');
    expect(
      readiness(project({ repository_owner: null, repository_name: null })),
    ).toBe('no-repository');
  });

  it('reads no-languages only once a repository exists', () => {
    // Order matters. A project with neither is "not connected", not "no target
    // languages": naming the second gap while the first is open sends the
    // reader to the wrong control.
    expect(readiness(project({ target_locales: [] }))).toBe('no-languages');
    expect(
      readiness(project({ repository_owner: null, target_locales: [] })),
    ).toBe('no-repository');
  });

  it('treats a null target list as an empty one', () => {
    // The column is `not null` today, but the generated type admits null and a
    // `.length` on it would throw on a page rather than report a state.
    expect(readiness(project({ target_locales: null }))).toBe('no-languages');
  });

  it('paints the unfinished state neutral, not amber', () => {
    /*
     * §6.3, the clause that took two rewrites to become applicable: colour
     * reports the state of something that exists. A project awaiting its first
     * repository is unfinished, not degraded, and amber would claim a defect
     * where there is a next step. Amber is reserved for the project that looks
     * configured and will still refuse every run.
     */
    expect(READINESS['no-repository'].tone).toBe('neutral');
    expect(READINESS['no-languages'].tone).toBe('degraded');
    expect(READINESS.ready.tone).toBe('confident');
  });

  it('never reaches for Iris', () => {
    // §1.4: Iris means "your judgement is required" and nothing else. No
    // configuration state asks for a judgement.
    const tones = Object.values(READINESS).map((entry) => entry.tone);
    expect(tones).not.toContain('ambiguous');
  });

  it('says what to do next rather than restating the label', () => {
    // "Not connected" followed by "Not connected yet" is chrome. Every detail
    // line has to add something the label does not.
    for (const [state, entry] of Object.entries(READINESS)) {
      expect(entry.detail, `${state} repeats its own label`).not.toContain(
        entry.label,
      );
    }
  });
});
