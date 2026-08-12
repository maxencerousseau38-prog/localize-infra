import { EXAMPLE_PR_URL } from '@/lib/constants';
import { cn } from '@localize-infra/ui';
import { ArrowRight, GitPullRequest } from 'lucide-react';

/**
 * The hero artifact: one run, shown as the two files it actually touched.
 *
 * This replaces a two-column "found / written" card that quoted a single
 * invented string. Everything here was read back from the fixture repository
 * the linked pull request was opened against:
 *
 * - `src/App.tsx` is that file, verbatim, lines 4–6.
 * - The keys in `locales/en.json` are the keys the run produced — confirmed
 *   against the key set committed in the pull request — and their values are
 *   the strings above them in `App.tsx`.
 *
 * What it deliberately does not show is the translated file. `locales/es.json`
 * is the pull request's contents and the PrProof section renders it in full;
 * showing it twice would spend the page's strongest evidence on a repeat. The
 * hero shows extraction instead, which is the step that runs locally, needs no
 * account, and produces a file the reader owns before anything hits a network.
 *
 * The diff row model — dual gutters carrying the old and new line numbers, a
 * sign column, and the code — is adapted from 21st.dev's File Diff. That shape
 * is the correct one and is easy to get subtly wrong (a single line-number
 * column cannot represent an added line, which has no old number). Its styling
 * was not usable: it ships bare class names against a stylesheet that is not
 * included. Everything visual here is ours.
 *
 * Confidence colour is spent only on the added lines. The extracted strings on
 * the left are marked with `bg-active`, not with jade: finding a string is not
 * a confidence claim, and the state palette means one thing (DESIGN.md §6.1).
 */

/** A segment of a source line. `mark` is a string the extractor lifted out. */
type Segment = { text: string; mark?: true };

/** `src/App.tsx` in the fixture repository, lines 4–6, verbatim. */
const SOURCE: { line: number; segments: Segment[] }[] = [
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
      {
        text: 'This is a throwaway project used to validate the localize-infra CLI.',
        mark: true,
      },
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
];

type Row = {
  /** Line number before the change. `null` for an added line. */
  old: number | null;
  /** Line number after the change. `null` for a removed line. */
  cur: number;
  text: string;
};

/** `locales/en.json` as the run wrote it: a new file, so every line is added. */
const DIFF: Row[] = [
  { old: null, cur: 1, text: '{' },
  { old: null, cur: 2, text: '  "src.App.get_started": "Get started",' },
  {
    old: null,
    cur: 3,
    text: '  "src.App.this_is_a_throwaway_project_used_to_vali": "This is a throwaway project used to validate the localize-infra CLI.",',
  },
  {
    old: null,
    cur: 4,
    text: '  "src.App.welcome_to_the_fixture_app": "Welcome to the fixture app"',
  },
  { old: null, cur: 5, text: '}' },
];

export function HeroArtifact() {
  return (
    <figure className="overflow-hidden rounded-lg border border-line bg-canvas">
      {/* Repository context. The detected framework is not decoration: it is
          the first pipeline stage, and it is what the run actually printed. */}
      <figcaption className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-subtle bg-surface/60 px-4 py-2.5">
        <span className="font-mono text-caption text-secondary">
          localize-infra-fixture-vite
        </span>
        <span className="ms-auto font-mono text-micro uppercase tracking-wide text-tertiary">
          Detected: Vite + React
        </span>
      </figcaption>

      <div className="grid sm:grid-cols-2">
        {/* What it found — the reader's own code, unedited. */}
        <div className="min-w-0 border-b border-subtle sm:border-b-0 sm:border-e">
          <div className="flex items-center justify-between gap-3 border-b border-subtle bg-surface/30 px-4 py-2">
            <span className="truncate font-mono text-caption text-primary">
              src/App.tsx
            </span>
            <span className="shrink-0 font-mono text-micro uppercase tracking-wide text-tertiary">
              3 strings found
            </span>
          </div>

          {/* Focusable, because it scrolls. Real source lines are longer than
              this column and a scroll region a keyboard cannot reach is an axe
              violation — `scrollable-region-focusable`, which this panel
              introduced the moment it started showing unwrapped code. */}
          <section
            className="overflow-x-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
            // This rule and axe's `scrollable-region-focusable` disagree here.
            // The test is the one with a user behind it: without focus, nothing
            // reaches the hidden content from a keyboard.
            // biome-ignore lint/a11y/noNoninteractiveTabindex: scroll containers must take focus
            tabIndex={0}
            aria-label="Source of src/App.tsx"
          >
            <table className="w-full border-collapse font-mono text-caption">
              <caption className="sr-only">
                Lines 4 to 6 of src/App.tsx, with the three hardcoded strings
                highlighted
              </caption>
              <tbody>
                {SOURCE.map((row) => (
                  <tr key={row.line}>
                    <td
                      aria-hidden="true"
                      className="w-8 select-none px-2 py-0.5 text-end align-top text-tertiary tabular-nums"
                    >
                      {row.line}
                    </td>
                    <td className="whitespace-pre py-0.5 pe-4 align-top text-tertiary">
                      {row.segments.map((segment) =>
                        segment.mark ? (
                          <mark
                            key={segment.text}
                            className="rounded-xs bg-active px-0.5 text-primary"
                          >
                            {segment.text}
                          </mark>
                        ) : (
                          segment.text
                        ),
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>

        {/* What it wrote. Dual gutters, because an added line has no old
            number — and here every line is added, since the file is new. */}
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-3 border-b border-subtle bg-surface/30 px-4 py-2">
            <span className="truncate font-mono text-caption text-primary">
              locales/en.json
            </span>
            <span className="shrink-0 font-mono text-micro text-confident-text">
              +{DIFF.length}
            </span>
          </div>

          <section
            className="overflow-x-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
            // biome-ignore lint/a11y/noNoninteractiveTabindex: scroll containers must take focus
            tabIndex={0}
            aria-label="Diff of locales/en.json"
          >
            <table className="w-full border-collapse font-mono text-caption">
              <caption className="sr-only">
                Diff of locales/en.json — a new file, five lines added
              </caption>
              <tbody>
                {DIFF.map((row) => (
                  <tr key={row.cur} className="bg-confident-bg">
                    <td
                      aria-hidden="true"
                      className="w-8 select-none px-2 py-0.5 text-end align-top text-tertiary tabular-nums"
                    >
                      {row.old ?? ''}
                    </td>
                    <td
                      aria-hidden="true"
                      className="w-8 select-none px-2 py-0.5 text-end align-top text-tertiary tabular-nums"
                    >
                      {row.cur}
                    </td>
                    <td
                      aria-hidden="true"
                      className="w-4 select-none py-0.5 text-center align-top text-confident-text"
                    >
                      +
                    </td>
                    <td className="whitespace-pre py-0.5 pe-4 align-top text-primary">
                      {row.text}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </div>

      {/* Where the run ends. The pull request is open, not merged — the site's
          constraint is that every claim is true today, and "merged" would be a
          claim about a review that has not happened. No counts either: the link
          is the record. */}
      <a
        href={EXAMPLE_PR_URL}
        target="_blank"
        rel="noreferrer noopener"
        className={cn(
          'group flex items-center gap-3 border-t border-subtle px-4 py-3.5',
          'transition-colors hover:bg-surface active:bg-raised',
          'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
        )}
      >
        <GitPullRequest
          className="size-4 shrink-0 text-confident"
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1 text-body text-primary">
          <span className="font-medium">
            Translated and opened as a pull request
          </span>
          <span className="text-secondary">
            {' '}
            — open for review, like every other change
          </span>
        </span>
        <ArrowRight
          className="size-3.5 shrink-0 text-tertiary transition-transform duration-(--duration-micro) group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
          aria-hidden="true"
        />
      </a>
    </figure>
  );
}
