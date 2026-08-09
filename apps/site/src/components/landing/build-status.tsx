import { cn } from '@localize-infra/ui';
import { Check, Minus, Wrench } from 'lucide-react';

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
 */
type State = 'working' | 'building' | 'unmeasured';

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
  building: {
    label: 'In development',
    icon: Wrench,
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
    name: 'Review queue for unresolved strings',
    state: 'building',
    note: 'They are reported today, not yet resolvable here',
  },
  {
    name: 'Typed SDK',
    state: 'building',
    note: 'A missing key should fail the build, not the user',
  },
  { name: 'Review surface for non-developers', state: 'building' },
  { name: 'Hosted accounts, projects and billing', state: 'building' },
  {
    name: 'Human preference benchmarks per language',
    state: 'unmeasured',
    note: 'The evaluation harness is built; the study has not run',
  },
];

export function BuildStatus() {
  return (
    <section className="border-t border-subtle bg-surface/40">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-4">
            <p className="text-caption font-medium uppercase tracking-[0.14em] text-tertiary">
              Status
            </p>
            <h2 className="mt-3 font-display text-headline font-semibold tracking-[-0.02em] text-primary">
              What actually works today
            </h2>
            <p className="mt-4 text-prose text-secondary">
              This is an early-access product. Rather than describe the roadmap
              in the present tense, here is the honest state of it.
            </p>
            <p className="mt-4 text-small leading-6 text-tertiary">
              Six of eleven capabilities ship today. The rest are named here
              rather than implied elsewhere.
            </p>
          </div>

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
                        a single scannable strip rather than eleven labels. */}
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
