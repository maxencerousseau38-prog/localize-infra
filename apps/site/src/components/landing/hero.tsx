import { HeroArtifact } from '@/components/landing/hero-artifact';
import { EXAMPLE_PR_URL, INSTALL_COMMAND } from '@/lib/constants';
import { Button, CopyCommand } from '@localize-infra/ui';
import { GitPullRequest } from 'lucide-react';
import Link from 'next/link';

/**
 * The hero.
 *
 * Recomposed from a 7/5 split — argument left, artifact in a narrow card on the
 * right — into a headline band over a full-width product panel.
 *
 * The split was the problem. This product's whole claim is a transformation you
 * can see, and putting that transformation in five columns beside a 68px
 * headline made the claim compete with its own evidence and lose: the artifact
 * read as an illustration next to the copy rather than as the thing being sold.
 * Every serious developer tool resolves this the same way, by letting the
 * product occupy the full measure and putting the words above it.
 *
 * So the panel is now the widest element on the page and shows the run in one
 * frame — the source file, the three strings it found there, the locale file it
 * wrote, and the pull request it opened. A visitor who reads nothing still sees
 * what the product does.
 *
 * The `npx` command moves below the panel. It is honest and it belongs on the
 * page, but it was the third competing element in a column that already had a
 * headline and two buttons, and it is a command that does not work yet.
 */

export function Hero() {
  // No bottom rule on this section. The panel ends on "Opened as a pull
  // request" and the very next thing on the page is the dark band showing that
  // pull request — a hairline between them reads as a boundary between two
  // topics when it is one argument continuing.
  return (
    <section className="relative">
      <div className="mx-auto max-w-6xl px-4 pb-20 pt-16 sm:px-6 sm:pb-24 sm:pt-20">
        {/* The words. Held to a narrow measure and left-aligned against the
            same grid the panel below uses, so the two read as one block rather
            than as a centred banner sitting on a product shot. */}
        <p className="text-eyebrow font-medium uppercase text-tertiary">
          Localization infrastructure
        </p>

        <h1 className="mt-5 max-w-[16ch] font-display text-display-xl font-semibold text-primary lg:text-display-2xl">
          Your copy is a build artifact.
        </h1>

        <div className="mt-6 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <p className="max-w-[52ch] text-prose text-secondary">
            Localize Infra extracts the hardcoded strings from your codebase,
            translates them in context, and opens a pull request. The
            translations live in your repository — not in someone else&rsquo;s
            database.
          </p>

          {/*
           * The primary action is the one that works today (DESIGN.md §4.5).
           * Full-width and stacked below sm, where intrinsic-width buttons
           * against a full-bleed column are the scaled-down-desktop tell.
           */}
          <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center">
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

        {/* The panel: one run, shown as the repository it changed. */}
        <div className="mt-12 sm:mt-14">
          <HeroArtifact />
        </div>

        {/* Below the panel, where it does not compete. Honest about what it is:
            a command that is not published yet. */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
          <div className="w-full sm:max-w-md">
            <CopyCommand command={INSTALL_COMMAND} />
          </div>
          <p className="text-small leading-6 text-tertiary">
            Not published to npm yet — today it runs from a clone.{' '}
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
    </section>
  );
}
