import { SectionHeading } from '@/components/landing/section-heading';
import { cn } from '@localize-infra/ui';
import { Check, Circle, Minus } from 'lucide-react';

/**
 * The honesty section, as a status board.
 *
 * Most pre-launch sites present the roadmap as though it shipped. This one
 * states plainly what runs today and what does not — which is both the correct
 * thing to do and, given the product's positioning on not guessing, the only
 * consistent thing to do.
 *
 * The previous version split that into three parallel columns, which asked the
 * reader to scan sideways to answer "is X built?" — the one question this
 * section exists for. One continuous board answers it by reading down.
 *
 * **Only what works carries colour.** Jade marks shipped capability; everything
 * unshipped is graphite. That is the palette rule applied to the product's own
 * maturity, and it replaces an Iris that had leaked onto "in development" —
 * Iris means your judgement is required, and it is not spent on roadmap state.
 *
 * **"In development" is gone because nothing was in development.** Four rows
 * wore it. One — hosted accounts and projects — had shipped. One — the review
 * queue — was built and deployed but has never handled a real question. Three —
 * the SDK, the non-developer surface, billing — had no code and no commits.
 * "In development" told a reader work was under way on all four. The states
 * below say which of those each one is.
 */
type State = 'working' | 'unproven' | 'notStarted' | 'unmeasured';

const STATE: Record<
  State,
  { label: string; icon: typeof Check; mark: string; text: string }
> = {
  working: {
    label: 'Working',
    icon: Check,
    mark: 'border-confident bg-confident text-inverse',
    text: 'text-primary',
  },
  unproven: {
    label: 'Built, not yet used',
    icon: Circle,
    mark: 'border-subtle bg-raised text-tertiary',
    text: 'text-secondary',
  },
  notStarted: {
    label: 'Not started',
    icon: Minus,
    mark: 'border-subtle bg-raised text-tertiary',
    text: 'text-secondary',
  },
  unmeasured: {
    label: 'Not measured',
    icon: Minus,
    mark: 'border-subtle bg-raised text-tertiary',
    text: 'text-secondary',
  },
};

const ITEMS: Array<{ name: string; state: State; note?: string }> = [
  {
    name: 'Framework detection',
    state: 'working',
    note: 'Next.js, Vite + React, React Native',
  },
  {
    name: 'Hardcoded string extraction',
    state: 'working',
    note: 'AST-based, not a regular expression',
  },
  { name: 'Translation into any target language', state: 'working' },
  {
    name: 'Merge that never overwrites your edits',
    state: 'working',
    note: 'A translation you changed by hand is kept',
  },
  {
    name: 'Per-language failure isolation',
    state: 'working',
    note: 'One failure never aborts the run',
  },
  {
    name: 'Branch, commit and pull request',
    state: 'working',
    note: 'Through a GitHub App you install',
  },
  {
    name: 'Hosted app: accounts, workspaces, projects, runs',
    state: 'working',
    note: 'Early access, sign-up open. Private repositories are not self-serve yet',
  },
  {
    name: 'Answering unresolved strings before the pull request',
    state: 'unproven',
    note: 'In the hosted app. No real run has raised a question yet',
  },
  {
    name: 'Typed SDK',
    state: 'notStarted',
    note: 'A missing key should fail the build, not the user',
  },
  { name: 'Review surface for non-developers', state: 'notStarted' },
  {
    name: 'Billing',
    state: 'notStarted',
    note: 'Nothing is priced until the cost of running it is modelled',
  },
  {
    name: 'Human preference benchmarks per language',
    state: 'unmeasured',
    note: 'The evaluation harness is built; the study has not run',
  },
];

/*
 * Counted, not written. "Six of eleven" was a sentence beside a list, and the
 * list could change without it.
 */
const WORKING = ITEMS.filter((item) => item.state === 'working').length;

export function BuildStatus() {
  return (
    <section className="border-t border-subtle bg-surface/40">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
          <SectionHeading
            className="lg:col-span-4"
            eyebrow="Status"
            title="What actually works today"
          >
            <p className="mt-4 text-prose text-secondary">
              This is an early-access product. Rather than describe the roadmap
              in the present tense, here is the honest state of it.
            </p>
            <p className="mt-4 text-small leading-6 text-tertiary">
              {WORKING} of {ITEMS.length} capabilities ship today. The rest are
              named here rather than implied elsewhere.
            </p>
          </SectionHeading>

          <div className="lg:col-span-8">
            <ul className="border-t border-subtle">
              {ITEMS.map((item) => {
                const state = STATE[item.state];
                const Icon = state.icon;
                return (
                  <li
                    key={item.name}
                    className="flex items-start gap-3 border-b border-subtle py-3.5"
                  >
                    <span
                      className={cn(
                        'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border',
                        state.mark,
                      )}
                    >
                      <Icon
                        className="size-2.5"
                        aria-hidden="true"
                        strokeWidth={3}
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn('text-body font-medium', state.text)}>
                        {item.name}
                      </span>
                      {item.note ? (
                        <span className="mt-0.5 block text-small leading-5 text-tertiary">
                          {item.note}
                        </span>
                      ) : null}
                    </span>
                    {/* The state as words, right-aligned so the column reads as
                        a single scannable strip rather than a column of labels. */}
                    <span className="shrink-0 text-caption uppercase tracking-wide text-tertiary">
                      {state.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
