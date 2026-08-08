import { PageHeader } from '@/components/page-header';
import { RateCell } from '@/components/rate-cell';
import {
  BENCHMARKS,
  type Check,
  conditionBy,
  formatPercent,
  localeName,
  rate,
} from '@/lib/benchmarks';
import { EVAL_PACKAGE_URL } from '@/lib/constants';
import { Badge, StateRule } from '@localize-infra/ui';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Benchmarks',
  description:
    'Deterministic results from 828 translations of a 414-string corpus, measuring whether source-code context improves machine translation. Reproducible from this repository. Human preference is not measured.',
  alternates: { canonical: '/benchmarks' },
};

const A = conditionBy('A');
const B = conditionBy('B');

const CHECKS: Array<{
  name: string;
  catches: string;
  a: Check;
  b: Check;
}> = [
  {
    name: 'Placeholder integrity',
    catches:
      'Interpolations such as {name}, {{count}} or %s survive translation unchanged',
    a: A.placeholderIntact,
    b: B.placeholderIntact,
  },
  {
    name: 'Within length budget',
    catches:
      'The translation still fits the space the original string was allotted',
    a: A.withinLengthBudget,
    b: B.withinLengthBudget,
  },
  {
    name: 'Glossary respected',
    catches:
      'Terms with a required translation use it — product names left untranslated, for instance',
    a: A.glossaryRespected,
    b: B.glossaryRespected,
  },
  {
    name: 'ICU message validity',
    catches: 'Translated ICU plural and select blocks still parse',
    a: A.icuValid,
    b: B.icuValid,
  },
  {
    name: 'Plural categories',
    catches:
      'The right category set for the language — Arabic has six, Japanese has one',
    a: A.pluralCategoriesCorrect,
    b: B.pluralCategoriesCorrect,
  },
];

/** The headline finding, computed rather than asserted. */
const lengthA = rate(A.withinLengthBudget);
const lengthB = rate(B.withinLengthBudget);
const lengthDelta =
  lengthA.kind === 'measured' && lengthB.kind === 'measured'
    ? lengthB.percent - lengthA.percent
    : null;

export default function BenchmarksPage() {
  return (
    <>
      <PageHeader
        eyebrow="Reproducible from this repository"
        title="Does context actually improve machine translation?"
        lede={`We ran ${BENCHMARKS.corpus.entries} real interface strings through the same model twice — once with nothing but the string, once with the source file, surrounding code, glossary and length budget around it — and checked both mechanically. Here is what separated them, and what these numbers cannot tell you.`}
      />

      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
        <section aria-labelledby="conditions">
          <h2
            id="conditions"
            className="text-[22px] font-semibold text-primary"
          >
            The two conditions
          </h2>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="rounded-lg border border-line p-5">
              <div className="flex items-center gap-2.5">
                <span className="rounded-sm border border-subtle bg-surface px-1.5 py-0.5 font-mono text-[12px] text-secondary">
                  A
                </span>
                <h3 className="text-[15px] font-semibold text-primary">
                  String only
                </h3>
              </div>
              <p className="mt-3 text-[14px] leading-6 text-secondary">
                The model receives the string and the target language. Nothing
                else. This is roughly what a translation API call looks like
                without a build step around it.
              </p>
            </div>
            <div className="rounded-lg border border-line p-5">
              <div className="flex items-center gap-2.5">
                <span className="rounded-sm border border-subtle bg-surface px-1.5 py-0.5 font-mono text-[12px] text-secondary">
                  B
                </span>
                <h3 className="text-[15px] font-semibold text-primary">
                  String with context
                </h3>
              </div>
              <p className="mt-3 text-[14px] leading-6 text-secondary">
                The same string, plus the file path, the component name, the
                surrounding source lines, the matching glossary terms and the
                length budget. This is what the CLI sends.
              </p>
            </div>
          </div>
        </section>

        <section aria-labelledby="results" className="mt-14">
          <div className="flex flex-wrap items-center gap-3">
            <h2 id="results" className="text-[22px] font-semibold text-primary">
              Results
            </h2>
            <Badge tone="confident">Deterministic</Badge>
          </div>
          <p className="mt-3 max-w-[64ch] text-[15px] leading-7 text-secondary">
            Every check below is a program, not a judgement. Each runs over the
            same {BENCHMARKS.corpus.entries} strings in both conditions.
            Denominators differ per check because a check only counts entries it
            applies to — and where nothing applies, the result is{' '}
            <em>no data</em>, not a pass.
          </p>

          <div className="mt-8 overflow-x-auto">
            {/* The description column collapses into the first cell below
                `sm`. Keeping five columns at phone width pushed the results —
                the only reason this table exists — off-screen behind a
                horizontal scroll, leaving a reader looking at labels. */}
            <table className="w-full min-w-[22rem] border-collapse sm:min-w-[40rem]">
              <caption className="sr-only">
                Deterministic check results for condition A (string only) and
                condition B (string with context)
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
                    className="py-2.5 pe-4 text-end text-[12px] font-medium uppercase tracking-wide text-tertiary"
                  >
                    A — string only
                  </th>
                  <th
                    scope="col"
                    className="py-2.5 text-end text-[12px] font-medium uppercase tracking-wide text-tertiary"
                  >
                    B — with context
                  </th>
                </tr>
              </thead>
              <tbody>
                {CHECKS.map((row) => (
                  <tr key={row.name} className="border-b border-subtle">
                    <th
                      scope="row"
                      className="py-3 pe-4 text-start align-top text-[14px] font-medium text-primary"
                    >
                      {row.name}
                      <span className="mt-1 block text-[13px] font-normal leading-5 text-secondary sm:hidden">
                        {row.catches}
                      </span>
                    </th>
                    <td className="hidden py-3 pe-4 align-top text-[14px] leading-6 text-secondary sm:table-cell">
                      {row.catches}
                    </td>
                    <td className="py-3 pe-4 text-end align-top" data-numeric>
                      <RateCell check={row.a} />
                    </td>
                    <td className="py-3 text-end align-top" data-numeric>
                      <RateCell check={row.b} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-[13px] leading-6 text-tertiary">
            {A.errors + B.errors} of {BENCHMARKS.run.translations} provider
            calls returned no text and are excluded from the denominators above
            rather than counted as failures — an outage is not a translation
            defect. They are not excluded silently: that is what this sentence
            is for.
          </p>
        </section>

        {/* The one finding worth stating as a finding. Computed from the
            artifact, so it cannot drift from the table above it. */}
        {lengthDelta !== null &&
        lengthA.kind === 'measured' &&
        lengthB.kind === 'measured' ? (
          <section aria-labelledby="finding" className="mt-14">
            <StateRule tone="confident" className="max-w-[70ch]">
              <h2
                id="finding"
                className="text-[22px] font-semibold text-primary"
              >
                What the data actually shows
              </h2>
              <p className="mt-3 text-[15px] leading-7 text-secondary">
                Context made one clear difference:{' '}
                <strong className="font-medium text-primary">
                  staying inside the length budget rose from{' '}
                  {formatPercent(lengthA.percent)} to{' '}
                  {formatPercent(lengthB.percent)}
                </strong>{' '}
                — {formatPercent(lengthDelta)} in absolute terms,{' '}
                {lengthA.applicable - lengthA.passed} overflowing strings down
                to {lengthB.applicable - lengthB.passed}. That is the difference
                between copy that fits your buttons and copy that does not.
              </p>
              <p className="mt-3 text-[15px] leading-7 text-secondary">
                Placeholder integrity was already perfect without context, so
                context could not improve it. We are not going to present an
                unchanged number as a win.
              </p>
              <p className="mt-3 text-[15px] leading-7 text-secondary">
                The glossary sample is small — {B.glossaryRespected.applicable}{' '}
                strings contained a glossary term at all. Treat it as a
                direction, not a result.
              </p>
            </StateRule>
          </section>
        ) : null}

        <section aria-labelledby="per-locale" className="mt-14">
          <h2
            id="per-locale"
            className="text-[22px] font-semibold text-primary"
          >
            Placeholder integrity per language
          </h2>
          <p className="mt-3 max-w-[64ch] text-[15px] leading-7 text-secondary">
            Broken out because an average hides the language that fails. Here it
            hides nothing — but the breakdown is published either way, so that
            when a language does fail there is no decision to make about
            publishing it.
          </p>

          <div className="mt-8 overflow-x-auto">
            <table className="w-full min-w-[34rem] border-collapse">
              <caption className="sr-only">
                Placeholder integrity by target language, both conditions
              </caption>
              <thead>
                <tr className="border-b border-line">
                  <th
                    scope="col"
                    className="py-2.5 pe-4 text-start text-[12px] font-medium uppercase tracking-wide text-tertiary"
                  >
                    Language
                  </th>
                  <th
                    scope="col"
                    className="py-2.5 pe-4 text-end text-[12px] font-medium uppercase tracking-wide text-tertiary"
                  >
                    A — string only
                  </th>
                  <th
                    scope="col"
                    className="py-2.5 text-end text-[12px] font-medium uppercase tracking-wide text-tertiary"
                  >
                    B — with context
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* Sorted by the name shown, not the locale code the artifact
                    is keyed by — a list reading Arabic, German, Spanish,
                    Japanese looks unsorted to anyone who cannot see the codes. */}
                {[...B.byLocale]
                  .sort((x, y) =>
                    localeName(x.locale).localeCompare(localeName(y.locale)),
                  )
                  .map((row) => {
                    const inA = A.byLocale.find((l) => l.locale === row.locale);
                    return (
                      <tr key={row.locale} className="border-b border-subtle">
                        <td className="py-3 pe-4 text-[14px] text-primary">
                          {localeName(row.locale)}{' '}
                          <span className="font-mono text-[12px] text-tertiary">
                            {row.locale}
                          </span>
                        </td>
                        <td className="py-3 pe-4 text-end" data-numeric>
                          {inA ? (
                            <RateCell check={inA.placeholderIntact} />
                          ) : (
                            <span className="font-mono text-[13px] text-tertiary">
                              No data
                            </span>
                          )}
                        </td>
                        <td className="py-3 text-end" data-numeric>
                          <RateCell check={row.placeholderIntact} />
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Placed before the method, not after it: a reader who stops halfway
            down must still have seen the limits. */}
        <section aria-labelledby="not-measured" className="mt-14">
          <StateRule tone="ambiguous" className="max-w-[70ch]">
            <div className="flex flex-wrap items-center gap-3">
              <h2
                id="not-measured"
                className="text-[22px] font-semibold text-primary"
              >
                What these numbers do not tell you
              </h2>
              <Badge tone="ambiguous">Not measured</Badge>
            </div>
            <ul className="mt-4 space-y-3">
              {BENCHMARKS.notMeasured.map((item) => (
                <li
                  key={item}
                  className="text-[15px] leading-7 text-secondary before:me-2 before:text-tertiary before:content-['—']"
                >
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[15px] leading-7 text-secondary">
              The corpus also contains no ICU plural or select messages, so the
              two checks that validate them had nothing to run against. Their
              implementations are unit-tested; that is not the same as evidence,
              and the table above says <em>no data</em> rather than{' '}
              <em>pass</em>.
            </p>
            <p className="mt-4 text-[15px] leading-7 text-secondary">
              Preference results, when the study runs, go on the{' '}
              <Link
                href="/quality"
                className="rounded-sm text-link underline underline-offset-2 hover:text-link-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                quality page
              </Link>{' '}
              — including the languages where we lose.
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
            Method and provenance
          </h2>

          <div className="mt-6 grid gap-10 lg:grid-cols-2 lg:gap-16">
            <div>
              <h3 className="text-[15px] font-semibold text-primary">
                The corpus
              </h3>
              <p className="mt-2 text-[14px] leading-6 text-secondary">
                {BENCHMARKS.corpus.entries} interface strings sampled from five
                open-source projects, each pinned to an exact commit, each with
                a community translation reviewed by native speakers. Sampling is
                stratified across project and language so no pair dominates.
              </p>
              <ul className="mt-4 space-y-2">
                {BENCHMARKS.corpus.projects.map((project) => (
                  <li key={project.name} className="text-[13px] leading-6">
                    <a
                      href={`${project.repoUrl}/tree/${project.commit}`}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="rounded-sm font-medium text-link underline underline-offset-2 hover:text-link-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                    >
                      {project.name}
                    </a>{' '}
                    <span className="text-tertiary">
                      ({project.license}) · {project.entries} strings ·{' '}
                      <code className="font-mono text-[12px]">
                        {project.commit.slice(0, 7)}
                      </code>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-[15px] font-semibold text-primary">
                The run
              </h3>
              <dl className="mt-2 space-y-2 text-[14px] leading-6">
                <div className="flex gap-2">
                  <dt className="text-tertiary">Model</dt>
                  <dd className="font-mono text-[13px] text-secondary">
                    {BENCHMARKS.run.models.join(', ')}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-tertiary">Provider</dt>
                  <dd className="font-mono text-[13px] text-secondary">
                    {BENCHMARKS.run.providers.join(', ')}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-tertiary">Translations</dt>
                  <dd className="font-mono text-[13px] text-secondary">
                    {BENCHMARKS.run.translations}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-tertiary">Languages</dt>
                  <dd className="text-secondary">
                    {BENCHMARKS.corpus.locales
                      .map((l) => localeName(l.locale))
                      .join(', ')}
                  </dd>
                </div>
              </dl>
              <p className="mt-4 text-[14px] leading-6 text-secondary">
                One model, one provider. Comparing models is a different
                experiment and we have not run it.
              </p>
              <p className="mt-4 text-[14px] leading-6 text-secondary">
                The corpus, the translations, the checks and the script that
                produces the numbers on this page are all in the{' '}
                <a
                  href={EVAL_PACKAGE_URL}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="rounded-sm text-link underline underline-offset-2 hover:text-link-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  MIT-licensed evaluation package
                </a>
                . Run{' '}
                <code className="rounded-sm bg-raised px-1.5 py-0.5 font-mono text-[12px] text-secondary">
                  npm run benchmarks:build -w @localize-infra/eval
                </code>{' '}
                and you will get this page&rsquo;s numbers back, or the build
                fails.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
