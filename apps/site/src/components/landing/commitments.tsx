import { Badge, StateRule, type Tone } from '@localize-infra/ui';

/**
 * The three commitments.
 *
 * The previous version was three equal cards, which flattened the most
 * interesting thing about this content: each promise is at a *different stage
 * of being kept*. One is working, one is half-built, one is a commitment with
 * no code behind it — and that distinction was a line of small grey text at the
 * bottom of each card.
 *
 * Now the status is the organising principle. Full-width rows put the promise
 * at heading scale with its honest state directly beneath, prose to the right,
 * and the State Rule down the leading edge coloured by whether the promise is
 * actually kept. A reader scanning the left column alone gets the truth.
 *
 * The rule's tone tracks delivery, not subject matter — the second commitment
 * is *about* ambiguity but is *degraded* in practice, and Iris means one thing
 * in this system: your judgement is required. It is not spent on roadmap state.
 */
const COMMITMENTS: Array<{
  title: string;
  body: string;
  tone: Tone;
  status: string;
  detail?: string;
}> = [
  {
    title: 'Cancel and keep everything',
    body: 'Your translations are committed to your repository as ordinary JSON. There is no export step, because there is nothing to export from. Delete your account and run git pull — everything is still there.',
    tone: 'confident',
    status: 'Working today',
  },
  {
    title: 'It tells you when it doesn’t know',
    body: '“Close” is a verb on a button and an adjective in a sentence, and German needs a different word for each. Guessing produces plausible, wrong copy that nobody catches. Strings the model could not resolve are reported, never silently filled in.',
    tone: 'degraded',
    status: 'Partly working',
    detail:
      'Unresolved strings are reported today. The queue for resolving them is in development.',
  },
  {
    title: 'No counters, ever',
    body: 'We will not meter words, characters, keys, or seats. Pricing is flat, per project and active language, so your bill does not change shape when your product succeeds. Public repositories are free, permanently.',
    tone: 'neutral',
    status: 'Not built yet',
    detail: 'A commitment, not a feature. Nothing is charged today.',
  },
];

export function Commitments() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
      <div className="max-w-2xl">
        <p className="text-caption font-medium uppercase tracking-[0.14em] text-tertiary">
          Commitments
        </p>
        <h2 className="mt-3 font-display text-headline font-semibold tracking-[-0.02em] text-primary">
          Three promises, and whether we keep them yet
        </h2>
      </div>

      {/*
       * Single-column rows, not a 5/7 split (DESIGN.md §4.4).
       *
       * This section and the status board that follows it were both
       * twelve-column rail-and-content layouts carrying prose — different
       * content, identical structural signature, and the page read as one long
       * two-column list through both of them. The rule now forbids adjacent
       * sections from sharing that signature.
       *
       * Rows suit three promises better than a split does anyway: the claim and
       * the honest qualifier belong on the same reading line, not in separate
       * columns the eye has to pair up. The status board keeps the split, and
       * the two now look like different kinds of thing — which they are: three
       * arguments here, eleven measured facts there.
       */}
      <ul className="mt-12">
        {COMMITMENTS.map(({ title, body, tone, status, detail }) => (
          <li key={title} className="border-t border-subtle first:border-t-0">
            <StateRule tone={tone} className="py-8">
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
                <h3 className="font-display text-title font-semibold tracking-[-0.02em] text-primary">
                  {title}
                </h3>
                <Badge tone={tone}>{status}</Badge>
              </div>
              <p className="mt-4 max-w-[68ch] text-prose text-secondary">
                {body}
              </p>
              {detail ? (
                <p className="mt-3 max-w-[68ch] text-small leading-6 text-tertiary">
                  {detail}
                </p>
              ) : null}
            </StateRule>
          </li>
        ))}
      </ul>
    </section>
  );
}
