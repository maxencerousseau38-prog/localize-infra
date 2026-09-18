import { describe, expect, it } from 'vitest';
import {
  type OnboardingInput,
  type OnboardingProject,
  type OnboardingRun,
  buildOnboarding,
} from './steps.js';

/**
 * What the guided path is allowed to claim.
 *
 * Two rules carry most of these, and both are rules this repository has been
 * caught breaking elsewhere:
 *
 *  1. **A step nobody has reached has no state**, so it has no tone
 *     (DESIGN.md §6.3). Iris on "not done yet" is exactly the leak that reached
 *     five pages once already.
 *  2. **Nothing is invented.** Every "done" traces to a row the caller passed
 *     in; there is no stored progress flag that could disagree with the data.
 */

const project = (over: Partial<OnboardingProject> = {}): OnboardingProject => ({
  slug: 'web',
  name: 'Web',
  repositoryOwner: 'acme',
  repositoryName: 'site',
  baseBranch: 'main',
  targetLocales: ['fr', 'de'],
  ...over,
});

const run = (over: Partial<OnboardingRun> = {}): OnboardingRun => ({
  status: 'succeeded',
  pr_url: 'https://github.com/acme/site/pull/1',
  ...over,
});

const input = (over: Partial<OnboardingInput> = {}): OnboardingInput => ({
  orgSlug: 'acme',
  workspaceName: 'Acme',
  githubAccountLogin: null,
  githubBlockers: [],
  projects: [],
  activeTokens: 0,
  runs: [],
  ...over,
});

const byId = (result: ReturnType<typeof buildOnboarding>, id: string) => {
  const step = result.steps.find((s) => s.id === id);
  if (!step) throw new Error(`no step ${id}`);
  return step;
};

describe('a brand-new workspace', () => {
  const fresh = buildOnboarding(input());

  it('has the workspace step done and nothing else', () => {
    expect(fresh.done).toBe(1);
    expect(fresh.total).toBe(6);
    expect(byId(fresh, 'workspace').status).toBe('done');
  });

  it('points at connecting GitHub as the one thing to do next', () => {
    expect(fresh.current).toBe('github');
    expect(byId(fresh, 'github').status).toBe('current');
  });

  it('marks every later step todo, not current', () => {
    for (const id of ['repository', 'token', 'run', 'pull_request']) {
      expect(byId(fresh, id).status, id).toBe('todo');
    }
  });

  it('gives no tone to a step that has not been reached', () => {
    // DESIGN.md §6.3: a thing that does not exist yet has no state to report.
    for (const id of ['github', 'repository', 'token', 'run', 'pull_request']) {
      expect(byId(fresh, id).tone, id).toBeNull();
    }
  });

  it('shows no detail rather than a placeholder', () => {
    expect(byId(fresh, 'github').detail).toBeNull();
    expect(byId(fresh, 'run').detail).toBeNull();
  });

  it('is not activated and offers no command project', () => {
    expect(fresh.activated).toBe(false);
    expect(fresh.commandProject).toBeNull();
  });
});

describe('exactly one step is current', () => {
  const cases: [string, OnboardingInput][] = [
    ['nothing done', input()],
    ['github only', input({ githubAccountLogin: 'acme' })],
    [
      'github and repository',
      input({ githubAccountLogin: 'acme', projects: [project()] }),
    ],
    [
      'up to the token',
      input({
        githubAccountLogin: 'acme',
        projects: [project()],
        activeTokens: 1,
      }),
    ],
  ];

  for (const [name, given] of cases) {
    it(name, () => {
      const result = buildOnboarding(given);
      const current = result.steps.filter((s) => s.status === 'current');
      expect(current).toHaveLength(1);
      expect(current[0]?.id).toBe(result.current);
    });
  }

  it('has none once every step is done', () => {
    const done = buildOnboarding(
      input({
        githubAccountLogin: 'acme',
        projects: [project()],
        activeTokens: 1,
        runs: [run()],
      }),
    );
    expect(done.current).toBeNull();
    expect(done.steps.filter((s) => s.status === 'current')).toHaveLength(0);
    expect(done.done).toBe(6);
    expect(done.activated).toBe(true);
  });
});

describe('a deployment that cannot offer the GitHub flow', () => {
  const blocked = buildOnboarding(
    input({ githubBlockers: ['GITHUB_APP_SLUG', 'GITHUB_OAUTH_CLIENT_ID'] }),
  );
  const step = byId(blocked, 'github');

  it('is blocked, not merely current', () => {
    expect(step.status).toBe('blocked');
  });

  it('is failed, because the refusal exists and is present today', () => {
    expect(step.tone).toBe('failed');
  });

  it('names the variables an operator would have to set', () => {
    expect(step.problem).toContain('GITHUB_APP_SLUG');
    expect(step.problem).toContain('GITHUB_OAUTH_CLIENT_ID');
    expect(step.problem).toContain('are not set');
  });

  it('uses the singular when only one is missing', () => {
    const one = buildOnboarding(input({ githubBlockers: ['GITHUB_APP_SLUG'] }));
    expect(byId(one, 'github').problem).toContain('is not set');
  });

  it('does not block once GitHub is connected', () => {
    const connected = buildOnboarding(
      input({ githubAccountLogin: 'acme', githubBlockers: ['ANYTHING'] }),
    );
    expect(byId(connected, 'github').status).toBe('done');
    expect(byId(connected, 'github').tone).toBe('confident');
  });
});

describe('runs that did not reach a pull request', () => {
  it('reports every-run-failed as failed, and still counts the step done', () => {
    const result = buildOnboarding(
      input({
        githubAccountLogin: 'acme',
        projects: [project()],
        activeTokens: 1,
        runs: [run({ status: 'failed', pr_url: null })],
      }),
    );
    const step = byId(result, 'run');
    expect(step.status).toBe('done');
    expect(step.tone).toBe('failed');
    expect(step.problem).toContain('failed');
  });

  it('does not call it failed when one run succeeded', () => {
    const result = buildOnboarding(
      input({
        runs: [run({ status: 'failed', pr_url: null }), run({ pr_url: null })],
      }),
    );
    expect(byId(result, 'run').tone).toBe('confident');
    expect(byId(result, 'run').problem).toBeNull();
  });

  it('uses Iris only for a run waiting on a human decision', () => {
    const result = buildOnboarding(
      input({ runs: [run({ status: 'awaiting_review', pr_url: null })] }),
    );
    const step = byId(result, 'pull_request');
    expect(step.tone).toBe('ambiguous');
    expect(step.problem).toContain('stopped to ask a question');
  });

  it('never uses Iris anywhere else, in any of these states', () => {
    const states: OnboardingRun['status'][] = [
      'queued',
      'running',
      'succeeded',
      'partial',
      'failed',
      'no_changes',
    ];
    for (const status of states) {
      const result = buildOnboarding(
        input({ runs: [run({ status, pr_url: null })] }),
      );
      for (const step of result.steps) {
        expect(step.tone, `${status}/${step.id}`).not.toBe('ambiguous');
      }
    }
  });

  it('prefers the pull request over the question once one is open', () => {
    const result = buildOnboarding(
      input({
        runs: [run({ status: 'awaiting_review', pr_url: null }), run()],
      }),
    );
    expect(byId(result, 'pull_request').tone).toBe('confident');
    expect(byId(result, 'pull_request').problem).toBeNull();
  });
});

describe('the project a command is built for', () => {
  it('is skipped when it has no repository', () => {
    const result = buildOnboarding(
      input({
        projects: [project({ repositoryOwner: null, repositoryName: null })],
      }),
    );
    expect(result.commandProject).toBeNull();
  });

  it('is skipped when it has no target locales', () => {
    // startRun refuses a project with no target locale before writing a row,
    // so a command built for one cannot succeed.
    const result = buildOnboarding(
      input({ projects: [project({ targetLocales: [] })] }),
    );
    expect(result.commandProject).toBeNull();
  });

  it('is the first project that can actually produce a pull request', () => {
    const result = buildOnboarding(
      input({
        projects: [
          project({ slug: 'empty', targetLocales: [] }),
          project({ slug: 'usable' }),
        ],
      }),
    );
    expect(result.commandProject?.slug).toBe('usable');
  });

  it('counts the repository step done even when the project is unusable', () => {
    // The repository *is* connected; what is missing is a target locale, and
    // that is a different sentence the project page already tells.
    const result = buildOnboarding(
      input({ projects: [project({ targetLocales: [] })] }),
    );
    expect(byId(result, 'repository').status).toBe('done');
  });
});

describe('detail lines report rows, not intentions', () => {
  it('names the connected account', () => {
    const result = buildOnboarding(input({ githubAccountLogin: 'octo-corp' }));
    expect(byId(result, 'github').detail).toBe('octo-corp');
  });

  it('lists every connected repository', () => {
    const result = buildOnboarding(
      input({
        projects: [
          project({ repositoryName: 'one' }),
          project({ repositoryName: 'two' }),
        ],
      }),
    );
    expect(byId(result, 'repository').detail).toBe('acme/one, acme/two');
  });

  it('pluralises counts it prints', () => {
    expect(
      byId(buildOnboarding(input({ activeTokens: 1 })), 'token').detail,
    ).toBe('1 active token');
    expect(
      byId(buildOnboarding(input({ activeTokens: 3 })), 'token').detail,
    ).toBe('3 active tokens');
    expect(byId(buildOnboarding(input({ runs: [run()] })), 'run').detail).toBe(
      '1 run',
    );
  });
});
