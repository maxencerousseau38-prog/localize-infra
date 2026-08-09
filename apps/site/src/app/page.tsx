import { BuildStatus } from '@/components/landing/build-status';
import { Commitments } from '@/components/landing/commitments';
import { Ecosystem } from '@/components/landing/ecosystem';
import { Hero } from '@/components/landing/hero';
import { HowItWorks } from '@/components/landing/how-it-works';
import { PrProof } from '@/components/landing/pr-proof';
import { INSTALL_COMMAND } from '@/lib/constants';
import { CopyCommand } from '@localize-infra/ui';
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

          <div className="mx-auto mt-9 max-w-xl text-start">
            <CopyCommand command={INSTALL_COMMAND} />
          </div>

          <p className="mt-4 text-small text-tertiary">
            Not on npm yet —{' '}
            <Link
              href="/docs#install"
              className="rounded-sm text-link underline underline-offset-2 hover:text-link-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              run it from a clone
            </Link>
            .
          </p>
        </div>
      </section>
    </>
  );
}
