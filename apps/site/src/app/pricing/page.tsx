import { PageHeader } from '@/components/page-header';
import { INSTALL_COMMAND } from '@/lib/constants';
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
            <h2 id="pledge" className="text-[22px] font-semibold text-primary">
              What we will never charge for
            </h2>
            <ul className="mt-6 space-y-3">
              {NEVER_METERED.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <X
                    className="mt-0.5 size-4 shrink-0 text-failed"
                    aria-hidden="true"
                  />
                  <span className="text-[15px] leading-6 text-secondary">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-6 max-w-[62ch] text-[14px] leading-6 text-secondary">
              Not as a launch promotion, and not as a number displayed “for
              transparency”. A counter that exists is a counter that becomes
              billable under the first revenue pressure, so the product does not
              compute one.
            </p>

            <h2 className="mt-12 text-[22px] font-semibold text-primary">
              What price will depend on
            </h2>
            <dl className="mt-6 space-y-5">
              {AXES.map(({ axis, why }) => (
                <div key={axis}>
                  <dt className="flex items-center gap-2 text-[15px] font-medium text-primary">
                    <Check
                      className="size-4 text-confident"
                      aria-hidden="true"
                    />
                    {axis}
                  </dt>
                  <dd className="ms-6 mt-1 max-w-[58ch] text-[14px] leading-6 text-secondary">
                    {why}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <aside className="lg:pt-1">
            <StateRule tone="confident">
              <h2 className="text-[17px] font-semibold text-primary">
                Public repositories
              </h2>
              <p className="mt-2 text-[28px] font-semibold tracking-tight text-primary">
                Free
              </p>
              <p className="mt-2 text-[14px] leading-6 text-secondary">
                Unlimited, permanently. No language cap, no string cap, no seat
                cap, no trial clock.
              </p>
            </StateRule>

            <div className="mt-8">
              <CopyCommand command={INSTALL_COMMAND} />
              <p className="mt-3 text-[13px] leading-5 text-tertiary">
                Extraction runs locally and costs nothing.
              </p>
            </div>
          </aside>
        </div>

        {/* Publishing unmodelled prices would contradict the same honesty this
            page is arguing for. The commitment is firm; the numbers are not. */}
        <StateRule tone="ambiguous" className="mt-16 max-w-[72ch]">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-[20px] font-semibold text-primary">
              Paid plans are not priced yet
            </h2>
            <Badge tone="ambiguous">In development</Badge>
          </div>
          <p className="mt-3 text-[15px] leading-7 text-secondary">
            There is no billing system, and nothing is charged today. We could
            put plausible numbers on this page — most pre-launch products do —
            but we have not finished modelling what the service actually costs
            to run, and quoting a price we might have to raise is precisely the
            behaviour that made teams start looking for an alternative in the
            first place.
          </p>
          <p className="mt-3 text-[15px] leading-7 text-secondary">
            The commitment above is firm regardless of where the numbers land:
            flat, per project and active language, never metered by volume.
          </p>
        </StateRule>
      </div>
    </>
  );
}
