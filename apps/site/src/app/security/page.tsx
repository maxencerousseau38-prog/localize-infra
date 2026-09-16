import { PageHeader } from '@/components/page-header';
import { Badge, StateRule } from '@localize-infra/ui';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  alternates: { canonical: '/security' },
  title: 'Security & data',
  description:
    'Exactly what the model receives, what the hosted app reads and stores, which sub-processors are involved, the GitHub App permissions as they are, and where our data residency commitment falls short.',
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

/**
 * What the hosted app copies, from `apps/web/src/lib/github/materialise.ts`.
 *
 * This page used to describe the CLI only, and said the product "runs as a CLI
 * against your own repositories". The hosted app does something the CLI never
 * does — it brings a copy of the repository to our server — and a security page
 * that omits the path with the wider reach is the one a reviewer cannot trust.
 */
const HOSTED_COPY = [
  'Files ending in .ts, .tsx, .js, .jsx, .json, .mjs or .cjs',
  'Up to 512 KB each',
  'Not node_modules, .git, .next, dist, build, coverage or .turbo',
];

/**
 * Every third party that receives data, including the two the hosted app
 * added and this table left out: the database and the host.
 *
 * OpenAI stays, with the condition that makes it true. The API calls OpenAI
 * only when it holds an OpenAI key; that is a property of the code, and it is
 * the one this table can state without reading anyone's configuration.
 */
const SUBPROCESSORS = [
  {
    name: 'Anthropic',
    purpose: 'Translation model',
    data: 'String, file path, component name, code snippet',
    region: 'United States',
  },
  {
    name: 'OpenAI',
    purpose:
      'Translation model, only when the API instance is configured with an OpenAI key',
    data: 'String, file path, component name, code snippet',
    region: 'United States',
  },
  {
    name: 'GitHub',
    purpose:
      'Branch, commit and pull request creation; the hosted app also reads the repository through it',
    data: 'Locale files',
    region: 'United States',
  },
  {
    name: 'Supabase',
    purpose: 'Hosted app database and sign-in',
    data: 'Account email, workspaces, projects, run records, extracted strings and proposed translations',
    region: 'EU (Paris)',
  },
  {
    name: 'Vercel',
    purpose: 'Hosting for this site, the hosted app and the API',
    data: 'Requests; during a hosted run, the temporary repository copy',
    region:
      'Functions in the EU (Paris); static pages served from a global network',
  },
];

/**
 * The App's permissions as GitHub reports them for the installation, not as
 * they were intended.
 *
 * This listed two — contents and pull requests — "and nothing else". GitHub
 * reports five. `metadata: read` is granted to every App. The last two are
 * used by no code in this product; they should not be there, and until they
 * are removed from the App's settings this list says they are.
 */
const PERMISSIONS: Array<{ scope: string; use: string }> = [
  {
    scope: 'contents: write',
    use: 'read the files a hosted run extracts from, create a branch, commit locale files',
  },
  { scope: 'pull_requests: write', use: 'open the pull request' },
  {
    scope: 'metadata: read',
    use: 'granted to every GitHub App; lists the repositories an installation reaches',
  },
  {
    scope: 'artifact_metadata: write',
    use: 'not used by any code in this product — to be removed',
  },
  {
    scope: 'codespaces_metadata: read',
    use: 'not used by any code in this product — to be removed',
  },
];

export default function SecurityPage() {
  return (
    <>
      <PageHeader
        eyebrow="Trust"
        title="What we read, what we keep, and where it goes"
        lede="A localization tool reads your source code. You should be able to answer “what does this send, and to whom?” without booking a call, so the whole answer is on this page — for the CLI and for the hosted app."
      />

      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <section aria-labelledby="sent">
            <h2 id="sent" className="text-title font-semibold text-primary">
              What the model receives
            </h2>
            <p className="mt-3 text-body leading-6 text-secondary">
              Context is what separates a good translation from a plausible
              wrong one — “Close” on a button is a different word in German than
              “close” in a sentence. That context is also code, so here it is,
              itemised. It is the same whether the run starts from the CLI or
              from the hosted app.
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
              What the model never receives
            </h2>
            {/* "Files without extractable UI strings are never read for
                content" was false: the extractor parses every file in its globs
                to find out whether it has any. What holds is that they are
                never sent. */}
            <p className="mt-3 text-body leading-6 text-secondary">
              Extraction is AST-based and targeted. Files are parsed to find UI
              strings; a file without any contributes nothing to what is sent.
            </p>
            <ul className="mt-6 space-y-2.5">
              {NOT_SENT.map((item) => (
                <li
                  key={item}
                  className="text-body leading-6 text-secondary before:me-2 before:text-tertiary before:content-['—']"
                >
                  {item}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <section aria-labelledby="hosted-copy" className="border-t border-subtle">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
            <div>
              <h2
                id="hosted-copy"
                className="text-title font-semibold text-primary"
              >
                What the hosted app reads
              </h2>
              <p className="mt-3 text-body leading-6 text-secondary">
                The CLI reads your working tree on your machine. The hosted app
                cannot, so for each run it copies source files from your
                repository, through the GitHub App, into a temporary directory
                on its server, extracts from that copy, and deletes it when the
                run ends — whether the run succeeds or fails.
              </p>
              <p className="mt-3 text-body leading-6 text-secondary">
                That copy can include files the model never sees, such as a
                lockfile under the size limit. They stay in the temporary copy
                until it is deleted; they are not sent on and not stored.
              </p>
            </div>
            <div>
              <h3 className="text-body font-medium text-primary">
                What is copied
              </h3>
              <ul className="mt-4 space-y-2.5">
                {HOSTED_COPY.map((item) => (
                  <li
                    key={item}
                    className="text-body leading-6 text-secondary before:me-2 before:text-tertiary before:content-['—']"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

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
            We intend to process data in the EU. Today we only partly do. The
            hosted app’s database and functions run in Paris, but translation
            runs through US-hosted model providers, as listed above — so
            source-derived context leaves the EU on every run. That is a real
            gap between our stated commitment and current behaviour, and it is
            tracked as a blocker for European enterprise use rather than quietly
            deferred.
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
              As GitHub reports them for the installation today. Two of them are
              more than the product needs.
            </p>
            <ul className="mt-5 space-y-2.5 text-body leading-6 text-secondary">
              {PERMISSIONS.map(({ scope, use }) => (
                <li
                  key={scope}
                  className="before:me-2 before:text-tertiary before:content-['—']"
                >
                  <code className="font-mono text-small">{scope}</code> — {use}
                </li>
              ))}
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
            {/* This said "We do not currently operate a hosted database at
                all" and promised the future one would hold "never your
                translations". The database exists, and run_translations holds
                every string a hosted run extracted and every translation it
                proposed — that is how an approved run commits what was reviewed
                rather than a fresh sample. */}
            <p className="mt-3 text-body leading-6 text-secondary">
              The CLI stores nothing with us. The hosted app keeps a database in
              Paris holding accounts, workspaces, projects, the GitHub
              installation each workspace connected, and a record of every run —
              including the strings it extracted and the translations it
              proposed, so that a run held for review opens exactly the pull
              request that was reviewed.
            </p>
            <p className="mt-3 text-body leading-6 text-secondary">
              Those rows are proposals, not the record: what ships is the pull
              request. Deleting a project deletes its runs and their proposals
              with it.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
