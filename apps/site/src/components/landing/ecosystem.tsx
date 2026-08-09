import { EVAL_PACKAGE_URL } from '@/lib/constants';

/**
 * The ecosystem rail.
 *
 * Placed after "how it works" rather than under the hero: the three steps
 * raise the question "detects what, exactly?", and this answers it while the
 * question is live. Under the hero it would interrupt the argument before the
 * reader knows what the product does.
 *
 * **No brand logos, deliberately.** Two reasons, and either alone would decide
 * it. The design system's first rule is that chrome is neutral and colour means
 * something — six brand marks would be the loudest thing on the site and would
 * compete with the state palette that carries the product's actual meaning.
 * And a logo wall reads as endorsement whether or not it says "trusted by";
 * none of these projects endorse anything here. Wordmarks in the site's own
 * typography say the true thing without borrowing anyone's identity, and carry
 * no trademark question.
 *
 * **No marquee, deliberately.** A scrolling rail implies more items than fit.
 * There are six. Animating them would be decoration that improves no one's
 * comprehension, and it would buy CLS risk, overflow risk and a reduced-motion
 * branch for nothing.
 *
 * Every entry is verified against the repository. Vercel and Supabase were
 * considered and excluded: neither is integrated anywhere in this codebase, and
 * showing them would be the same unearned claim the rest of this site refuses.
 */
const GROUPS: Array<{
  label: string;
  note: string;
  items: string[];
}> = [
  {
    label: 'Detects',
    note: 'From your package.json and config files. No match is a refusal, never a guess.',
    items: ['Next.js', 'Vite + React', 'React Native'],
  },
  {
    label: 'Reads',
    note: 'An AST walk over your source, not a regular expression over your strings.',
    items: ['TypeScript', 'TSX', 'JSON'],
  },
  {
    label: 'Delivers to',
    note: 'A branch, a commit and a pull request through a GitHub App you install.',
    items: ['GitHub'],
  },
];

export function Ecosystem() {
  return (
    <section
      aria-labelledby="ecosystem"
      className="border-t border-subtle bg-surface/40"
    >
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="max-w-2xl">
          <h2
            id="ecosystem"
            className="font-display text-headline font-semibold tracking-[-0.015em] text-primary"
          >
            It works where your code already lives
          </h2>
          <p className="mt-3 text-prose text-secondary">
            There is nothing to migrate and no format to adopt. The CLI reads
            the repository you already have, and writes back to it.
          </p>
        </div>

        <dl className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-3">
          {GROUPS.map((group) => (
            <div key={group.label}>
              <dt className="text-caption font-medium uppercase tracking-wide text-tertiary">
                {group.label}
              </dt>
              <dd>
                <ul className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
                  {group.items.map((item) => (
                    <li
                      key={item}
                      className="text-subtitle font-medium tracking-[-0.01em] text-primary"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 max-w-[38ch] text-small leading-6 text-tertiary">
                  {group.note}
                </p>
              </dd>
            </div>
          ))}
        </dl>

        <p className="mt-10 max-w-[68ch] text-small leading-6 text-tertiary">
          That is the whole list. Other frameworks are not detected yet, and the
          extractor has limits worth knowing before you run it — both are
          documented rather than discovered. The corpus and checks behind the
          translation quality are in the{' '}
          <a
            href={EVAL_PACKAGE_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="rounded-sm text-link underline underline-offset-2 hover:text-link-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            MIT-licensed evaluation package
          </a>
          .
        </p>
      </div>
    </section>
  );
}
