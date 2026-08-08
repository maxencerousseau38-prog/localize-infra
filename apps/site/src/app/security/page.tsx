import { PageHeader } from '@/components/page-header';
import { Badge, StateRule } from '@localize-infra/ui';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  alternates: { canonical: '/security' },
  title: 'Security & data',
  description:
    'Exactly what leaves your machine, which sub-processors receive it, GitHub App permissions, and where our data residency commitment currently falls short.',
};

const SENT = [
  ['The string itself', 'e.g. “Complete your order”'],
  ['Its file path', 'src/components/Checkout.tsx'],
  ['Its component name', 'Checkout'],
  ['A short snippet of surrounding code', 'a few lines around the string'],
  ['The target language', 'de, ja, ar…'],
];

const NOT_SENT = [
  'The rest of your repository',
  'Your git history, branches, or commit messages',
  'Environment variables, secrets, or .env files',
  'Dependencies, lockfiles, or build output',
  'Anything from a file that contains no extractable UI strings',
];

const SUBPROCESSORS = [
  {
    name: 'Anthropic',
    purpose: 'Translation model',
    data: 'String, file path, component name, code snippet',
    region: 'United States',
  },
  {
    name: 'OpenAI',
    purpose: 'Translation model (alternative route)',
    data: 'String, file path, component name, code snippet',
    region: 'United States',
  },
  {
    name: 'GitHub',
    purpose: 'Branch, commit and pull request creation',
    data: 'Locale files only',
    region: 'United States',
  },
];

export default function SecurityPage() {
  return (
    <>
      <PageHeader
        eyebrow="Trust"
        title="What leaves your machine, and where it goes"
        lede="A localization tool reads your source code. You should be able to answer “what does this send, and to whom?” without booking a call, so the whole answer is on this page."
      />

      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <section aria-labelledby="sent">
            <h2 id="sent" className="text-title font-semibold text-primary">
              What is sent
            </h2>
            <p className="mt-3 text-body leading-6 text-secondary">
              Context is what separates a good translation from a plausible
              wrong one — “Close” on a button is a different word in German than
              “close” in a sentence. That context is also code, so here it is,
              itemised.
            </p>
            <dl className="mt-6 space-y-3">
              {SENT.map(([term, detail]) => (
                <div key={term} className="border-b border-subtle pb-3">
                  <dt className="text-body font-medium text-primary">{term}</dt>
                  <dd className="mt-0.5 font-mono text-small text-tertiary">
                    {detail}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section aria-labelledby="not-sent">
            <h2 id="not-sent" className="text-title font-semibold text-primary">
              What is not
            </h2>
            <p className="mt-3 text-body leading-6 text-secondary">
              Extraction is AST-based and targeted. Files without extractable UI
              strings are never read for content.
            </p>
            <ul className="mt-6 space-y-2.5">
              {NOT_SENT.map((item) => (
                <li
                  key={item}
                  className="text-body leading-6 text-secondary before:me-2 before:text-confident before:content-['—']"
                >
                  {item}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <section
        id="subprocessors"
        aria-labelledby="subprocessors-heading"
        className="border-t border-subtle bg-surface/40"
      >
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
          <h2
            id="subprocessors-heading"
            className="font-display text-headline font-semibold text-primary"
          >
            Sub-processors
          </h2>
          <p className="mt-3 max-w-[62ch] text-body leading-6 text-secondary">
            Every third party that receives any part of your data, what they
            get, and where they process it.
          </p>

          <div className="mt-8 overflow-x-auto">
            <table className="w-full min-w-[38rem] border-collapse text-start">
              <caption className="sr-only">
                Sub-processors, their purpose, the data they receive, and their
                processing region
              </caption>
              <thead>
                <tr className="border-b border-line">
                  {['Processor', 'Purpose', 'Receives', 'Region'].map((h) => (
                    <th
                      key={h}
                      scope="col"
                      className="py-2.5 pe-4 text-start text-caption font-medium uppercase tracking-wide text-tertiary"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SUBPROCESSORS.map((p) => (
                  <tr key={p.name} className="border-b border-subtle">
                    <td className="py-3 pe-4 text-body font-medium text-primary">
                      {p.name}
                    </td>
                    <td className="py-3 pe-4 text-body text-secondary">
                      {p.purpose}
                    </td>
                    <td className="py-3 pe-4 text-body text-secondary">
                      {p.data}
                    </td>
                    <td className="py-3 pe-4 text-body text-secondary">
                      {p.region}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
        {/* The residency gap is stated plainly rather than omitted. A buyer
            discovers this in a security review anyway; finding it disclosed is
            a far better outcome than finding it hidden. */}
        <StateRule tone="degraded" className="max-w-[70ch]">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-title font-semibold text-primary">
              Data residency: an honest gap
            </h2>
            <Badge tone="degraded">Not yet resolved</Badge>
          </div>
          <p className="mt-3 text-body leading-6 text-secondary">
            We intend to process data in the EU. Today we do not: translation
            runs through US-hosted model providers, as listed above. That is a
            real gap between our stated commitment and current behaviour, and it
            is tracked as a blocker for European enterprise use rather than
            quietly deferred.
          </p>
          <p className="mt-3 text-body leading-6 text-secondary">
            Planned resolution is EU-region model endpoints plus
            bring-your-own-key, so inference can run against your own provider
            account and never touch ours. Until that ships, this page will keep
            saying so.
          </p>
        </StateRule>

        <div className="mt-12 grid gap-10 lg:grid-cols-2 lg:gap-16">
          <section aria-labelledby="github-perms">
            <h2
              id="github-perms"
              className="text-title font-semibold text-primary"
            >
              GitHub App permissions
            </h2>
            <p className="mt-3 text-body leading-6 text-secondary">
              The App requests the minimum needed to open a pull request, and
              nothing else.
            </p>
            <ul className="mt-5 space-y-2.5 text-body leading-6 text-secondary">
              <li className="before:me-2 before:text-confident before:content-['—']">
                <code className="font-mono text-small">contents: write</code> —
                create a branch and commit locale files
              </li>
              <li className="before:me-2 before:text-confident before:content-['—']">
                <code className="font-mono text-small">
                  pull_requests: write
                </code>{' '}
                — open the pull request
              </li>
            </ul>
            <p className="mt-4 text-body leading-6 text-secondary">
              Writes are additionally constrained server-side: a pull request
              may only touch <code className="font-mono text-small">.json</code>{' '}
              files under your locales directory. A request naming any other
              path is rejected before it reaches GitHub.
            </p>
          </section>

          <section aria-labelledby="retention">
            <h2
              id="retention"
              className="text-title font-semibold text-primary"
            >
              Storage and retention
            </h2>
            <p className="mt-3 text-body leading-6 text-secondary">
              Your translations are committed to your repository. They are the
              record — there is no second copy that constitutes the real one.
            </p>
            <p className="mt-3 text-body leading-6 text-secondary">
              We do not currently operate a hosted database at all; the product
              runs as a CLI against your own repositories. When hosted accounts
              ship, the database will hold projects, members and settings —
              never your translations, so that deleting your account cannot take
              your copy with it.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
