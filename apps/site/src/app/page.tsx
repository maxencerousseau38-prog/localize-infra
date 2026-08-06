import { BuildStatus } from '@/components/landing/build-status';
import { Commitments } from '@/components/landing/commitments';
import { Hero } from '@/components/landing/hero';
import { HowItWorks } from '@/components/landing/how-it-works';
import { PrProof } from '@/components/landing/pr-proof';
import { INSTALL_COMMAND } from '@/lib/constants';
import { CopyCommand } from '@localize-infra/ui';

export default function HomePage() {
  return (
    <>
      <Hero />
      <PrProof />
      <HowItWorks />
      <Commitments />
      <BuildStatus />

      <section className="border-t border-subtle">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="max-w-xl">
            <h2 className="text-[26px] font-semibold leading-tight tracking-[-0.015em] text-primary">
              Try it on a real repository
            </h2>
            <p className="mt-3 text-[15px] leading-7 text-secondary">
              Extraction runs locally and writes a file you own. Nothing is sent
              anywhere until you ask for a translation.
            </p>
            <div className="mt-7">
              <CopyCommand command={INSTALL_COMMAND} />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
