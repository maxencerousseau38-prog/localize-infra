import { EXAMPLE_PR_URL } from '@/lib/constants';
import { PIPELINE_STAGES, type PipelineStageId, cn } from '@localize-infra/ui';
import { ArrowUpRight, GitPullRequest } from 'lucide-react';

/**
 * One run, as the instrument that produced it.
 *
 * This replaces two separate sections — a hero panel showing extraction and a
 * dark band showing the pull request — which between them rendered the same
 * repository twice and made the reader assemble the sequence themselves. The
 * transformation is the product, so it is shown as one frame: their code on the
 * left, the file the run wrote on the right, the five stages that connect them
 * across the top, and the pull request underneath.
 *
 * The banded shape — state header, drawn flow, body, footer of facts — is
 * adapted from 21st.dev's AI Agent Pipeline. What that component gets right is
 * that a system reads as *running* when its chrome reports state and its flow
 * is drawn rather than implied by column order. What it does for effect, we do
 * not: no dots travelling the connectors forever, no invented counters, no
 * accent colour spent on decoration. Every value here is from the linked run.
 *
 * Colour follows DESIGN.md §6.3: it reports the state of something that
 * exists. Jade marks a stage that completed, and all five did — Escalate
 * included, which ran and reads `0 raised`. A stage that finished having found
 * nothing to raise has still finished.
 *
 * What Escalate is *not* is Iris (§1.4). Iris means your judgement is required,
 * and claiming it where nothing is pending would spend the one signal the
 * product is built around — so the note carries the nuance in words instead.
 *
 * This paragraph used to state that argument as "Escalate is neutral", which
 * was the right reasoning about Iris written as a false claim about the
 * colour: `escalate: { done: true }` has always painted it jade, like the four
 * stages either side of it.
 */

/** What the linked run actually did at each stage. */
const STAGE_STATE: Record<PipelineStageId, { done: boolean; note: string }> = {
  detect: { done: true, note: 'Vite + React' },
  extract: { done: true, note: '3 strings' },
  translate: { done: true, note: 'es' },
  escalate: { done: true, note: '0 raised' },
  'pull-request': { done: true, note: '#1 open' },
};

type Segment = { text: string; mark?: true };

/** `src/App.tsx` in the fixture repository, whole file, verbatim. */
const SOURCE: { line: number; segments: Segment[] }[] = [
  { line: 1, segments: [{ text: 'export function App() {' }] },
  { line: 2, segments: [{ text: '  return (' }] },
  { line: 3, segments: [{ text: '    <main>' }] },
  {
    line: 4,
    segments: [
      { text: '      <h1>' },
      { text: 'Welcome to the fixture app', mark: true },
      { text: '</h1>' },
    ],
  },
  {
    line: 5,
    segments: [
      { text: '      <p>' },
      { text: 'This is a throwaway project…', mark: true },
      { text: '</p>' },
    ],
  },
  {
    line: 6,
    segments: [
      { text: '      <button type="button">' },
      { text: 'Get started', mark: true },
      { text: '</button>' },
    ],
  },
  { line: 7, segments: [{ text: '    </main>' }] },
  { line: 8, segments: [{ text: '  )' }] },
  { line: 9, segments: [{ text: '}' }] },
];

/**
 * What the run touched, as the repository sees it.
 *
 * `en.json` is marked local: extraction writes it into the working tree, and it
 * is not part of the pull request. Saying so is the difference between showing
 * a run and implying a bigger one than happened.
 */
const FILES: {
  path: string;
  meta: string;
  state: 'unchanged' | 'added' | 'local';
}[] = [
  { path: 'src/App.tsx', meta: 'read', state: 'unchanged' },
  { path: 'locales/en.json', meta: '+3 local', state: 'local' },
  { path: 'locales/es.json', meta: '+5', state: 'added' },
];

/** `locales/es.json` exactly as the pull request adds it: a new file, +5. */
const OUTPUT: string[] = [
  '{',
  '  "src.App.get_started": "Comenzar",',
  '  "src.App.this_is_a_throwaway_project…": "Este es un proyecto…",',
  '  "src.App.welcome_to_the_fixture_app": "Bienvenido a la aplicación de prueba"',
  '}',
];

function StageRail() {
  return (
    <ol className="flex min-w-max items-stretch">
      {PIPELINE_STAGES.map((stage, i) => {
        const state = STAGE_STATE[stage.id];
        return (
          <li
            key={stage.id}
            className={cn(
              // No `min-w-0`: it existed to let these cells shrink below their
              // content so `truncate` had something to do. With the text no
              // longer truncating, it was the remaining reason Detect's
              // "Vite + React" still lost 17px — a flex item may not shrink
              // under its content unless you say so, and this said so.
              'relative flex flex-1 flex-col gap-1 px-3 py-2.5 sm:px-4',
              i > 0 && 'border-s border-subtle',
            )}
          >
            <span className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={cn(
                  'size-1.5 shrink-0 rounded-full',
                  state.done ? 'bg-confident' : 'bg-subtle',
                )}
              />
              {/*
               * `whitespace-nowrap`, never `truncate`.
               *
               * These cells carried `truncate`, which combined with `flex-1`
               * capped every stage at ~101px at 390px and clipped two of them
               * even though the rail was already scrolling: the stage name
               * "Pull request" lost 6px and Detect's "Vite + React" lost 17px.
               * A rail that scrolls *and* truncates is the worst of both — the
               * reader pans across and still cannot read the cell. Stage names
               * are the product's identity (DESIGN.md §1.4) and clipping one to
               * "Pull reques…" drops the word as surely as renaming it would.
               *
               * With no truncation the `min-w-max` on the list gives each cell
               * its natural width and the existing scroll container does the
               * work it was always there to do.
               */}
              <span className="whitespace-nowrap text-caption font-medium text-primary">
                {stage.name}
              </span>
            </span>
            <span className="whitespace-nowrap ps-3.5 font-mono text-micro text-tertiary">
              {state.note}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function RunArtifact() {
  return (
    <figure className="overflow-hidden rounded-xl border border-line bg-canvas shadow-e2">
      {/* What was run, and against what. */}
      <figcaption className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-subtle bg-surface/60 px-4 py-2.5 sm:px-5">
        <span className="font-mono text-caption text-secondary">
          localize-infra-fixture-vite
        </span>
        <span aria-hidden="true" className="text-tertiary">
          /
        </span>
        <span className="truncate font-mono text-caption text-primary">
          localize-infra/add-translations
        </span>
        <span className="ms-auto font-mono text-micro uppercase tracking-wide text-tertiary">
          22s
        </span>
      </figcaption>

      {/* The five stages, drawn. Scrolls rather than wrapping below sm, so the
          sequence never breaks into two rows that read as two pipelines — and
          because it scrolls, it has to be reachable from a keyboard. */}
      <section
        aria-label="Run progress"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: scroll containers must take focus
        tabIndex={0}
        className="overflow-x-auto border-b border-subtle bg-surface/30 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
      >
        <StageRail />
      </section>

      {/* The transformation, as a review surface: what the run touched, the
          file it read, the file it wrote. */}
      <div className="grid lg:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_minmax(0,1fr)]">
        {/* Files touched. The column that makes this a repository rather than
            two code samples side by side. */}
        <div className="border-b border-subtle bg-surface/30 px-3 py-3 lg:border-b-0 lg:border-e">
          <p className="px-1 pb-2 text-eyebrow font-medium uppercase text-tertiary">
            Files touched
          </p>
          <ul className="flex flex-col">
            {FILES.map((file) => (
              <li key={file.path}>
                <span className="flex items-baseline gap-2 rounded-sm px-1 py-1 font-mono text-caption">
                  <span
                    className={cn(
                      'min-w-0 flex-1 truncate',
                      file.state === 'unchanged'
                        ? 'text-tertiary'
                        : 'text-primary',
                    )}
                  >
                    {file.path}
                  </span>
                  <span
                    className={cn(
                      'shrink-0 text-micro',
                      file.state === 'added'
                        ? 'text-confident-text'
                        : 'text-tertiary',
                    )}
                  >
                    {file.meta}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t border-subtle px-1 pt-3 text-micro leading-5 text-tertiary">
            Nothing outside <span className="font-mono">locales/</span> is
            written.
          </p>
        </div>

        <div className="min-w-0 border-b border-subtle lg:border-b-0 lg:border-e">
          <PaneHeader
            path="src/App.tsx"
            meta="your code, unchanged"
            tone="neutral"
          />
          {/* Focusable: real source lines outrun this column, and a scroll
              region a keyboard cannot reach is an axe violation. */}
          <section
            aria-label="Source of src/App.tsx"
            // biome-ignore lint/a11y/noNoninteractiveTabindex: scroll containers must take focus
            tabIndex={0}
            className="overflow-x-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
          >
            <pre className="px-4 py-3 font-mono text-caption leading-6 sm:px-5">
              <code>
                {SOURCE.map((row) => (
                  <span key={row.line} className="grid grid-cols-[1.5rem_1fr]">
                    <span
                      aria-hidden="true"
                      className="select-none text-end pe-3 text-tertiary tabular-nums"
                    >
                      {row.line}
                    </span>
                    <span className="text-tertiary">
                      {row.segments.map((s) =>
                        s.mark ? (
                          <mark
                            key={s.text}
                            className="rounded-xs bg-active px-0.5 text-primary"
                          >
                            {s.text}
                          </mark>
                        ) : (
                          s.text
                        ),
                      )}
                    </span>
                  </span>
                ))}
              </code>
            </pre>
          </section>
        </div>

        <div className="min-w-0 bg-confident-bg/20">
          <PaneHeader
            path="locales/es.json"
            meta="+5, new file"
            tone="confident"
          />
          <section
            aria-label="Contents of locales/es.json"
            // biome-ignore lint/a11y/noNoninteractiveTabindex: scroll containers must take focus
            tabIndex={0}
            className="overflow-x-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
          >
            <pre className="px-4 py-3 font-mono text-caption leading-6 sm:px-5">
              <code>
                {OUTPUT.map((line) => (
                  <span key={line} className="grid grid-cols-[1.5rem_1fr]">
                    <span
                      aria-hidden="true"
                      className="select-none text-end pe-3 text-confident-text/70"
                    >
                      +
                    </span>
                    {/* Spanish copy, declared so a screen reader switches voice. */}
                    <span lang="es" className="text-primary">
                      {line}
                    </span>
                  </span>
                ))}
              </code>
            </pre>
          </section>
        </div>
      </div>

      {/* Where it ended. Open, not merged — nobody has reviewed it. */}
      <a
        href={EXAMPLE_PR_URL}
        target="_blank"
        rel="noreferrer noopener"
        className={cn(
          'group flex items-center gap-3 border-t border-subtle px-4 py-3.5 sm:px-5',
          'transition-colors hover:bg-surface active:bg-raised',
          'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
        )}
      >
        <GitPullRequest
          className="size-4 shrink-0 text-confident"
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1 truncate text-body text-primary">
          <span className="font-medium">
            Add translations (de, ja, es, ar, pt-BR)
          </span>
        </span>
        <span className="hidden shrink-0 font-mono text-micro uppercase tracking-wide text-tertiary sm:inline">
          review it like any other change
        </span>
        <ArrowUpRight
          className="size-3.5 shrink-0 text-tertiary transition-transform duration-(--duration-micro) group-hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0"
          aria-hidden="true"
        />
      </a>
    </figure>
  );
}

function PaneHeader({
  path,
  meta,
  tone,
}: {
  path: string;
  meta: string;
  tone: 'neutral' | 'confident';
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-subtle px-4 py-2 sm:px-5">
      <span className="truncate font-mono text-caption text-primary">
        {path}
      </span>
      <span
        className={cn(
          'shrink-0 font-mono text-micro',
          tone === 'confident' ? 'text-confident-text' : 'text-tertiary',
        )}
      >
        {meta}
      </span>
    </div>
  );
}
