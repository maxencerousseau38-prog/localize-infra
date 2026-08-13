import {
  PIPELINE_STAGES,
  type PipelineStageId,
  StateRule,
  cn,
} from '@localize-infra/ui';

/**
 * The pipeline, drawn.
 *
 * This was four numbered paragraphs of roughly sixty words each — the section a
 * reader consults to find out what happens to their repository, written as a
 * document. Nobody reads four paragraphs to decide whether to try a CLI, and
 * the sequence, which is the actual argument, was carried only by the numbers.
 *
 * It is now the five canonical stages as a connected rail, one clause each,
 * every clause taken from `PIPELINE_STAGES` so the words here cannot drift from
 * the words in the product (DESIGN.md §1.4). The prose that used to explain
 * Escalate is spent instead on showing one — because the claim that the agent
 * surfaces ambiguity rather than guessing is the difference between this and a
 * translation API, and it is the only claim on the page that needs an example
 * to land.
 *
 * That example is the one place Iris appears on this site. It means your
 * judgement is required, and here it is: nobody has answered this question yet.
 */

/** What each stage leaves behind, shown as the reader would see it. */
const ARTIFACT: Record<PipelineStageId, string> = {
  detect: 'Vite + React',
  extract: 'locales/en.json',
  translate: 'locales/<locale>.json',
  escalate: 'a question, not a guess',
  'pull-request': 'one branch, one commit',
};

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
      <div className="max-w-2xl">
        <p className="text-eyebrow font-medium uppercase text-tertiary">
          How it works
        </p>
        <h2 className="mt-3 font-display text-headline font-semibold text-primary">
          One command, five stages, no new tab
        </h2>
      </div>

      {/* The rail. A row of connected nodes above lg, a spine below it — the
          same sequence either way, never two rows that read as two pipelines. */}
      <ol
        aria-label="The five pipeline stages"
        className="mt-10 grid gap-y-8 lg:grid-cols-5 lg:gap-x-6"
      >
        {PIPELINE_STAGES.map((stage, i) => {
          const last = i === PIPELINE_STAGES.length - 1;
          return (
            <li key={stage.id} className="relative ps-8 lg:ps-0 lg:pt-8">
              {/* Connector. Runs to the next node and stops at the last. */}
              {!last && (
                <span
                  aria-hidden="true"
                  className="absolute start-[7px] top-4 bottom-[-2rem] w-px bg-subtle lg:start-4 lg:top-[7px] lg:bottom-auto lg:h-px lg:w-[calc(100%+1.5rem)]"
                />
              )}
              <span
                aria-hidden="true"
                className={cn(
                  'absolute start-0 top-1 size-3.5 rounded-full border-2 bg-canvas lg:top-0',
                  i === 0 ? 'border-confident' : 'border-strong',
                )}
              />

              <p className="font-mono text-micro uppercase tracking-wide text-tertiary">
                {String(i + 1).padStart(2, '0')}
              </p>
              <h3 className="mt-1.5 text-subtitle font-semibold text-primary">
                {stage.name}
              </h3>
              <p className="mt-1.5 text-small leading-6 text-secondary">
                {stage.summary}
              </p>
              <p className="mt-2.5 truncate font-mono text-micro text-tertiary">
                {ARTIFACT[stage.id]}
              </p>
            </li>
          );
        })}
      </ol>

      {/* The one stage that needs showing rather than describing. */}
      <div className="mt-16 grid gap-8 border-t border-subtle pt-10 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-16">
        <div>
          <p className="text-eyebrow font-medium uppercase text-tertiary">
            Stage 04, in practice
          </p>
          <h3 className="mt-3 font-display text-title font-semibold text-primary">
            It asks instead of guessing
          </h3>
          <p className="mt-3 text-prose text-secondary">
            A translation API returns a string for every input, including the
            ones it had no way to get right. Where the code does not settle the
            question, the run reports it and moves on — the other strings still
            ship.
          </p>
        </div>

        {/*
         * Neutral, not `ambiguous`, and a test enforces it site-wide.
         *
         * This card depicts an unresolved string, so Iris looks like the honest
         * choice — but nobody reading a marketing page is being asked to
         * resolve anything. Painting the ambiguity colour here would spend the
         * product's one judgement-required signal on an illustration of itself,
         * which is exactly the dilution DESIGN.md §1.4 forbids. The content and
         * the two-option list carry the meaning without it.
         */}
        <StateRule
          tone="neutral"
          className="rounded-e-lg bg-surface/60 py-5 pe-5"
        >
          <p className="font-mono text-caption text-tertiary">
            src/components/Dialog.tsx:24
          </p>
          <p className="mt-2 text-title font-medium text-primary">
            &ldquo;Close&rdquo;
          </p>
          <p className="mt-3 max-w-[52ch] text-small leading-6 text-secondary">
            A verb on a button, an adjective in a sentence. German needs
            different words for each, and the surrounding code does not say
            which this is.
          </p>
          <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 border-t border-subtle pt-4">
            <div>
              <dt className="font-mono text-micro uppercase tracking-wide text-tertiary">
                If it is the verb
              </dt>
              <dd lang="de" className="mt-1 text-body text-primary">
                Schließen
              </dd>
            </div>
            <div>
              <dt className="font-mono text-micro uppercase tracking-wide text-tertiary">
                If it is the adjective
              </dt>
              <dd lang="de" className="mt-1 text-body text-primary">
                Nah
              </dd>
            </div>
          </dl>
        </StateRule>
      </div>
    </section>
  );
}
