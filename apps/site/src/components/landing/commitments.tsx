import { StateRule } from '@localize-infra/ui';
import { GitBranch, HelpCircle, Receipt } from 'lucide-react';

/**
 * The three claims the product is built on. Each carries an explicit status
 * line, because two of the three are commitments about behaviour rather than
 * shipped surfaces — and a marketing page that blurs that distinction is
 * exactly the thing this product is positioned against.
 */
const COMMITMENTS = [
  {
    Icon: GitBranch,
    tone: 'confident' as const,
    title: 'Cancel and keep everything',
    body: 'Your translations are committed to your repository as ordinary JSON. There is no export step, because there is nothing to export from. Delete your account and run git pull — everything is still there.',
    status: 'Working today.',
  },
  {
    Icon: HelpCircle,
    tone: 'ambiguous' as const,
    title: 'It tells you when it doesn’t know',
    body: '“Close” is a verb on a button and an adjective in a sentence, and German needs a different word for each. Guessing produces plausible, wrong copy that nobody catches. Strings the model could not resolve are reported, never silently filled in.',
    status:
      'Partially working: unresolved strings are reported today. The review queue for resolving them is in development.',
  },
  {
    Icon: Receipt,
    tone: 'neutral' as const,
    title: 'No counters, ever',
    body: 'We will not meter words, characters, keys, or seats. Pricing is flat, per project and active language, so your bill does not change shape when your product succeeds. Public repositories are free, permanently.',
    status: 'Commitment. Billing is not built yet — nothing is charged today.',
  },
];

export function Commitments() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <h2 className="max-w-2xl text-[26px] font-semibold leading-tight tracking-[-0.015em] text-primary">
        Three commitments that shape everything else
      </h2>

      <ul className="mt-10 grid gap-8 lg:grid-cols-3 lg:gap-10">
        {COMMITMENTS.map(({ Icon, tone, title, body, status }) => (
          <li key={title}>
            {/* The State Rule: the design system's signature element, carrying
                the same meaning here that it carries inside the product. */}
            <StateRule tone={tone} className="h-full">
              <Icon
                className={
                  tone === 'ambiguous'
                    ? 'size-5 text-ambiguous'
                    : tone === 'confident'
                      ? 'size-5 text-confident'
                      : 'size-5 text-tertiary'
                }
                aria-hidden="true"
              />
              <h3 className="mt-3 text-[17px] font-semibold text-primary">
                {title}
              </h3>
              <p className="mt-2 text-[14px] leading-6 text-secondary">
                {body}
              </p>
              <p className="mt-3 text-[13px] leading-5 text-tertiary">
                {status}
              </p>
            </StateRule>
          </li>
        ))}
      </ul>
    </section>
  );
}
