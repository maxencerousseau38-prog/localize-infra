import { READINESS, readiness } from '@/lib/projects/readiness';
import type { Project } from '@/lib/supabase/database.types';
import { StateRule, StatusDot } from '@localize-infra/ui';
import Link from 'next/link';

/**
 * The workspace's projects, as the page's subject rather than its footnote.
 *
 * They were a list of bare rows at the bottom of the page, below a GitHub panel
 * and an activation funnel — three bordered surfaces at one weight, and the
 * thing the page is named after arriving last and lightest. §4.6 is about
 * vertical density, but the failure here is ordering: a reader scanning for
 * their projects read two panels of setup first, every visit, forever.
 *
 * ## The State Rule, on the list it was missing from
 *
 * §1.4 calls the 3px leading-edge rule the product's signature and says it goes
 * everywhere copy appears. This list had none. Each row now carries one,
 * coloured by whether the project can actually run — see `readiness`, which
 * derives it from columns the row already holds.
 *
 * The rule is decorative on its own, which is why the tone is also spelt out in
 * words beside it (§13, WCAG 1.4.1). `StatusDot` carries that pairing already,
 * so the row does not invent a second way to say the same thing.
 *
 * ## One line of metadata, not three floating spans
 *
 * The slug, the source locale and the target count were three separately
 * positioned elements, two of which disappeared at breakpoints. They are one
 * monospace line now: it scans in a single pass, it survives 390px, and the
 * repository — which was not shown at all, on a page about connecting
 * repositories — is in it.
 */
export function ProjectList({
  orgSlug,
  projects,
}: {
  orgSlug: string;
  projects: readonly Project[];
}) {
  return (
    <ul className="mt-6 flex flex-col gap-2">
      {projects.map((project) => {
        const state = READINESS[readiness(project)];
        const targets = project.target_locales ?? [];
        return (
          <li key={project.id}>
            <StateRule
              tone={state.tone}
              /*
               * `group` and `relative` on the rule itself so the whole row is
               * one click target with one focus stop — the pattern the runs
               * table already uses. `ps-4` comes from StateRule; the rest of
               * the padding is the row's own.
               */
              className="group relative rounded-e-md py-3.5 pe-3 transition-colors hover:bg-surface has-[a:focus-visible]:bg-surface"
            >
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <Link
                  href={`/${orgSlug}/projects/${project.slug}`}
                  className="min-w-0 text-subtitle font-semibold text-primary after:absolute after:inset-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
                >
                  {project.name}
                </Link>
                <span className="shrink-0">
                  <StatusDot tone={state.tone}>{state.label}</StatusDot>
                </span>
              </div>

              <p className="mt-1.5 truncate font-mono text-caption text-tertiary">
                {project.repository_owner && project.repository_name
                  ? `${project.repository_owner}/${project.repository_name}`
                  : project.slug}
                <span aria-hidden="true"> · </span>
                {project.source_locale}
                <span aria-hidden="true"> → </span>
                {targets.length > 0 ? (
                  targets.join(', ')
                ) : (
                  <span className="text-degraded-text">none</span>
                )}
              </p>
            </StateRule>
          </li>
        );
      })}
    </ul>
  );
}
