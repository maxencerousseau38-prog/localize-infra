import { EXAMPLE_PR_URL, INSTALL_COMMAND } from '@/lib/constants';
import { CopyCommand } from '@localize-infra/ui';
import { ArrowRight } from 'lucide-react';
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
        <div className="grid items-start gap-14 lg:grid-cols-12 lg:gap-10">
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

            <div className="mt-9 max-w-lg">
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

            <a
              href={EXAMPLE_PR_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="group mt-7 inline-flex items-center gap-1.5 rounded-sm text-body font-medium text-link transition-colors hover:text-link-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              See a real pull request
              <ArrowRight
                className="size-3.5 transition-transform duration-(--duration-micro) group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
                aria-hidden="true"
              />
            </a>
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
                    <li
                      key={t.locale}
                      className="flex items-baseline gap-3 [border-inline-start-color:var(--state-confident)] [border-inline-start-style:solid] [border-inline-start-width:2px] ps-3"
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
                    </li>
                  ))}
                </ul>
              </div>
            </figure>
          </div>
        </div>
      </div>
    </section>
  );
}
