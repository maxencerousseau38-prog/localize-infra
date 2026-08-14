import { GatedAction } from '@/components/conversion-dialog';
import { BuildStatus } from '@/components/landing/build-status';
import { Commitments } from '@/components/landing/commitments';
import { Ecosystem } from '@/components/landing/ecosystem';
import { Hero } from '@/components/landing/hero';
import { HowItWorks } from '@/components/landing/how-it-works';
import { EXAMPLE_PR_URL } from '@/lib/constants';
import Link from 'next/link';

export default function HomePage() {
  return (
    <>
      {/* PrProof used to sit between these two. It showed the same repository
          and the same diff the hero already shows, one screen later — the page
          made its strongest argument twice and neither time at full strength.
          The run now appears once, in the hero, on its own dark ground. */}
      <Hero />
      <HowItWorks />
      <Ecosystem />
      <Commitments />
      <BuildStatus />

      {/* The close. Previously a small heading and a command in the same
          left-aligned shape as every other section, which made the page end
          rather than finish. Centred is earned here — it is the one moment the
          page asks for a single thing — and the surface shift bookends the
          dark band above. */}
      {/*
       * Canvas, not a third tinted band. Ecosystem and the status board above
       * are both `surface`, and closing on `surface/60` made the last third of
       * the page one continuous grey with hairlines through it. The page now
       * alternates deliberately — canvas, dark, canvas, surface, canvas,
       * surface, canvas — so a reader feels sections change rather than
       * scrolling through an undifferentiated field.
       */}
      {/*
       * The close bookends the hero.
       *
       * The page opens with a run against our fixture repository, on a dark
       * band; it ends by asking for a run against theirs, on the same ground.
       * That pairing is the argument — you have seen exactly what arrives, now
       * point it at your own code — and it reads as a deliberate return rather
       * than the centred call-to-action every developer site ends on.
       *
       * By this line the reader has seen the artefact, the five stages, an
       * escalation, what the CLI leaves alone and a board naming what is not
       * built. Conversion is asked for after the value, never before it.
       */}
      <section className="border-t border-subtle bg-primary">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-end lg:gap-16">
            <div>
              <p className="text-eyebrow font-medium uppercase text-inverse/60">
                Your turn
              </p>
              <h2 className="mt-3 max-w-[18ch] font-display text-display font-semibold text-inverse sm:text-display-lg">
                Now point it at yours
              </h2>
              <p className="mt-4 max-w-[46ch] text-prose text-inverse/70">
                Extraction runs locally and writes a file you own. Nothing
                leaves your machine until you ask for a translation.
              </p>
            </div>

            <div className="lg:pb-1">
              {/*
               * Both buttons are re-toned for an inverse band.
               *
               * `primary` paints itself `bg-primary` — the same token this band
               * uses — so on it the button had a 1:1 background contrast with
               * its own ground in *both* themes, and read as bare text rather
               * than a control. `secondary` paints `bg-canvas`, which on an
               * inverse band is the high-contrast treatment, so it was quietly
               * louder than the primary action beside it.
               *
               * The roles swap to match the ground: the primary action takes
               * the solid canvas fill, and the secondary becomes an outline in
               * the band's own foreground colour. Both track the theme, because
               * every token here is the semantic pair, not a fixed colour.
               */}
              {/*
               * One filled action on the page, and it is not this one.
               *
               * This band used to carry a canvas-filled "Run it on your
               * repository" — the loudest control on the dark ground — while
               * the hero carried a graphite-filled link to the pull request.
               * Two primaries, where DESIGN.md §10 allows one.
               *
               * §4.5.3 settles which survives rather than leaving it to taste:
               * the primary must be an action that works today, and where the
               * nominal one is unavailable — it names a gated beta explicitly —
               * it is demoted and the strongest working action promoted. This
               * button opens a dialog explaining that hosted accounts are not
               * built. The pull request is real and open. So the fold keeps the
               * fill and this becomes an outline.
               *
               * The pull request link goes with it, from a second button to
               * plain text. It is the same destination the hero already sends
               * people to at full weight; a second button for it here competed
               * with the one thing this section exists to ask.
               */}
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <GatedAction
                  variant="secondary"
                  className="w-full border-inverse/30 bg-transparent text-inverse hover:bg-inverse/10 active:bg-inverse/15 sm:w-auto"
                >
                  Run it on your repository
                </GatedAction>
              </div>
              <p className="mt-5 text-small text-inverse/60">
                The CLI runs from a clone today. Read{' '}
                <a
                  href={EXAMPLE_PR_URL}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="rounded-sm text-inverse underline underline-offset-2 decoration-inverse/40 hover:decoration-inverse focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  the pull request it opened
                </a>{' '}
                or{' '}
                <Link
                  href="/roadmap"
                  className="rounded-sm text-inverse underline underline-offset-2 decoration-inverse/40 hover:decoration-inverse focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  what is shipping next
                </Link>
                .
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
