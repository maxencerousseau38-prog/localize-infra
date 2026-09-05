import { RunArtifact } from '@/components/landing/run-artifact';
import {
  CLI_PUBLISHED_TO_NPM,
  EXAMPLE_PR_URL,
  INSTALL_COMMAND,
} from '@/lib/constants';
import { Button, CopyCommand } from '@localize-infra/ui';
import { GitPullRequest } from 'lucide-react';
import Link from 'next/link';

/**
 * The hero.
 *
 * Previously: headline, then a product panel sitting on the same white ground
 * as the six sections beneath it, then the install line. It was composed
 * correctly and had no focal point — the page opened at the same visual
 * temperature it held for the next five thousand pixels, and the artifact read
 * as one more card rather than as the thing being sold.
 *
 * Now the words and the product are on different grounds. The argument stays on
 * canvas at a narrow measure; the run drops onto a full-bleed dark band and is
 * the first thing on the page with any weight to it. That band also absorbs the
 * old PrProof section, which showed the same repository a second time further
 * down — one run, shown once, at the moment it does the most work.
 */
export function Hero() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pb-8 pt-10 sm:px-6 sm:pb-10 sm:pt-14">
        {/*
         * An asymmetric split, not a headline with a void beside it.
         *
         * Measured at 1440: the argument occupied the left half and the right
         * half held nothing for roughly 300px of height, with the action row
         * pushed to the far edge of that emptiness — the dead zone DESIGN.md
         * §4.5.2 names as a defect rather than whitespace. The slack is now
         * composed away with content that was already on the page: the
         * terminal path, which used to sit in an orphaned strip *below* the
         * run and interrupted the page's strongest moment to do it.
         *
         * The section is also ~180px shorter, which is the point. The run
         * artifact is the best argument this page has, and it began below the
         * fold on every desktop viewport (DESIGN.md §4.5.1).
         */}
        {/*
         * The split starts at xl, not lg, and the terminal column is 30rem.
         *
         * Both numbers were measured rather than chosen. `CopyCommand`
         * truncates rather than overflows, and the install command needs 28rem
         * of *inner* width at `subtitle` mono — so 28rem here silently ate
         * `init`, because this panel spends 1rem of padding on each side. And
         * at lg the container is only 976px, which would leave the headline
         * 466px: enough to break a 68px display line three ways. Below xl the
         * panel stacks full width, where it has more room than any split gave
         * it.
         */}
        {/* gap-6 below xl: this is now the space between the action row and a
            single-line terminal strip that belongs with it, not the space
            between two blocks. gap-10 at xl is a column gutter, a different
            job. */}
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] xl:items-start xl:gap-10">
          <div>
            <p className="text-eyebrow font-medium uppercase text-tertiary">
              Localization infrastructure
            </p>

            {/*
             * 500, not 600, and only at this step.
             *
             * §3.3 allows 400, 500 and 600, and bans 700 because "at these
             * sizes it reads as shouting on a neutral ground". That reason does
             * not stop at 700: at `display-2xl` (68px) the argument applies to
             * 600 as well, and the headline was carrying maximum size *and*
             * maximum weight at once. Compared side by side at 1440, 500 reads
             * as a statement and 600 as a claim being pressed — which is the
             * register §1.3 rules out.
             *
             * Section headings stay at 600. They run at `display-lg` (40px),
             * where 600 has the optical weight this has at 500, and `PageHeader`
             * already sets them there — one step, one weight, rather than a
             * blanket change that would have made every page title lighter for
             * a reason that only holds at 68px.
             */}
            <h1 className="mt-4 max-w-[15ch] font-display text-display-xl font-medium text-primary lg:text-display-2xl">
              Your copy is a build artifact.
            </h1>

            {/* One sentence. The run below is the explanation; a second
                paragraph here only delays it. */}
            <p className="mt-5 max-w-[46ch] text-prose text-secondary">
              Point the CLI at your repository. It finds the strings you
              hardcoded, translates them in context, and opens a pull request —
              leaving everything else in your stack exactly where it was.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                asChild
                variant="primary"
                size="lg"
                className="w-full sm:w-auto"
              >
                <a
                  href={EXAMPLE_PR_URL}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <GitPullRequest aria-hidden="true" />
                  See the pull request it opened
                </a>
              </Button>
              <Button
                asChild
                variant="secondary"
                size="lg"
                className="w-full sm:w-auto"
              >
                <Link href="/docs#install">Read the docs</Link>
              </Button>
            </div>
          </div>

          {/*
           * The terminal path, demoted on purpose.
           *
           * `npx @localize-infra/cli init` is the action this product is
           * heading for, and it does not work today — the package is not
           * published. DESIGN.md §4.5.3 is explicit that an unavailable
           * nominal primary action is demoted and the strongest *working*
           * action promoted, which is why the pull request keeps the filled
           * button and this sits in a quiet panel saying what it is.
           */}
          {/*
           * Two arrangements, because the tiers are genuinely different
           * problems rather than one problem at two sizes.
           *
           * At xl this is a column beside the headline: panel chrome, label
           * above, command and note stacked. It costs nothing vertically —
           * measured at 1280 the left block is 366px and this is 150px, so it
           * sits inside the space the argument already occupies.
           *
           * From 1024 to 1279 it cannot be a column at all. The left column
           * needs 584px (the width at which the 68px display headline breaks
           * in two) and the command box needs ~448px not to truncate, which is
           * 1064px before the gap — against a 976px container. Measured, not
           * guessed. So it stacks, and as a stacked block it was costing
           * 32px of gap plus 116px of height: the entire 148px by which this
           * tier's hero exceeded 1280's, pushing the run that much further
           * below the fold.
           *
           * Stacked it is therefore a strip, not a block — command and note
           * side by side, no label, because a heading on a control sitting
           * directly beneath the actions it belongs to is a label for
           * something already obvious.
           */}
          <div className="xl:mt-2 xl:rounded-lg xl:border xl:border-line xl:bg-surface/60 xl:p-4">
            {/* `text-eyebrow`, which carries its own 0.14em. The hand-written
                tracking this replaced was a seventh copy of a value the scale
                already defines (§3.3), and packages/ui's type-scale test
                enumerates the two files allowed to do that. */}
            <p className="hidden text-eyebrow font-medium uppercase text-tertiary xl:block">
              From your terminal
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5 xl:mt-3 xl:flex-col xl:items-stretch xl:gap-3">
              <div className="w-full sm:max-w-md xl:max-w-none">
                <CopyCommand command={INSTALL_COMMAND} />
              </div>
              {/* Both halves of this sentence come from CLI_PUBLISHED_TO_NPM,
                  which /docs also reads. It was prose in two places about one
                  external fact, which is one place that gets forgotten. */}
              <p className="text-small leading-6 text-tertiary">
                {CLI_PUBLISHED_TO_NPM
                  ? 'It needs an API you run yourself — the hosted one is not open. '
                  : 'Not published to npm yet — today it runs from a clone. '}
                <Link
                  href="/docs#install"
                  className="rounded-sm text-link underline underline-offset-2 hover:text-link-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  Install guide
                </Link>
                .
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* The run, on its own ground. Full-bleed and dark: this is the one
          moment the page asks the reader to stop and look at the product. */}
      <section
        aria-label="A run against a real repository"
        className="border-y border-subtle bg-primary"
      >
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
          <RunArtifact />

          <p className="mt-4 text-small text-inverse/60">
            A real run against a real repository, linked above. Nothing on this
            page is a mockup.
          </p>
        </div>
      </section>
    </>
  );
}
