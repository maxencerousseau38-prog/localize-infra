/**
 * How far a workspace is from its first pull request, as a sequence of steps.
 *
 * This is deliberately *not* `lib/metrics/funnel.ts`, and the difference is the
 * whole point of the file. The funnel answers "how many" — it is a measurement
 * surface, and it reports counts. This answers "what now", which is a different
 * question with a different failure mode: a count can be zero and still be
 * true, but a next step that is wrong sends someone down a path that cannot
 * work.
 *
 * Both read the same rows. Neither invents one.
 *
 * **Every status here is derived from something the database already holds**,
 * or from a refusal the deployment can state about itself. Nothing is stored to
 * track progress: an `onboarding_state` column would be a second account of
 * facts the other tables already carry, free to disagree with them — and the
 * disagreement would show up as a checklist insisting you connect a repository
 * you connected an hour ago.
 *
 * ## Tone is not decoration here
 *
 * DESIGN.md §6.3 draws the line this file has to respect: colour reports the
 * state of something that *exists*. A step nobody has reached yet has no state,
 * so it gets no tone — painting it amber would claim its behaviour is degraded,
 * and painting it Iris would claim a person must decide about it. Both describe
 * the absence of a thing rather than the state of one.
 *
 * So exactly four tones are reachable, and each has to be earned:
 *
 *  - `confident` — the step is done, and a row proves it.
 *  - `failed` — something exists and refuses: a deployment that cannot offer
 *    the GitHub flow, a run that failed.
 *  - `ambiguous` — **your judgement is required**, and nothing else. Reached
 *    only by a run that stopped to ask a question (§1.4).
 *  - none — not reached yet, or in progress.
 */

/** The run columns this file reads. Same shape as `lib/metrics/funnel.ts`. */
export interface OnboardingRun {
  status:
    | 'queued'
    | 'running'
    | 'succeeded'
    | 'partial'
    | 'failed'
    | 'awaiting_review'
    | 'no_changes';
  pr_url: string | null;
}

/** A project, in the columns that decide whether it can produce a run. */
export interface OnboardingProject {
  slug: string;
  name: string;
  repositoryOwner: string | null;
  repositoryName: string | null;
  baseBranch: string;
  targetLocales: readonly string[];
}

export interface OnboardingInput {
  orgSlug: string;
  workspaceName: string;
  /** Null when this workspace has never connected GitHub. */
  githubAccountLogin: string | null;
  /**
   * Environment variables the deployment is missing, from `installBlockers()`.
   * Non-empty means the flow cannot be offered at all — which is a present
   * failure of this deployment, not a step the user has yet to take.
   */
  githubBlockers: readonly string[];
  projects: readonly OnboardingProject[];
  /** Tokens that are neither expired nor revoked. */
  activeTokens: number;
  runs: readonly OnboardingRun[];
}

export type StepId =
  | 'workspace'
  | 'github'
  | 'repository'
  | 'token'
  | 'run'
  | 'pull_request';

export type StepStatus = 'done' | 'current' | 'todo' | 'blocked';

/** Only the tones §6.1 defines, and only when something exists to report on. */
export type StepTone = 'confident' | 'failed' | 'ambiguous' | null;

export interface OnboardingStep {
  id: StepId;
  title: string;
  status: StepStatus;
  tone: StepTone;
  /**
   * What this step produced, once it has. Null while it has not — never a
   * placeholder, because "—" in the same slot where a real value appears reads
   * as a value.
   */
  detail: string | null;
  /** Why it is blocked, in the reader's terms. Null unless blocked. */
  problem: string | null;
}

export interface Onboarding {
  steps: OnboardingStep[];
  done: number;
  total: number;
  /** The step the reader should act on, or null once everything is done. */
  current: StepId | null;
  /** True once a run has opened a pull request: the whole point of the path. */
  activated: boolean;
  /**
   * The project a shell command should be built for, or null.
   *
   * The first project that has both a repository and at least one target
   * locale — the two things `startRun` and `--open-pr` each refuse without.
   * Picking a project that is missing either would hand the reader a command
   * that cannot succeed.
   */
  commandProject: OnboardingProject | null;
}

const TITLES: Record<StepId, string> = {
  workspace: 'Create a workspace',
  github: 'Connect GitHub',
  repository: 'Connect a repository',
  token: 'Create a CLI token',
  run: 'Run the CLI',
  pull_request: 'Open the first pull request',
};

/** A project that could actually produce a pull request. */
function usable(project: OnboardingProject): boolean {
  return (
    project.repositoryOwner !== null &&
    project.repositoryName !== null &&
    project.targetLocales.length > 0
  );
}

export function buildOnboarding(input: OnboardingInput): Onboarding {
  const connected = input.githubAccountLogin !== null;
  const deploymentCannotConnect = input.githubBlockers.length > 0;

  const withRepository = input.projects.filter(
    (project) => project.repositoryOwner && project.repositoryName,
  );
  const runsWithPr = input.runs.filter((run) => run.pr_url !== null);
  const failedRuns = input.runs.filter((run) => run.status === 'failed');
  const awaiting = input.runs.filter((run) => run.status === 'awaiting_review');

  /*
   * Built as (done, tone, detail, problem) per step, then sequenced. Splitting
   * "is it done" from "is it the one to act on" matters: the current step is a
   * property of the *list* — the first one not done — and deciding it inside
   * each step is how a checklist ends up with two current items or none.
   */
  const raw: {
    id: StepId;
    done: boolean;
    tone: StepTone;
    detail: string | null;
    problem: string | null;
  }[] = [
    {
      id: 'workspace',
      // Reaching this page at all means one exists: the route is under
      // `/[org]`, and `/onboarding` refuses to move on without one.
      done: true,
      tone: 'confident',
      detail: input.workspaceName,
      problem: null,
    },
    {
      id: 'github',
      done: connected,
      tone: connected ? 'confident' : deploymentCannotConnect ? 'failed' : null,
      detail: connected ? input.githubAccountLogin : null,
      problem:
        !connected && deploymentCannotConnect
          ? `This deployment cannot offer the GitHub connection: ${input.githubBlockers.join(', ')} ${input.githubBlockers.length === 1 ? 'is' : 'are'} not set. Nobody can connect an account until an operator sets ${input.githubBlockers.length === 1 ? 'it' : 'them'}.`
          : null,
    },
    {
      id: 'repository',
      done: withRepository.length > 0,
      tone: withRepository.length > 0 ? 'confident' : null,
      detail:
        withRepository.length > 0
          ? withRepository
              .map((p) => `${p.repositoryOwner}/${p.repositoryName}`)
              .join(', ')
          : null,
      problem: null,
    },
    {
      id: 'token',
      done: input.activeTokens > 0,
      tone: input.activeTokens > 0 ? 'confident' : null,
      detail:
        input.activeTokens > 0
          ? `${input.activeTokens} active token${input.activeTokens === 1 ? '' : 's'}`
          : null,
      problem: null,
    },
    {
      id: 'run',
      done: input.runs.length > 0,
      /*
       * A run that failed is a thing that exists and failed, so it is reported
       * — even though the step counts as done. "Done" here means the CLI
       * reached the API and a row was written, which is genuinely progress:
       * the reader has got past token, network and repository. What went wrong
       * after that belongs on the step, not hidden by it.
       */
      tone:
        input.runs.length === 0
          ? null
          : failedRuns.length === input.runs.length
            ? 'failed'
            : 'confident',
      detail:
        input.runs.length > 0
          ? `${input.runs.length} run${input.runs.length === 1 ? '' : 's'}`
          : null,
      problem:
        input.runs.length > 0 && failedRuns.length === input.runs.length
          ? `Every run so far failed (${failedRuns.length}). Open the run to read what the API returned — the reason is recorded verbatim.`
          : null,
    },
    {
      id: 'pull_request',
      done: runsWithPr.length > 0,
      /*
       * Iris, and only here. A run that stopped to ask a question is the one
       * place in this path where the product is waiting on a human decision —
       * which is the single meaning §1.4 reserves the colour for.
       */
      tone:
        runsWithPr.length > 0
          ? 'confident'
          : awaiting.length > 0
            ? 'ambiguous'
            : null,
      detail:
        runsWithPr.length > 0
          ? `${runsWithPr.length} pull request${runsWithPr.length === 1 ? '' : 's'}`
          : null,
      problem:
        runsWithPr.length === 0 && awaiting.length > 0
          ? `${awaiting.length} run${awaiting.length === 1 ? '' : 's'} stopped to ask a question. Answer it and the pull request follows — this is the product working, not a failure.`
          : null,
    },
  ];

  const firstUndone = raw.find((step) => !step.done);
  const steps: OnboardingStep[] = raw.map((step) => ({
    id: step.id,
    title: TITLES[step.id],
    status: step.done
      ? 'done'
      : step.problem !== null
        ? 'blocked'
        : step.id === firstUndone?.id
          ? 'current'
          : 'todo',
    tone: step.tone,
    detail: step.detail,
    problem: step.problem,
  }));

  return {
    steps,
    done: raw.filter((step) => step.done).length,
    total: raw.length,
    current: firstUndone?.id ?? null,
    activated: runsWithPr.length > 0,
    commandProject: input.projects.find(usable) ?? null,
  };
}
