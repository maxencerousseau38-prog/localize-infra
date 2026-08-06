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
const DIFF_LINES: { text: string; kind: 'add' | 'context' }[] = [
  { text: '{', kind: 'add' },
  { text: '  "src.App.get_started": "Comenzar",', kind: 'add' },
  {
    text: '  "src.App.this_is_a_throwaway_project_used_to_vali": "Este es un proyecto',
    kind: 'add',
  },
  {
    text: '    desechable que se utiliza para validar la CLI de localize-infra.",',
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
    <section className="border-t border-subtle bg-surface/40">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-16">
          <div>
            <h2 className="text-[26px] font-semibold leading-tight tracking-[-0.015em] text-primary">
              The deliverable is a pull request
            </h2>
            <p className="mt-4 text-[15px] leading-7 text-secondary">
              Not a dashboard you have to log into. Your existing review process
              already knows how to handle a diff — so translations arrive the
              same way every other change does.
            </p>
            <p className="mt-4 text-[15px] leading-7 text-secondary">
              This is the real file from a real run: 22 seconds, end to end,
              against a live repository.
            </p>
            <a
              href={EXAMPLE_PR_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-5 inline-flex items-center gap-1.5 rounded-sm text-[14px] font-medium text-link hover:text-link-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
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
                <span className="text-[14px] font-medium text-primary">
                  Add translations (de, ja, es, ar, pt-BR)
                </span>
                <Badge tone="confident">Merged</Badge>
              </div>

              <div className="flex items-center justify-between border-b border-subtle px-4 py-2">
                <code className="font-mono text-[12px] text-tertiary">
                  locales/es.json
                </code>
                <span
                  className="font-mono text-[12px] text-confident-text"
                  data-numeric
                >
                  +6
                </span>
              </div>

              <pre className="overflow-x-auto px-4 py-3 text-[12px] leading-6">
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
            </div>
            <figcaption className="mt-3 text-[13px] text-tertiary">
              Output of <code className="font-mono">init --open-pr</code> on a
              Vite + React project.
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
