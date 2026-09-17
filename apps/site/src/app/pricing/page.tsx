import { PageHeader } from '@/components/page-header';
import {
  CLI_PERSONAL_TOKENS_LIVE,
  HOSTED_API_LIMITS,
  INSTALL_COMMAND,
} from '@/lib/constants';
import { Badge, CopyCommand, StateRule } from '@localize-infra/ui';
import { Check, X } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  alternates: { canonical: '/pricing' },
  title: 'Pricing',
  description:
    'Flat pricing, never metered by words, characters, keys or seats. Public repositories are free permanently. Final prices are not set yet, and we say so.',
};

const NEVER_METERED = [
  'Words translated',
  'Characters processed',
  'Keys stored',
  'Seats or reviewers',
];

const AXES = [
  {
    axis: 'Private projects',
    why: 'Correlates with how much of your product we serve, and it is a number you choose rather than one your success inflates.',
  },
  {
    axis: 'Active languages',
    why: 'Adding a language is a deliberate decision with real value attached. Adding ten thousand strings to an existing language is not, and will never cost more.',
  },
];

export default function PricingPage() {
  return (
    <>
      <PageHeader
        eyebrow="Pricing"
        title="Your bill should not change shape when your product succeeds"
        lede="Most localization platforms meter something that grows as you grow — words, keys, or seats. We will not, and this page exists to make that difficult to walk back."
      />

      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] lg:gap-16">
          <section aria-labelledby="pledge">
            <h2
              id="pledge"
              className="font-display text-headline font-semibold text-primary"
            >
              What we will never charge for
            </h2>
            <ul className="mt-6 space-y-3">
              {NEVER_METERED.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <X
                    // Graphite, not crimson. Crimson means a run failed; "we will never
                    // charge for words" is a commitment, not a failure state, and
                    // spending the failure colour on it is the same leak that put
                    // Iris on roadmap items (DESIGN.md §6.3).
                    className="mt-0.5 size-4 shrink-0 text-tertiary"
                    aria-hidden="true"
                  />
                  <span className="text-subtitle text-secondary">{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6 max-w-[62ch] text-body leading-6 text-secondary">
              Not as a launch promotion, and not as a number displayed “for
              transparency”. A counter that exists is a counter that becomes
              billable under the first revenue pressure, so the product does not
              compute one.
            </p>

            <h2 className="mt-12 font-display text-headline font-semibold text-primary">
              What price will depend on
            </h2>
            <dl className="mt-6 space-y-5">
              {AXES.map(({ axis, why }) => (
                <div key={axis}>
                  <dt className="flex items-center gap-2 text-subtitle font-medium text-primary">
                    <Check
                      // Jade means verified or current. A pricing axis is neither.
                      className="size-4 text-tertiary"
                      aria-hidden="true"
                    />
                    {axis}
                  </dt>
                  <dd className="ms-6 mt-1 max-w-[58ch] text-body leading-6 text-secondary">
                    {why}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <aside className="lg:pt-1">
            <StateRule tone="confident">
              <h2 className="text-prose font-semibold text-primary">
                Public repositories
              </h2>
              <p className="mt-2 font-display text-headline font-semibold text-primary">
                Free
              </p>
              <p className="mt-2 text-body leading-6 text-secondary">
                Unlimited, permanently. No language cap, no seat cap, no trial
                clock.
              </p>
              {/*
                This said "no string cap" until the hosted API grew one. It is
                not a meter and nothing here is billed by volume — invariant 3
                forbids that — but a ceiling a user can hit is a ceiling the
                page has to name, whatever it is called internally.
              */}
              <p className="mt-2 text-body leading-6 text-secondary">
                One limit, and it is there to stop runaway scripts rather than
                to charge you:{' '}
                {HOSTED_API_LIMITS.stringsPerDay.toLocaleString('en-US')}{' '}
                strings and {HOSTED_API_LIMITS.pullRequestsPerDay} pull requests
                a day per workspace on our hosted API, resetting at 00:00 UTC.
                Ask us if you need more. Self-host the API and there is no
                ceiling at all.
              </p>
            </StateRule>

            <div className="mt-8">
              <CopyCommand command={INSTALL_COMMAND} />
              {/* "Extraction runs locally and costs nothing" was true of the
                  half that never bills anyone. Translation runs through the
                  reader's own API and provider key, so the model calls are a
                  cost — theirs, not ours. A pricing page is where that line
                  matters most. */}
              {/*
                Both halves of this changed with CLI 0.3.0: the default is our
                hosted API, used with a personal token, so the model bill is
                ours until someone points --api-url elsewhere. The flag is the
                same one the landing page and /docs read.
              */}
              <p className="mt-3 text-small leading-5 text-tertiary">
                {CLI_PERSONAL_TOKENS_LIVE
                  ? 'The CLI is free. By default it translates through our hosted API with a personal token from your workspace; point --api-url at your own instance to use your own provider key instead.'
                  : 'The CLI is free. Translation runs on an API you host with your own provider key, so the model bill is yours, not ours.'}
              </p>
            </div>
          </aside>
        </div>

        {/* Publishing unmodelled prices would contradict the same honesty this
            page is arguing for. The commitment is firm; the numbers are not. */}
        <StateRule tone="neutral" className="mt-16 max-w-[72ch]">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-title font-semibold text-primary">
              Paid plans are not priced yet
            </h2>
            <Badge tone="neutral">In development</Badge>
          </div>
          <p className="mt-3 text-prose text-secondary">
            There is no billing system, and nothing is charged today. We could
            put plausible numbers on this page — most pre-launch products do —
            but we have not finished modelling what the service actually costs
            to run, and quoting a price we might have to raise is precisely the
            behaviour that made teams start looking for an alternative in the
            first place.
          </p>
          <p className="mt-3 text-prose text-secondary">
            The commitment above is firm regardless of where the numbers land:
            flat, per project and active language, never metered by volume.
          </p>
        </StateRule>
      </div>
    </>
  );
}
