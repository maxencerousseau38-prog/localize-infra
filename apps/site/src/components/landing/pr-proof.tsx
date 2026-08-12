import { EXAMPLE_PR_URL } from '@/lib/constants';
import { Badge } from '@localize-infra/ui';
import { ArrowUpRight, GitPullRequest } from 'lucide-react';

/**
 * The exact contents of the pull request the CLI opened during end-to-end
 * validation against a real repository. Not a mockup, not illustrative — this
 * is the committed file, verbatim, from the linked PR.
 *
 * Showing the real artefact is the section's entire argument: every competitor
 * can claim a GitHub workflow, and none of them link to the output.
 */
/*
 * One entry per line in the file. The long value used to be broken across two
 * entries so it would fit the column, which gave it two `+` markers and made a
 * 5-line addition render as 6 — the count beside the filename said "+6" to
 * match. GitHub reports `+5`. The line is whole again and the block scrolls.
 */
const DIFF_LINES: { text: string; kind: 'add' | 'context' }[] = [
  { text: '{', kind: 'add' },
  { text: '  "src.App.get_started": "Comenzar",', kind: 'add' },
  {
    text: '  "src.App.this_is_a_throwaway_project_used_to_vali": "Este es un proyecto desechable que se utiliza para validar la CLI de localize-infra.",',
    kind: 'add',
  },
  {
    text: '  "src.App.welcome_to_the_fixture_app": "Bienvenido a la aplicación de prueba"',
    kind: 'add',
  },
  { text: '}', kind: 'add' },
];

export function PrProof() {
  return (
    <section className="border-y border-subtle bg-primary text-inverse">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-16">
          <div>
            <p className="text-eyebrow font-medium uppercase text-inverse/70">
              The deliverable
            </p>
            <h2 className="mt-3 font-display text-headline font-semibold text-inverse">
              A pull request, not a dashboard
            </h2>
            <p className="mt-4 text-prose text-inverse/70">
              Not a dashboard you have to log into. Your existing review process
              already knows how to handle a diff — so translations arrive the
              same way every other change does.
            </p>
            <p className="mt-4 text-prose text-inverse/70">
              This is the real file from a real run: 22 seconds, end to end,
              against a live repository.
            </p>
            <a
              href={EXAMPLE_PR_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-6 inline-flex items-center gap-1.5 rounded-sm text-body font-medium text-inverse underline underline-offset-4 decoration-inverse/40 transition-colors hover:decoration-inverse focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              Open the pull request on GitHub
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </a>
          </div>

          <figure className="min-w-0">
            <div className="overflow-hidden rounded-lg border border-line bg-canvas shadow-e1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-subtle px-4 py-3">
                <GitPullRequest
                  className="size-4 shrink-0 text-confident"
                  aria-hidden="true"
                />
                <span className="text-body font-medium text-primary">
                  Add translations (de, ja, es, ar, pt-BR)
                </span>
                {/* Open, not merged. Nobody has reviewed it — claiming a merge
                    would claim a review that never happened. */}
                <Badge tone="neutral">Open</Badge>
              </div>

              <div className="flex items-center justify-between border-b border-subtle px-4 py-2">
                <code className="font-mono text-caption text-tertiary">
                  locales/es.json
                </code>
                <span
                  className="font-mono text-caption text-confident-text"
                  data-numeric
                >
                  +{DIFF_LINES.length}
                </span>
              </div>

              {/* Focusable: restoring the long value to one line made this
                  block scroll, and a scroll region a keyboard cannot reach is
                  an axe violation. The scroll lives on the wrapper so the
                  element carrying it can be a `section` — `pre` cannot take the
                  region role without the semantics rule objecting. */}
              <section
                className="overflow-x-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
                // biome-ignore lint/a11y/noNoninteractiveTabindex: scroll containers must take focus
                tabIndex={0}
                aria-label="Contents of locales/es.json"
              >
                <pre className="px-4 py-3 text-caption leading-6">
                  <code className="font-mono">
                    {DIFF_LINES.map((line) => (
                      <span
                        key={line.text}
                        className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-2"
                      >
                        <span
                          aria-hidden="true"
                          className="select-none text-confident-text/70"
                        >
                          +
                        </span>
                        {/* Spanish content: marked so screen readers switch voice
                          rather than reading it with an English pronunciation. */}
                        <span lang="es" className="text-primary">
                          {line.text}
                        </span>
                      </span>
                    ))}
                  </code>
                </pre>
              </section>
            </div>
            <figcaption className="mt-3 text-small text-inverse/70">
              Output of <code className="font-mono">init --open-pr</code> on a
              Vite + React project.
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
