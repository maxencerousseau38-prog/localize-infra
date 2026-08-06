import { EXAMPLE_PR_URL, INSTALL_COMMAND } from '@/lib/constants';
import { CopyCommand } from '@localize-infra/ui';
import { ArrowRight } from 'lucide-react';

export function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-16 pt-20 sm:px-6 sm:pb-24 sm:pt-28">
      <div className="max-w-3xl">
        <p className="text-[13px] font-medium uppercase tracking-wide text-tertiary">
          Localization infrastructure
        </p>

        {/* Measure capped near 20ch/line at display size: long lines at 48px+
            are genuinely hard to track back to the next line. */}
        <h1 className="mt-4 max-w-[19ch] text-[40px] font-semibold leading-[1.08] tracking-[-0.02em] text-primary sm:text-[52px]">
          Your copy is a build artifact, not a project.
        </h1>

        <p className="mt-6 max-w-[58ch] text-[17px] leading-7 text-secondary sm:text-[18px]">
          Extract the hardcoded strings from your codebase, translate them, and
          open a pull request. The translations live in your repository — not in
          someone else&rsquo;s database.
        </p>

        <div className="mt-9 max-w-xl">
          <CopyCommand command={INSTALL_COMMAND} />
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
    </section>
  );
}
