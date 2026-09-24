import type { Tone } from '@localize-infra/ui';

/**
 * Whether a project can do the thing the product exists to do.
 *
 * A project row used to carry its name, its slug, its source locale and a
 * count of targets — four facts, none of which answers the only question a
 * reader opens this list with, which is whether the thing works. In a product
 * whose signature element is a rule coloured by confidence (§1.4), the list of
 * the objects it operates on carried no state at all.
 *
 * Derived, not stored. Every input is a column `listProjects` already returns,
 * so this adds no query, no table and no second record of a fact the row
 * already holds. That also means it cannot drift: there is nothing to keep in
 * sync.
 *
 * ## Why "no repository" is not a fault
 *
 * §6.3 draws the line at whether there is something whose state can be reported
 * at all. A project created a minute ago and not yet connected is not degraded
 * — nothing about it is failing, it is unfinished, and painting it amber would
 * claim a defect where there is a next step. It reads neutral, and the label
 * says what to do.
 *
 * A project *with* a repository and no target locales is the opposite case, and
 * the one worth colouring: it is fully configured as far as the reader can see
 * and it will refuse every run, because `startRun` returns before `start_run`
 * when `target_locales` is empty. That gap exists today and is reported today —
 * which is exactly what §6.2 permits colour for.
 */
export type Readiness = 'ready' | 'no-languages' | 'no-repository';

export interface ProjectShape {
  repository_owner: string | null;
  repository_name: string | null;
  target_locales: readonly string[] | null;
}

export function readiness(project: ProjectShape): Readiness {
  // Owner and name travel together — `projects_repository_is_whole` in the
  // schema makes the half-set state unrepresentable — so either one answers.
  if (!project.repository_owner || !project.repository_name) {
    return 'no-repository';
  }
  if ((project.target_locales ?? []).length === 0) return 'no-languages';
  return 'ready';
}

/**
 * The reading, in the reader's terms.
 *
 * `detail` is what to do next, not a restatement of the label. "Not connected"
 * followed by "Not connected yet" is chrome; followed by "Connect a repository
 * to run it" is the next step.
 */
export const READINESS: Record<
  Readiness,
  { tone: Tone; label: string; detail: string }
> = {
  ready: {
    tone: 'confident',
    label: 'Ready',
    detail: 'Connected and configured — a run has everything it needs.',
  },
  'no-languages': {
    tone: 'degraded',
    label: 'No target languages',
    detail:
      'A run would have nothing to do, so it is refused before it starts.',
  },
  'no-repository': {
    tone: 'neutral',
    label: 'Not connected',
    detail: 'Connect a repository to run it.',
  },
};
