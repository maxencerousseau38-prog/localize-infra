const STEPS = [
  {
    n: '01',
    title: 'Detect and extract',
    body: 'The CLI identifies your framework and walks the AST for hardcoded UI strings — JSX text and the attributes that carry copy. Test files, story files, numbers and entities are filtered out. You get locales/en.json before anything touches the network.',
  },
  {
    n: '02',
    title: 'Translate with context',
    body: 'Each string is sent with its file path, component name and surrounding code, so “Close” on a button is not translated as “nearby”. Placeholders and ICU plural syntax are preserved exactly; integrity is verified on every build.',
  },
  {
    n: '03',
    title: 'Open a pull request',
    body: 'One branch, one commit per run, one pull request touching only your locale files. Review it the way you review everything else. If a language fails, the others still ship and the failure is reported per language.',
  },
];

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
      <div className="max-w-2xl">
        <p className="text-caption font-medium uppercase tracking-[0.14em] text-tertiary">
          How it works
        </p>
        <h2 className="mt-3 font-display text-headline font-semibold tracking-[-0.02em] text-primary">
          One command, three steps, no new tab
        </h2>
      </div>

      {/* Drawn as a connected pipeline rather than three equal columns of
          prose. The steps are a genuine sequence, and this is the same visual
          language the application uses on run detail — so the site and the
          product read as one thing rather than two designs that share a
          palette. */}
      <ol className="mt-14 grid gap-10 lg:grid-cols-3 lg:gap-8">
        {STEPS.map((step, index) => (
          <li key={step.n} className="relative flex gap-4 lg:flex-col lg:gap-0">
            {index < STEPS.length - 1 ? (
              <span
                aria-hidden="true"
                className="absolute bg-subtle left-[15px] top-9 h-[calc(100%-1rem)] w-px lg:left-auto lg:top-[15px] lg:h-px lg:w-full lg:translate-x-9"
              />
            ) : null}

            <span
              aria-hidden="true"
              className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border border-line bg-canvas font-mono text-caption text-secondary"
            >
              {step.n}
            </span>

            <div className="min-w-0 pb-2 lg:mt-6 lg:pe-8">
              <h3 className="text-subtitle font-semibold tracking-[-0.01em] text-primary">
                {step.title}
              </h3>
              <p className="mt-2 text-body leading-6 text-secondary">
                {step.body}
              </p>
            </div>
          </li>
        ))}
      </ol>

      {/* Disclosed on the landing page, not buried in a privacy policy: source
          context leaving the machine is the single most likely objection from a
          security-conscious buyer, and hiding it until later would be a worse
          first impression than stating it plainly here. */}
      <p className="mt-10 max-w-[70ch] border-t border-subtle pt-6 text-small leading-6 text-tertiary">
        Step 02 sends the string, its file path, its component name and a short
        snippet of surrounding code to a third-party model provider. That
        context is what makes the translation good, and it means the snippet
        leaves your machine.{' '}
        <a
          href="/security"
          className="rounded-sm text-link underline underline-offset-2 hover:text-link-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          Exactly what is sent, and to whom
        </a>
        .
      </p>
    </section>
  );
}
