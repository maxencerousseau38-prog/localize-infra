import { EXAMPLE_PR_URL, INSTALL_COMMAND } from '@/lib/constants';
import { CopyCommand } from '@localize-infra/ui';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { HeroOutput } from './hero-output';

export function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-16 pt-16 sm:px-6 sm:pb-24 sm:pt-20">
      {/* Two columns from lg: the argument on the left, the artefact it produces
          on the right. A single narrow column left ~40% of a desktop viewport
          empty, which reads unfinished rather than spacious. */}
      <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-16">
        <div>
          <p className="text-[13px] font-medium uppercase tracking-wide text-tertiary">
            Localization infrastructure
          </p>

          {/* Measure capped near 20ch/line at display size: long lines at 48px+
              are genuinely hard to track back to the next line. */}
          <h1 className="mt-4 max-w-[19ch] text-[40px] font-semibold leading-[1.08] tracking-[-0.02em] text-primary sm:text-[52px]">
            Your copy is a build artifact, not a project.
          </h1>

          <p className="mt-6 max-w-[52ch] text-[17px] leading-7 text-secondary sm:text-[18px]">
            Extract the hardcoded strings from your codebase, translate them,
            and open a pull request. The translations live in your repository —
            not in someone else&rsquo;s database.
          </p>

          <div className="mt-9 max-w-xl">
            <CopyCommand command={INSTALL_COMMAND} />
            {/* The command is the destination, not the current state. Leaving
                it unqualified would mean the site's primary action fails for
                everyone who copies it. */}
            <p className="mt-2.5 text-[13px] leading-6 text-tertiary">
              Not published to npm yet — this is where it is going. Today it
              runs from a clone:{' '}
              <Link
                href="/docs#install"
                className="rounded-sm text-link underline underline-offset-2 hover:text-link-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                see the docs
              </Link>
              .
            </p>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2">
            <a
              href={EXAMPLE_PR_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="group inline-flex items-center gap-1.5 rounded-sm text-[14px] font-medium text-link transition-colors hover:text-link-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              See a real pull request
              <ArrowRight
                className="size-3.5 transition-transform duration-(--duration-micro) group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
                aria-hidden="true"
              />
            </a>
            <p className="text-[14px] text-tertiary">
              No account needed to extract your first strings.
            </p>
          </div>
        </div>

        {/* Hidden below lg: at tablet width it would compress into an
            unreadable code block, and it is supporting evidence, not content. */}
        <div className="hidden lg:block">
          <HeroOutput />
        </div>
      </div>
    </section>
  );
}
