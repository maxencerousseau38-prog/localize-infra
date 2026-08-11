import { EXAMPLE_PR_URL, INSTALL_COMMAND } from '@/lib/constants';
import { Button, CopyCommand, StateRule } from '@localize-infra/ui';
import { ArrowRight, GitPullRequest } from 'lucide-react';
import Link from 'next/link';

/**
 * The hero.
 *
 * The previous version was the default developer-SaaS split: copy left,
 * boxed terminal right, both the same visual weight, headline small enough to
 * read as a paragraph. Nothing about it was wrong and nothing about it was
 * memorable.
 *
 * This one commits to one idea instead. The most characteristic thing in this
 * product's world is a *string becoming five strings*, so that transformation
 * is the hero artifact — rendered in the real script of each language, with the
 * State Rule down the leading edge. It is the product's atom shown at full
 * size, not a screenshot of a terminal.
 *
 * The grid is deliberately asymmetric — 7 columns of argument against 5 of
 * artifact — and the artifact bleeds past the container to the right on large
 * screens, so the first viewport has direction instead of symmetry.
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
  return (
    <section className="relative overflow-hidden border-b border-subtle">
      <div className="mx-auto max-w-6xl px-4 pb-20 pt-16 sm:px-6 sm:pb-28 sm:pt-24">
        {/* `items-center` rather than `items-start`: the argument column is
            taller than the artifact, and top-aligning them pooled every pixel
            of that difference into one dead block beneath the artifact
            (DESIGN.md §4.5). Centring distributes the slack above and below,
            so the artifact reads as balanced against the copy instead of
            hanging from the top of an empty column. */}
        <div className="grid items-center gap-14 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-7">
            <p className="text-caption font-medium uppercase tracking-[0.14em] text-tertiary">
              Localization infrastructure
            </p>

            {/* The measure is capped near 15ch so the line breaks land where
                the argument does, rather than wherever the container ends. */}
            <h1 className="mt-5 max-w-[15ch] font-display text-display-xl font-semibold tracking-[-0.035em] text-primary sm:text-display-2xl">
              Your copy is a build artifact.
            </h1>

            <p className="mt-6 max-w-[46ch] text-prose text-secondary">
              Localize Infra extracts the hardcoded strings from your codebase,
              translates them in context, and opens a pull request. The
              translations live in your repository — not in someone else&rsquo;s
              database.
            </p>

            {/*
             * CTA hierarchy inverted (DESIGN.md §4.5).
             *
             * The prominent action used to be a command that 404s for every
             * visitor who copies it, immediately followed by a sentence
             * explaining that it does not work — spending trust at the moment
             * it is highest. The rule now says the primary action must be one
             * that works today, so the real merged pull request takes that
             * place and the command is demoted to what it honestly is: where
             * this is going.
             */}
            {/* Full-width and stacked below sm (DESIGN.md §12): at 390 these
                sat at their intrinsic width against a full-bleed column, which
                is the scaled-down-desktop tell rather than a designed tier. */}
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
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
                <Link href="/docs#install">Run it on your repository</Link>
              </Button>
            </div>

            <div className="mt-7 max-w-lg border-t border-subtle pt-5">
              <CopyCommand command={INSTALL_COMMAND} />
              <p className="mt-2.5 text-small leading-6 text-tertiary">
                Not published to npm yet — this is where it is going. Today it
                runs from a clone:{' '}
                <Link
                  href="/docs#install"
                  className="rounded-sm text-link underline underline-offset-2 hover:text-link-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  see the docs
                </Link>
                .
              </p>
            </div>
          </div>

          {/* The artifact. Bleeds right past the container on lg so the
              composition has a direction; contained below that. */}
          <div className="lg:col-span-5 lg:-me-16 xl:-me-28">
            <figure className="rounded-lg border border-line bg-surface/60">
              <figcaption className="flex items-center justify-between border-b border-subtle px-4 py-2.5">
                <span className="font-mono text-caption text-tertiary">
                  src/components/Form.tsx
                </span>
                <span className="font-mono text-micro uppercase tracking-wide text-tertiary">
                  1 string
                </span>
              </figcaption>

              <div className="px-4 py-4">
                <p className="text-caption uppercase tracking-wide text-tertiary">
                  Found
                </p>
                <p className="mt-1.5 text-subtitle font-medium text-primary">
                  &ldquo;Save changes&rdquo;
                </p>
              </div>

              <div className="border-t border-subtle px-4 py-4">
                <p className="text-caption uppercase tracking-wide text-tertiary">
                  Written to your repository
                </p>
                <ul className="mt-3 flex flex-col gap-2.5">
                  {TRANSLATIONS.map((t) => (
                    <li key={t.locale}>
                      {/* The State Rule primitive, not a hand-rolled copy of
                          it. This card previously drew its own at 2px while the
                          system's is 3px — the signature element rendered wrong
                          on the most prominent surface in the product, which is
                          exactly the local reinvention DESIGN.md §5 calls a
                          defect. */}
                      <StateRule
                        tone="confident"
                        className="flex items-baseline gap-3 ps-3"
                      >
                        <span className="w-12 shrink-0 font-mono text-micro uppercase text-tertiary">
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

              {/*
               * The artifact ends where the product ends: a pull request.
               *
               * It used to stop at the translations, leaving roughly 300px of
               * empty column beneath it at 1440 — the dead zone DESIGN.md §4.5
               * now forbids. The fix is not padding: it is that the run has one
               * more step, and showing it both fills the space and puts the
               * product's actual deliverable above the fold instead of in the
               * section below.
               *
               * No file or line counts are claimed here. The link goes to the
               * real pull request, which is where those numbers live.
               */}
              <a
                href={EXAMPLE_PR_URL}
                target="_blank"
                rel="noreferrer noopener"
                className="group flex items-center gap-2.5 border-t border-subtle px-4 py-3 transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
              >
                <GitPullRequest
                  className="size-4 shrink-0 text-confident"
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-body font-medium text-primary">
                    Opened as a pull request
                  </span>
                  <span className="block text-caption text-tertiary">
                    Reviewed and merged, like every other change
                  </span>
                </span>
                <ArrowRight
                  className="size-3.5 shrink-0 text-tertiary transition-transform duration-(--duration-micro) group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
                  aria-hidden="true"
                />
              </a>
            </figure>
          </div>
        </div>
      </div>
    </section>
  );
}
