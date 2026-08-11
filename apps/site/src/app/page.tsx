import { GatedAction } from '@/components/conversion-dialog';
import { BuildStatus } from '@/components/landing/build-status';
import { Commitments } from '@/components/landing/commitments';
import { Ecosystem } from '@/components/landing/ecosystem';
import { Hero } from '@/components/landing/hero';
import { HowItWorks } from '@/components/landing/how-it-works';
import { PrProof } from '@/components/landing/pr-proof';
import { EXAMPLE_PR_URL } from '@/lib/constants';
import { Button } from '@localize-infra/ui';
import Link from 'next/link';

export default function HomePage() {
  return (
    <>
      <Hero />
      <PrProof />
      <HowItWorks />
      <Ecosystem />
      <Commitments />
      <BuildStatus />

      {/* The close. Previously a small heading and a command in the same
          left-aligned shape as every other section, which made the page end
          rather than finish. Centred is earned here — it is the one moment the
          page asks for a single thing — and the surface shift bookends the
          dark band above. */}
      <section className="border-t border-subtle bg-surface/60">
        <div className="mx-auto max-w-6xl px-4 py-24 text-center sm:px-6 sm:py-32">
          <h2 className="mx-auto max-w-[22ch] font-display text-display font-semibold tracking-[-0.03em] text-primary sm:text-display-lg">
            Run it on a real repository
          </h2>
          <p className="mx-auto mt-5 max-w-[52ch] text-prose text-secondary">
            Extraction runs locally and writes a file you own. Nothing leaves
            your machine until you ask for a translation.
          </p>

          {/*
           * This used to repeat the hero's `npx` command verbatim, with the
           * same "not on npm yet" disclaimer underneath — the second time on
           * one page that the most prominent thing offered was something that
           * does not work. DESIGN.md §4.5: once is an honest limitation, twice
           * reads as the product's main message.
           *
           * The close now asks for the action that exists today, and the
           * command's real home is the install section of the docs it points
           * at.
           */}
          {/*
           * The conversion point sits here, at the foot of the page, not at the
           * top of it. By this line a visitor has seen the artefact, the real
           * merged pull request, the four pipeline steps and a status board
           * naming what is not built — they have a reason to want the thing
           * before anything asks them for something.
           *
           * GatedAction checks entitlement first: a viewer who already has
           * access never sees a dialog at all.
           */}
          <div className="mx-auto mt-9 flex max-w-sm flex-col gap-3 sm:max-w-none sm:flex-row sm:flex-wrap sm:items-center sm:justify-center">
            <GatedAction className="w-full sm:w-auto">
              Run it on your repository
            </GatedAction>
            <Button
              asChild
              variant="secondary"
              size="lg"
              className="w-full sm:w-auto"
            >
              <a
                href={EXAMPLE_PR_URL}
                target="_blank"
                rel="noreferrer noopener"
              >
                See the pull request
              </a>
            </Button>
          </div>

          <p className="mt-5 text-small text-tertiary">
            The CLI runs from a clone today.{' '}
            <Link
              href="/roadmap"
              className="rounded-sm text-link underline underline-offset-2 hover:text-link-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              What is shipping next
            </Link>
            .
          </p>
        </div>
      </section>
    </>
  );
}
