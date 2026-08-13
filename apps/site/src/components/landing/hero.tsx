import { RunArtifact } from '@/components/landing/run-artifact';
import { EXAMPLE_PR_URL, INSTALL_COMMAND } from '@/lib/constants';
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
      <section className="mx-auto max-w-6xl px-4 pb-12 pt-16 sm:px-6 sm:pb-14 sm:pt-20">
        <p className="text-eyebrow font-medium uppercase text-tertiary">
          Localization infrastructure
        </p>

        <h1 className="mt-5 max-w-[15ch] font-display text-display-xl font-semibold text-primary lg:text-display-2xl">
          Your copy is a build artifact.
        </h1>

        <div className="mt-6 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          {/* One sentence. The panel below is the explanation; a second
              paragraph here only delays it. */}
          <p className="max-w-[46ch] text-prose text-secondary">
            Point the CLI at your repository. It finds the strings you
            hardcoded, translates them in context, and opens a pull request —
            leaving everything else in your stack exactly where it was.
          </p>

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

      {/* Honest about what it is: a command that is not published yet. */}
      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
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
      </section>
    </>
  );
}
