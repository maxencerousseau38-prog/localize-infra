import { PageHeader } from '@/components/page-header';
import { GITHUB_REPO_URL } from '@/lib/constants';
import { Badge, StateRule } from '@localize-infra/ui';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Quality',
  description:
    'Mechanical correctness is verified on every build against a corpus of 414 real strings. Human preference has not been measured yet, and we say so.',
};

const MECHANICAL = [
  {
    check: 'Placeholder integrity',
    detail:
      'Interpolations like {name}, {{count}} and %s survive translation unchanged',
    result: '413 / 413',
  },
  {
    check: 'ICU message validity',
    detail: 'Translated ICU plural and select blocks still parse',
    result: 'Pass',
  },
  {
    check: 'Plural categories',
    detail:
      'Correct category set per language — Arabic has six, Japanese has one',
    result: 'Pass',
  },
  {
    check: 'Length constraints',
    detail: 'Translations flagged when they overflow their container budget',
    result: 'Pass',
  },
];

const CORPUS = [
  ['Excalidraw', 'MIT'],
  ['Gitea', 'MIT'],
  ['Zulip', 'Apache-2.0'],
  ['Syncthing', 'MPL-2.0'],
  ['Wekan', 'MIT'],
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

          <div className="mt-8 overflow-x-auto">
            <table className="w-full min-w-[34rem] border-collapse">
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
                    className="py-2.5 pe-4 text-start text-[12px] font-medium uppercase tracking-wide text-tertiary"
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
                    <td className="py-3 pe-4 align-top text-[14px] font-medium text-primary">
                      {row.check}
                    </td>
                    <td className="py-3 pe-4 align-top text-[14px] leading-6 text-secondary">
                      {row.detail}
                    </td>
                    <td
                      className="py-3 text-end align-top font-mono text-[13px] text-confident-text"
                      data-numeric
                    >
                      {row.result}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
                414 real interface strings sampled from five open-source
                projects, each with community translations reviewed by native
                speakers. Sampling is stratified so every project and language
                pair is represented, and pinned to exact commits so the corpus
                is reproducible.
              </p>
              <ul className="mt-4 flex flex-wrap gap-2">
                {CORPUS.map(([name, licence]) => (
                  <li
                    key={name}
                    className="rounded-sm border border-subtle bg-canvas px-2 py-1 text-[12px] text-secondary"
                  >
                    {name} <span className="text-tertiary">({licence})</span>
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
