import { EXAMPLE_PR_URL, INSTALL_COMMAND } from '@/lib/constants';
import { Button, CopyCommand, StateRule } from '@localize-infra/ui';
import { ArrowRight, GitPullRequest } from 'lucide-react';
import Link from 'next/link';

/**
 * The hero.
 *
 * Recomposed from a 7/5 split — argument left, artifact in a narrow card on the
 * right — into a headline band over a full-width product panel.
 *
 * The split was the problem. This product's whole claim is a transformation you
 * can see, and putting that transformation in five columns beside a 68px
 * headline made the claim compete with its own evidence and lose: the artifact
 * read as an illustration next to the copy rather than as the thing being sold.
 * Every serious developer tool resolves this the same way, by letting the
 * product occupy the full measure and putting the words above it.
 *
 * So the panel is now the widest element on the page and shows the whole run in
 * one frame — the file it found the string in, the string, the five files it
 * wrote, and the pull request it opened. A visitor who reads nothing still sees
 * what the product does.
 *
 * The `npx` command moves below the panel. It is honest and it belongs on the
 * page, but it was the third competing element in a column that already had a
 * headline and two buttons, and it is a command that does not work yet.
 */
const TRANSLATIONS: Array<{ locale: string; text: string; dir?: 'rtl' }> = [
  { locale: 'de', text: 'Änderungen speichern' },
  { locale: 'ja', text: '変更を保存' },
  { locale: 'es', text: 'Guardar cambios' },
  { locale: 'pt-BR', text: 'Salvar alterações' },
  { locale: 'ar', text: 'حفظ التغييرات', dir: 'rtl' },
];

const FONT_FOR: Record<string, string> = { ja: 'font-jp', ar: 'font-ar' };

export function Hero() {
  // No bottom rule on this section. The panel ends on "Opened as a pull
  // request" and the very next thing on the page is the dark band showing that
  // pull request — a hairline between them reads as a boundary between two
  // topics when it is one argument continuing.
  return (
    <section className="relative">
      <div className="mx-auto max-w-6xl px-4 pb-20 pt-16 sm:px-6 sm:pb-24 sm:pt-20">
        {/* The words. Held to a narrow measure and left-aligned against the
            same grid the panel below uses, so the two read as one block rather
            than as a centred banner sitting on a product shot. */}
        <p className="text-caption font-medium uppercase tracking-[0.14em] text-tertiary">
          Localization infrastructure
        </p>

        <h1 className="mt-5 max-w-[16ch] font-display text-display-xl font-semibold tracking-[-0.035em] text-primary lg:text-display-2xl">
          Your copy is a build artifact.
        </h1>

        <div className="mt-6 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <p className="max-w-[52ch] text-prose text-secondary">
            Localize Infra extracts the hardcoded strings from your codebase,
            translates them in context, and opens a pull request. The
            translations live in your repository — not in someone else&rsquo;s
            database.
          </p>

          {/*
           * The primary action is the one that works today (DESIGN.md §4.5).
           * Full-width and stacked below sm, where intrinsic-width buttons
           * against a full-bleed column are the scaled-down-desktop tell.
           */}
          <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              asChild
              variant="primary"
              size="lg"
              className="w-full sm:w-auto"
            >
              <a
                href={EXAMPLE_PR_URL}
                target="_blank"
                rel="noreferrer noopener"
              >
                <GitPullRequest aria-hidden="true" />
                See the pull request it opened
              </a>
            </Button>
            <Button
              asChild
              variant="secondary"
              size="lg"
              className="w-full sm:w-auto"
            >
              <Link href="/docs#install">Read the docs</Link>
            </Button>
          </div>
        </div>

        {/* The panel. One run, end to end, at full measure. */}
        <figure className="mt-12 overflow-hidden rounded-lg border border-line bg-surface/50 sm:mt-14">
          <figcaption className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-subtle px-4 py-2.5 sm:px-5">
            <span className="font-mono text-caption text-secondary">
              src/components/Form.tsx
            </span>
            <span className="font-mono text-micro uppercase tracking-wide text-tertiary">
              1 string found
            </span>
          </figcaption>

          <div className="grid gap-px bg-subtle sm:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
            {/* What it found.
                The framework line sits at the foot of the cell rather than
                leaving it short against five translation rows beside it — and
                it is information, not filler: detection is the first pipeline
                stage, and Vite + React is the stack of the fixture repository
                the linked pull request was actually opened against. */}
            <div className="flex flex-col justify-between bg-canvas px-4 py-5 sm:px-5">
              <div>
                <p className="text-caption uppercase tracking-wide text-tertiary">
                  Found in your source
                </p>
                <p className="mt-3 text-title font-medium tracking-[-0.01em] text-primary">
                  &ldquo;Save changes&rdquo;
                </p>
                <p className="mt-3 font-mono text-caption text-tertiary">
                  locales/en.json
                </p>
              </div>
              <dl className="mt-6 flex items-baseline gap-2 border-t border-subtle pt-3">
                <dt className="text-caption uppercase tracking-wide text-tertiary">
                  Detected
                </dt>
                <dd className="font-mono text-caption text-secondary">
                  Vite + React
                </dd>
              </dl>
            </div>

            {/* What it wrote. The State Rule carries confidence per line, in
                each language's own script and direction — a localization
                product rendering Arabic in a Latin fallback would be arguing
                against itself. */}
            <div className="bg-canvas px-4 py-5 sm:px-5">
              <p className="text-caption uppercase tracking-wide text-tertiary">
                Written to your repository
              </p>
              <ul className="mt-3 flex flex-col gap-2.5">
                {TRANSLATIONS.map((t) => (
                  <li key={t.locale}>
                    <StateRule
                      tone="confident"
                      className="flex items-baseline gap-3 ps-3"
                    >
                      <span className="w-14 shrink-0 font-mono text-micro uppercase text-tertiary">
                        {t.locale}
                      </span>
                      <span
                        lang={t.locale}
                        dir={t.dir ?? 'ltr'}
                        className={`min-w-0 text-body text-primary ${FONT_FOR[t.locale] ?? ''}`}
                      >
                        {t.text}
                      </span>
                    </StateRule>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* The run ends where the product ends. No counts are claimed here —
              the link goes to the real pull request, which is where they live. */}
          <a
            href={EXAMPLE_PR_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="group flex items-center gap-3 border-t border-subtle px-4 py-3.5 transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus sm:px-5"
          >
            <GitPullRequest
              className="size-4 shrink-0 text-confident"
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1 text-body text-primary">
              <span className="font-medium">Opened as a pull request</span>
              <span className="text-secondary">
                {' '}
                — reviewed and merged, like every other change
              </span>
            </span>
            <ArrowRight
              className="size-3.5 shrink-0 text-tertiary transition-transform duration-(--duration-micro) group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
              aria-hidden="true"
            />
          </a>
        </figure>

        {/* Below the panel, where it does not compete. Honest about what it is:
            a command that is not published yet. */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
          <div className="w-full sm:max-w-md">
            <CopyCommand command={INSTALL_COMMAND} />
          </div>
          <p className="text-small leading-6 text-tertiary">
            Not published to npm yet — today it runs from a clone.{' '}
            <Link
              href="/docs#install"
              className="rounded-sm text-link underline underline-offset-2 hover:text-link-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              Install guide
            </Link>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
