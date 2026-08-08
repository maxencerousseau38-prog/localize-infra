import { Code, CodeBlock } from '@/components/docs/code-block';
import { DocsToc, type TocEntry } from '@/components/docs/toc';
import { PageHeader } from '@/components/page-header';
import { GITHUB_REPO_URL } from '@/lib/constants';
import { Badge, StateRule } from '@localize-infra/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import type * as React from 'react';

export const metadata: Metadata = {
  title: 'Documentation',
  description:
    'How to run the localize-infra CLI today: building from source, the init command and its flags, framework detection, merge behaviour, and the extraction limits we have not solved yet.',
  alternates: { canonical: '/docs' },
};

const TOC: TocEntry[] = [
  { id: 'status', label: 'Before you start' },
  { id: 'install', label: 'Running it today' },
  { id: 'pipeline', label: 'What init does' },
  { id: 'reference', label: 'Command reference' },
  { id: 'environment', label: 'Environment variables' },
  { id: 'frameworks', label: 'Framework detection' },
  { id: 'extraction', label: 'What gets extracted' },
  { id: 'merging', label: 'How files are merged' },
  { id: 'privacy', label: 'What leaves your machine' },
  { id: 'errors', label: 'When it refuses' },
];

function Section({
  id,
  title,
  children,
  badge,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="scroll-mt-24 pt-14 first:pt-0">
      <div className="flex flex-wrap items-center gap-3">
        <h2
          id={id}
          className="font-display text-headline font-semibold text-primary"
        >
          {title}
        </h2>
        {badge}
      </div>
      <div className="mt-3 max-w-[68ch] space-y-3 text-prose text-secondary">
        {children}
      </div>
    </section>
  );
}

const FLAGS: Array<{ flag: string; value?: string; detail: React.ReactNode }> =
  [
    {
      flag: 'directory',
      detail: (
        <>
          Positional. The project to scan. Defaults to the current working
          directory.
        </>
      ),
    },
    {
      flag: '--force',
      detail: (
        <>
          By default <Code>init</Code> refuses to rewrite{' '}
          <Code>locales/en.json</Code> if that would drop keys the current
          extraction no longer produces. <Code>--force</Code> proceeds and lets
          them be removed.
        </>
      ),
    },
    {
      flag: '--api-url',
      value: '<url>',
      detail: (
        <>
          Base URL of the API instance to translate against. Defaults to{' '}
          <Code>http://localhost:8787</Code>. There is no environment-variable
          equivalent today.
        </>
      ),
    },
    {
      flag: '--api-token',
      value: '<token>',
      detail: (
        <>
          Bearer token for the API. Prefer <Code>LOCALIZE_API_TOKEN</Code> — a
          token on the command line lands in your shell history and in{' '}
          <Code>ps</Code> output. If both are set, the flag wins.
        </>
      ),
    },
    {
      flag: '--locales',
      value: '<list>',
      detail: (
        <>
          Comma-separated target locales, e.g. <Code>de,ja,es</Code>. Defaults
          to <Code>de,ja,es,ar,pt-BR</Code>.
        </>
      ),
    },
    {
      flag: '--open-pr',
      detail: (
        <>
          Open a pull request with the updated locale files. Requires{' '}
          <Code>--owner</Code> and <Code>--repo</Code>, both validated before
          the translation step so a typo costs nothing.
        </>
      ),
    },
    {
      flag: '--owner',
      value: '<owner>',
      detail: <>GitHub user or organisation. Required with --open-pr.</>,
    },
    {
      flag: '--repo',
      value: '<repo>',
      detail: <>GitHub repository name. Required with --open-pr.</>,
    },
    {
      flag: '--base-branch',
      value: '<branch>',
      detail: (
        <>
          Base branch for the pull request. Defaults to <Code>main</Code>.
        </>
      ),
    },
  ];

const FRAMEWORKS = [
  {
    name: 'Next.js',
    signal: (
      <>
        a <Code>next</Code> dependency, or a <Code>next.config.js</Code>,{' '}
        <Code>.mjs</Code> or <Code>.ts</Code>
      </>
    ),
    globs: 'app/**, pages/**, components/**, src/** (.ts, .tsx)',
  },
  {
    name: 'Vite + React',
    signal: (
      <>
        a <Code>react</Code> dependency <em>and</em> either a <Code>vite</Code>{' '}
        dependency or a <Code>vite.config.*</Code>
      </>
    ),
    globs: 'src/** (.ts, .tsx)',
  },
  {
    name: 'React Native',
    signal: (
      <>
        a <Code>react-native</Code> dependency
      </>
    ),
    globs: 'App.tsx, App.ts, src/** (.ts, .tsx)',
  },
];

const REFUSALS = [
  {
    when: 'No framework detected',
    message:
      'No supported framework detected. Supported: Next.js, Vite + React, React Native.',
    fix: 'Run it against the directory holding the package.json, not the repository root of a monorepo.',
  },
  {
    when: 'Existing keys would be dropped',
    message:
      'Refusing to overwrite locales/en.json: N existing key(s) would be removed…',
    fix: 'Review the diff. If the removals are correct, re-run with --force.',
  },
  {
    when: 'No token configured',
    message:
      'No API token configured. Pass --api-token or set the LOCALIZE_API_TOKEN environment variable.',
    fix: 'Export LOCALIZE_API_TOKEN. This is checked before anything is written.',
  },
  {
    when: '--open-pr without a valid target',
    message: '--open-pr requires valid --owner and --repo values…',
    fix: 'Pass both. Checked before the translation step, so a typo does not cost a run.',
  },
];

export default function DocsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Documentation"
        title="Everything the CLI does, and everything it does not"
        lede="One command, eight flags, and a short list of limits we would rather you read here than discover in a pull request."
      />

      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_13rem] lg:gap-16">
          <div className="min-w-0">
            <Section
              id="status"
              title="Before you start"
              badge={<Badge tone="ambiguous">Pre-alpha</Badge>}
            >
              <StateRule tone="ambiguous">
                <p>
                  <strong className="font-medium text-primary">
                    The CLI is not published to npm yet.
                  </strong>{' '}
                  You cannot <Code>npx</Code> it. Until it is published, the
                  only way to run it is from a clone of the repository, which is
                  what the next section describes.
                </p>
                <p className="mt-3">
                  It also needs a running API instance to translate against.
                  There is no hosted one — you run it yourself, with your own
                  provider key. There are no accounts, no projects and no
                  dashboard behind any of this.
                </p>
              </StateRule>
              <p>
                What does work today, end to end, is the pipeline itself:
                detection, extraction, translation, merge, and a real pull
                request opened through a GitHub App.
              </p>
            </Section>

            <Section id="install" title="Running it today">
              <p>
                Clone the repository and install dependencies. The CLI resolves{' '}
                <Code>@localize-infra/core</Code> through its build output, so
                core has to be built first — skipping this is the single most
                common local failure.
              </p>
              <CodeBlock label="Clone and build">
                {`git clone ${GITHUB_REPO_URL}.git
cd localize-infra
npm install
npm run build -w @localize-infra/core`}
              </CodeBlock>
              <p>
                Start the API. It needs a bearer token of your choosing and a
                provider key; it refuses to boot without{' '}
                <Code>API_AUTH_TOKEN</Code>.
              </p>
              <CodeBlock label="Run the API">
                {`export API_AUTH_TOKEN="a-token-you-choose"
export ANTHROPIC_API_KEY="sk-ant-..."
npm run dev -w @localize-infra/api   # listens on :8787`}
              </CodeBlock>
              <p>Then run the CLI against your project.</p>
              <CodeBlock label="Run init">
                {`export LOCALIZE_API_TOKEN="a-token-you-choose"   # same value
npm exec -w @localize-infra/cli -- tsx src/index.ts init ../my-app`}
              </CodeBlock>
              <p>
                Extraction-only is not a supported mode: <Code>init</Code>{' '}
                always continues to the translation step, so a token is required
                even to write <Code>locales/en.json</Code>.
              </p>
            </Section>

            <Section id="pipeline" title="What init does">
              <ol className="space-y-2">
                {[
                  'Detects the framework from package.json and config files.',
                  'Extracts hardcoded UI strings from your source with an AST walk.',
                  'Writes locales/en.json — the source-of-truth catalog.',
                  'Translates each string into every target locale and writes locales/<locale>.json.',
                  'Optionally opens a pull request with the result.',
                ].map((step, index) => (
                  <li key={step} className="flex gap-3">
                    <span
                      aria-hidden="true"
                      className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-subtle font-mono text-micro text-tertiary"
                    >
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
              <p>
                Steps 4 and 5 go through the API. The CLI never calls an LLM or
                the GitHub API directly.
              </p>
              <p>
                A failure in one language does not abort the others. Each locale
                reports its own outcome, and a partial run still produces a pull
                request containing the languages that succeeded.
              </p>
            </Section>

            <Section id="reference" title="Command reference">
              <CodeBlock label="Usage">
                {`localize-infra init [directory] [--force] [--api-url <url>]
                   [--api-token <token>] [--locales <list>]
                   [--open-pr] [--owner <owner>] [--repo <repo>]
                   [--base-branch <branch>]`}
              </CodeBlock>
              <p>
                <Code>init</Code> is the only command. Anything else prints
                usage and exits non-zero.
              </p>
              <div className="mt-6 overflow-x-auto">
                <table className="w-full border-collapse">
                  <caption className="sr-only">
                    Flags accepted by the init command
                  </caption>
                  <thead>
                    <tr className="border-b border-line">
                      <th
                        scope="col"
                        className="py-2.5 pe-4 text-start text-caption font-medium uppercase tracking-wide text-tertiary"
                      >
                        Flag
                      </th>
                      <th
                        scope="col"
                        className="py-2.5 text-start text-caption font-medium uppercase tracking-wide text-tertiary"
                      >
                        Meaning
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {FLAGS.map((row) => (
                      <tr key={row.flag} className="border-b border-subtle">
                        <th
                          scope="row"
                          className="py-3 pe-4 text-start align-top font-mono text-small font-normal text-primary"
                        >
                          {row.flag}
                          {row.value ? (
                            <span className="text-tertiary"> {row.value}</span>
                          ) : null}
                        </th>
                        <td className="py-3 align-top text-body leading-6 text-secondary">
                          {row.detail}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section id="environment" title="Environment variables">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <caption className="sr-only">
                    Environment variables read by the CLI and the API
                  </caption>
                  <thead>
                    <tr className="border-b border-line">
                      <th
                        scope="col"
                        className="py-2.5 pe-4 text-start text-caption font-medium uppercase tracking-wide text-tertiary"
                      >
                        Variable
                      </th>
                      <th
                        scope="col"
                        className="py-2.5 pe-4 text-start text-caption font-medium uppercase tracking-wide text-tertiary"
                      >
                        Read by
                      </th>
                      <th
                        scope="col"
                        className="py-2.5 text-start text-caption font-medium uppercase tracking-wide text-tertiary"
                      >
                        Purpose
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      [
                        'LOCALIZE_API_TOKEN',
                        'CLI',
                        'Bearer token sent to the API. Preferred over --api-token.',
                      ],
                      [
                        'API_AUTH_TOKEN',
                        'API',
                        'The token the API accepts. Required — it refuses to start without one.',
                      ],
                      [
                        'ANTHROPIC_API_KEY',
                        'API',
                        'Provider key used for translation.',
                      ],
                      [
                        'PORT',
                        'API',
                        'Listen port. Defaults to 8787, which is what the CLI assumes.',
                      ],
                      [
                        'GITHUB_APP_ID',
                        'API',
                        'GitHub App identity, needed only for --open-pr.',
                      ],
                      [
                        'GITHUB_APP_INSTALLATION_ID',
                        'API',
                        'Installation the App acts through. --open-pr only.',
                      ],
                      [
                        'GITHUB_APP_PRIVATE_KEY_PATH',
                        'API',
                        'Path to the App private key. --open-pr only.',
                      ],
                    ].map(([name, readBy, purpose]) => (
                      <tr key={name} className="border-b border-subtle">
                        <th
                          scope="row"
                          className="py-3 pe-4 text-start align-top font-mono text-small font-normal text-primary"
                        >
                          {name}
                        </th>
                        <td className="py-3 pe-4 align-top text-small text-tertiary">
                          {readBy}
                        </td>
                        <td className="py-3 align-top text-body leading-6 text-secondary">
                          {purpose}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section id="frameworks" title="Framework detection">
              <p>
                Detection is by dependency and config file, in this order. The
                first match wins; no match is a refusal, not a guess.
              </p>
              <div className="mt-4 space-y-4">
                {FRAMEWORKS.map((framework) => (
                  <div
                    key={framework.name}
                    className="rounded-lg border border-line p-4"
                  >
                    <h3 className="text-subtitle font-semibold text-primary">
                      {framework.name}
                    </h3>
                    <p className="mt-1.5 text-body leading-6 text-secondary">
                      Detected by {framework.signal}.
                    </p>
                    <p className="mt-1.5 font-mono text-caption leading-5 text-tertiary">
                      Scans: {framework.globs}
                    </p>
                  </div>
                ))}
              </div>
              <p>
                Locale files are written to <Code>locales/</Code> in every case.
              </p>
            </Section>

            <Section id="extraction" title="What gets extracted">
              <p>
                JSX text content, plus four attributes: <Code>placeholder</Code>
                , <Code>alt</Code>, <Code>title</Code> and{' '}
                <Code>aria-label</Code>. Strings already inside a{' '}
                <Code>t()</Code>, <Code>translate()</Code> or{' '}
                <Code>i18n()</Code> call are left alone.
              </p>
              <p>Filtered out as noise, not text:</p>
              <ul className="space-y-1.5">
                {[
                  'Purely numeric, currency or punctuation strings — 42, $9.99, 12%.',
                  'Bare HTML entities such as &nbsp;.',
                  'Single kebab-case or snake_case tokens, which are class names rather than prose. "Dashboard" and "Cancel" are kept.',
                  'Test, spec and story files, so fixture text never reaches your catalog.',
                ].map((item) => (
                  <li
                    key={item}
                    className="before:me-2 before:text-tertiary before:content-['—']"
                  >
                    {item}
                  </li>
                ))}
              </ul>

              <StateRule tone="degraded" className="mt-6">
                <h3 className="text-subtitle font-semibold text-primary">
                  Known gap: elements containing expressions
                </h3>
                <p className="mt-2">
                  <Code>{'<p>You have {count} messages</p>'}</Code> is extracted
                  as two fragments around the expression, not as one
                  placeholder-aware string. Translated independently, those
                  fragments produce wrong word order in languages that reorder
                  the sentence.
                </p>
                <p className="mt-2">
                  Fixing it means grouping an element&rsquo;s children into a
                  single ICU-aware string, which is a redesign of the extraction
                  model rather than a patch. It is not done, and it is listed
                  here because you will hit it.
                </p>
              </StateRule>

              <p className="mt-6">
                Strings inside JSX expressions — ternaries, template literals,{' '}
                <Code>{'{someVar}'}</Code> — are not extracted at all.
              </p>
            </Section>

            <Section id="merging" title="How files are merged">
              <p>
                A translation you edited by hand is never overwritten by a
                machine translation. On re-run, an existing non-English value is
                kept; only missing keys are filled in. For <Code>en.json</Code>{' '}
                the freshly extracted text always wins, because the source text
                is the source of truth.
              </p>
              <p>
                Keys are derived from the string and de-duplicated, so two
                identical strings in different files collapse into one entry.
                Output is written with sorted keys, which keeps diffs readable
                and review meaningful.
              </p>
            </Section>

            <Section
              id="privacy"
              title="What leaves your machine"
              badge={<Badge tone="degraded">Known gap</Badge>}
            >
              <StateRule tone="degraded">
                <p>
                  For every extracted string, the CLI sends its text,{' '}
                  <strong className="font-medium text-primary">
                    its file path, its component name and a snippet of the
                    surrounding source code
                  </strong>{' '}
                  to the API, which forwards them to a third-party model
                  provider.
                </p>
                <p className="mt-3">
                  That context is why translations are better — it is what
                  distinguishes &ldquo;Close&rdquo; the button from
                  &ldquo;Close&rdquo; the adjective — and it is also source code
                  leaving your machine to a provider that is not EU-hosted. EU
                  data residency is a stated goal of this project and is{' '}
                  <strong className="font-medium text-primary">
                    not implemented
                  </strong>
                  .
                </p>
                <p className="mt-3">
                  Do not run <Code>init</Code> over a tree containing code you
                  cannot send to a third party. See the{' '}
                  <Link
                    href="/security"
                    className="rounded-sm text-link underline underline-offset-2 hover:text-link-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                  >
                    security page
                  </Link>{' '}
                  for the full disclosure.
                </p>
              </StateRule>
            </Section>

            <Section id="errors" title="When it refuses">
              <p>
                <Code>init</Code> stops rather than guessing. Each refusal is
                checked before anything is written or billed.
              </p>
              <div className="mt-4 space-y-4">
                {REFUSALS.map((refusal) => (
                  <div
                    key={refusal.when}
                    className="rounded-lg border border-line p-4"
                  >
                    <h3 className="text-body font-semibold text-primary">
                      {refusal.when}
                    </h3>
                    <p className="mt-2 overflow-x-auto font-mono text-caption leading-5 text-failed-text">
                      {refusal.message}
                    </p>
                    <p className="mt-2 text-body leading-6 text-secondary">
                      {refusal.fix}
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-6">
                Full source for every behaviour on this page is in the{' '}
                <a
                  href={GITHUB_REPO_URL}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="rounded-sm text-link underline underline-offset-2 hover:text-link-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  repository
                </a>
                . If this page and the code disagree, the code is right and this
                page is a bug.
              </p>
            </Section>
          </div>

          <DocsToc entries={TOC} />
        </div>
      </div>
    </>
  );
}
