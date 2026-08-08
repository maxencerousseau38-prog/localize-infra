import { Check, CircleDashed, Minus } from 'lucide-react';

/**
 * The honesty section.
 *
 * Most pre-launch sites present the roadmap as though it shipped. This one
 * states plainly what runs today and what does not — which is both the correct
 * thing to do and, given the product's positioning on not guessing, the only
 * consistent thing to do. A visitor who installs the CLI expecting the hosted
 * dashboard and finds nothing would be a self-inflicted trust failure.
 */
const WORKING = [
  'Framework detection — Next.js, Vite + React, React Native',
  'Hardcoded string extraction from your source (AST-based)',
  'Translation into any target language',
  'Merge that never overwrites a translation you edited by hand',
  'Per-language failure isolation — one failure never aborts the run',
  'Branch, commit and pull request via a GitHub App',
];

const IN_DEVELOPMENT = [
  'Review queue for strings the model could not resolve',
  'Typed SDK — a missing key fails the build, not the user',
  'Review surface for non-developers',
  'Hosted accounts, projects and billing',
];

const NOT_MEASURED = [
  'Human preference benchmarks per language — the evaluation harness is built, the study has not run',
];

export function BuildStatus() {
  return (
    <section className="border-t border-subtle bg-surface/40">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="max-w-2xl">
          <h2 className="font-display text-headline font-semibold tracking-[-0.015em] text-primary">
            What actually works today
          </h2>
          <p className="mt-4 text-prose text-secondary">
            This is an early-access product. Rather than describe the roadmap in
            the present tense, here is the honest state of it.
          </p>
        </div>

        <div className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          <section aria-labelledby="status-working">
            <h3
              id="status-working"
              className="flex items-center gap-2 text-small font-medium uppercase tracking-wide text-confident-text"
            >
              <Check className="size-3.5" aria-hidden="true" />
              Working
            </h3>
            <ul className="mt-4 space-y-2.5">
              {WORKING.map((item) => (
                <li
                  key={item}
                  className="text-body leading-6 text-secondary before:me-2 before:text-confident before:content-['—']"
                >
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="status-development">
            <h3
              id="status-development"
              className="flex items-center gap-2 text-small font-medium uppercase tracking-wide text-ambiguous-text"
            >
              <CircleDashed className="size-3.5" aria-hidden="true" />
              In development
            </h3>
            <ul className="mt-4 space-y-2.5">
              {IN_DEVELOPMENT.map((item) => (
                <li
                  key={item}
                  className="text-body leading-6 text-secondary before:me-2 before:text-ambiguous before:content-['—']"
                >
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="status-unmeasured">
            <h3
              id="status-unmeasured"
              className="flex items-center gap-2 text-small font-medium uppercase tracking-wide text-tertiary"
            >
              <Minus className="size-3.5" aria-hidden="true" />
              Not yet measured
            </h3>
            <ul className="mt-4 space-y-2.5">
              {NOT_MEASURED.map((item) => (
                <li
                  key={item}
                  className="text-body leading-6 text-secondary before:me-2 before:text-tertiary before:content-['—']"
                >
                  {item}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </section>
  );
}
