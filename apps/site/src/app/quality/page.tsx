import { PageHeader } from '@/components/page-header';
import { RateCell } from '@/components/rate-cell';
import { BENCHMARKS, type Check, conditionBy } from '@/lib/benchmarks';
import { GITHUB_REPO_URL } from '@/lib/constants';
import { Badge, StateRule } from '@localize-infra/ui';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Quality',
  description:
    'Mechanical correctness is verified on every build against a corpus of 414 real strings. Two checks have nothing in the corpus to run against, and human preference has not been measured. We say both.',
  alternates: { canonical: '/quality' },
};

/**
 * Results come from the generated benchmark artifact, never from this file.
 *
 * The rows for ICU validity and plural categories previously read "Pass". The
 * corpus contains no ICU messages at all, so those checks had nothing to run
 * against and the word was meaningless — a vacuous pass on a page whose entire
 * argument is that it does not publish numbers it cannot source. They now
 * render "No data", which is what the artifact says.
 */
const B = conditionBy('B');

const MECHANICAL: Array<{ check: string; detail: string; result: Check }> = [
  {
    check: 'Placeholder integrity',
    detail:
      'Interpolations like {name}, {{count}} and %s survive translation unchanged',
    result: B.placeholderIntact,
  },
  {
    check: 'Length constraints',
    detail: 'Translations stay inside the space the original string was given',
    result: B.withinLengthBudget,
  },
  {
    check: 'Glossary consistency',
    detail: 'Terms with a required translation use it',
    result: B.glossaryRespected,
  },
  {
    check: 'ICU message validity',
    detail: 'Translated ICU plural and select blocks still parse',
    result: B.icuValid,
  },
  {
    check: 'Plural categories',
    detail:
      'Correct category set per language — Arabic has six, Japanese has one',
    result: B.pluralCategoriesCorrect,
  },
];

export default function QualityPage() {
  return (
    <>
      <PageHeader
        eyebrow="Measured, not asserted"
        title="Translation quality, with the gaps left in"
        lede="Every localization tool claims accuracy. Almost none publish a method or a number. Here is ours, including the part we have not measured yet."
      />

      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
        <section aria-labelledby="mechanical">
          <div className="flex flex-wrap items-center gap-3">
            <h2
              id="mechanical"
              className="text-[22px] font-semibold text-primary"
            >
              Mechanical correctness
            </h2>
            <Badge tone="confident">Verified every build</Badge>
          </div>
          <p className="mt-3 max-w-[64ch] text-[15px] leading-7 text-secondary">
            These are the failures that silently break a running app: a dropped{' '}
            <code className="font-mono text-[13px]">{'{count}'}</code>, an ICU
            block that no longer parses, a plural form that does not exist in
            the target language. They are checked deterministically against the
            corpus below, and the build fails if the rate drops under 99.5%.
          </p>
          <p className="mt-3 max-w-[64ch] text-[15px] leading-7 text-secondary">
            Results are for the context-rich condition — the one the CLI
            actually uses. The{' '}
            <Link
              href="/benchmarks"
              className="rounded-sm text-link underline underline-offset-2 hover:text-link-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              benchmarks page
            </Link>{' '}
            compares it against the same model with no context at all.
          </p>

          <div className="mt-8 overflow-x-auto">
            {/* Description folds into the first cell below `sm`, so the
                result column stays on screen. */}
            <table className="w-full min-w-[20rem] border-collapse sm:min-w-[34rem]">
              <caption className="sr-only">
                Mechanical correctness checks and their current results
              </caption>
              <thead>
                <tr className="border-b border-line">
                  <th
                    scope="col"
                    className="py-2.5 pe-4 text-start text-[12px] font-medium uppercase tracking-wide text-tertiary"
                  >
                    Check
                  </th>
                  <th
                    scope="col"
                    className="hidden py-2.5 pe-4 text-start text-[12px] font-medium uppercase tracking-wide text-tertiary sm:table-cell"
                  >
                    What it catches
                  </th>
                  <th
                    scope="col"
                    className="py-2.5 text-end text-[12px] font-medium uppercase tracking-wide text-tertiary"
                  >
                    Result
                  </th>
                </tr>
              </thead>
              <tbody>
                {MECHANICAL.map((row) => (
                  <tr key={row.check} className="border-b border-subtle">
                    <th
                      scope="row"
                      className="py-3 pe-4 text-start align-top text-[14px] font-medium text-primary"
                    >
                      {row.check}
                      <span className="mt-1 block text-[13px] font-normal leading-5 text-secondary sm:hidden">
                        {row.detail}
                      </span>
                    </th>
                    <td className="hidden py-3 pe-4 align-top text-[14px] leading-6 text-secondary sm:table-cell">
                      {row.detail}
                    </td>
                    <td className="py-3 text-end align-top" data-numeric>
                      <RateCell check={row.result} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-4 max-w-[64ch] text-[13px] leading-6 text-tertiary">
            Two rows read <strong className="text-secondary">No data</strong>{' '}
            rather than a percentage. The corpus contains no ICU plural or
            select messages, so those two checks had nothing to run against.
            Their implementations are unit-tested, which is not the same as
            evidence — and reporting them as a pass would be exactly the kind of
            unearned number this page exists to avoid. Extending the corpus to
            cover them is outstanding work.
          </p>
        </section>

        {/* The unmeasured half. Publishing "not yet measured" is more credible
            than a number we cannot source, and it pre-commits us publicly to
            publishing results that may be unflattering. */}
        <section aria-labelledby="human" className="mt-14">
          <StateRule tone="ambiguous" className="max-w-[70ch]">
            <div className="flex flex-wrap items-center gap-3">
              <h2 id="human" className="text-[22px] font-semibold text-primary">
                Human preference
              </h2>
              <Badge tone="ambiguous">Not yet measured</Badge>
            </div>
            <p className="mt-3 text-[15px] leading-7 text-secondary">
              Mechanical correctness says a translation is well-formed. It says
              nothing about whether it is <em>good</em>. Answering that requires
              native speakers comparing our output against human reference
              translations, blind, in a randomised order.
            </p>
            <p className="mt-3 text-[15px] leading-7 text-secondary">
              The evaluation harness is built and the corpus is prepared. The
              study has not run, so we have no preference data — and we would
              rather publish that sentence than a number we cannot stand behind.
            </p>
            <p className="mt-3 text-[15px] leading-7 text-secondary">
              When it does run, results go here per language,{' '}
              <strong className="font-medium text-primary">
                including the languages where we lose
              </strong>
              . That is the commitment; it is easy to make now and harder to
              keep later, which is exactly why it is written down in public.
            </p>
          </StateRule>
        </section>
      </div>

      <section
        aria-labelledby="method"
        className="border-t border-subtle bg-surface/40"
      >
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
          <h2 id="method" className="text-[22px] font-semibold text-primary">
            Method
          </h2>
          <div className="mt-6 grid gap-10 lg:grid-cols-2 lg:gap-16">
            <div>
              <h3 className="text-[15px] font-semibold text-primary">
                The corpus
              </h3>
              <p className="mt-2 text-[14px] leading-6 text-secondary">
                {BENCHMARKS.corpus.entries} real interface strings sampled from{' '}
                {BENCHMARKS.corpus.projects.length} open-source projects, each
                with community translations reviewed by native speakers.
                Sampling is stratified so every project and language pair is
                represented, and pinned to exact commits so the corpus is
                reproducible.
              </p>
              <ul className="mt-4 flex flex-wrap gap-2">
                {BENCHMARKS.corpus.projects.map((project) => (
                  <li
                    key={project.name}
                    className="rounded-sm border border-subtle bg-canvas px-2 py-1 text-[12px] text-secondary"
                  >
                    {project.name}{' '}
                    <span className="text-tertiary">({project.license})</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-primary">
                Languages under test
              </h3>
              <p className="mt-2 text-[14px] leading-6 text-secondary">
                German, Japanese, Spanish, Arabic and Brazilian Portuguese —
                chosen for spread across writing systems, text direction,
                expansion length and morphological complexity rather than for
                ease.
              </p>
              <p className="mt-4 text-[14px] leading-6 text-secondary">
                The harness, the corpus and the checks are in the{' '}
                <a
                  href={GITHUB_REPO_URL}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="rounded-sm text-link underline underline-offset-2 hover:text-link-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  open-source repository
                </a>
                . You can run them yourself.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
