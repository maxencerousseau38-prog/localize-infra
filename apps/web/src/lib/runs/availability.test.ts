import { describe, expect, it } from 'vitest';
import { runAvailability } from './availability';

const ready = {
  gitHubConfigured: true,
  installationId: 151289538,
  connected: true,
  targetLocales: ['fr', 'de'],
} as const;

describe('runAvailability', () => {
  it('offers the run when everything is in place', () => {
    expect(runAvailability(ready)).toEqual({ canRun: true, reason: null });
  });

  /*
   * The case this function was extracted for. A project connected to a
   * repository, on a workspace with an installation, but with no target
   * language: `startRun` refuses it before writing a run row, so the button was
   * offering an action that could not succeed. It cost a day of chasing a
   * deployment that was never at fault — see CLAUDE.md.
   */
  it('refuses a project with no target language, and says where to fix it', () => {
    expect(runAvailability({ ...ready, targetLocales: [] })).toEqual({
      canRun: false,
      reason:
        'Add at least one target language under Languages before running.',
    });
  });

  it('refuses a project with no repository', () => {
    expect(runAvailability({ ...ready, connected: false })).toEqual({
      canRun: false,
      reason: 'Connect a repository before running.',
    });
  });

  it('refuses a workspace with no installation', () => {
    expect(runAvailability({ ...ready, installationId: null })).toEqual({
      canRun: false,
      reason: 'Install the Localize GitHub App on your account before running.',
    });
  });

  it('refuses a deployment with no GitHub App', () => {
    expect(runAvailability({ ...ready, gitHubConfigured: false })).toEqual({
      canRun: false,
      reason:
        'This deployment has no GitHub App configured, so a run has nowhere to open a pull request.',
    });
  });

  /*
   * Order is part of the contract. Naming the language when the deployment has
   * no App at all would send someone to the Languages section to fix something
   * that is not their problem — each rung reports the outermost obstacle.
   */
  it('reports the outermost obstacle first', () => {
    expect(
      runAvailability({
        gitHubConfigured: false,
        installationId: null,
        connected: false,
        targetLocales: [],
      }).reason,
    ).toBe(
      'This deployment has no GitHub App configured, so a run has nowhere to open a pull request.',
    );

    expect(
      runAvailability({ ...ready, connected: false, targetLocales: [] }).reason,
    ).toBe('Connect a repository before running.');
  });

  /*
   * `canRun` and the reason were two independent expressions in `page.tsx`, and
   * nothing made them agree. They are one value now, and this is what says so:
   * a button is offered exactly when there is nothing to explain.
   */
  it('never offers the run while it has a reason not to', () => {
    const cases = [
      { ...ready, gitHubConfigured: false },
      { ...ready, installationId: null },
      { ...ready, connected: false },
      { ...ready, targetLocales: [] },
      ready,
    ];

    for (const input of cases) {
      const { canRun, reason } = runAvailability(input);
      expect(canRun).toBe(reason === null);
    }
  });
});
