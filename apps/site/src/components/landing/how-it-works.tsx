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
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <h2 className="max-w-2xl font-display text-headline font-semibold tracking-[-0.015em] text-primary">
        One command, three steps, no new tab
      </h2>

      <ol className="mt-10 grid gap-8 lg:grid-cols-3 lg:gap-12">
        {STEPS.map((step) => (
          <li key={step.n}>
            <span
              className="font-mono text-small text-tertiary"
              data-numeric
              aria-hidden="true"
            >
              {step.n}
            </span>
            <h3 className="mt-2 text-prose font-semibold text-primary">
              {step.title}
            </h3>
            <p className="mt-2 text-body leading-6 text-secondary">
              {step.body}
            </p>
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
