import { FileJson } from 'lucide-react';

/**
 * What the command actually prints, and the file it actually writes.
 *
 * Every line here was observed during end-to-end validation against a real
 * repository — this is the extraction step, which runs locally, needs no
 * account, and produces a file the user owns before anything touches the
 * network. That is the hero's argument, so showing the artefact is stronger
 * than illustrating it.
 *
 * Deliberately shows extraction rather than the full translate-and-PR run: the
 * observed run had four of five languages fail on an environment credential
 * issue, and presenting a clean five-language success would be inventing output
 * we never saw.
 */
const OUTPUT = [
  { text: 'Detected framework: Vite + React', tone: 'muted' as const },
  { text: 'Wrote 3 key(s) to locales/en.json', tone: 'ok' as const },
];

const FILE_LINES = [
  '{',
  '  "src.App.get_started": "Get started",',
  '  "src.App.this_is_a_throwaway_project_used_to_vali":',
  '    "This is a throwaway project used to validate…",',
  '  "src.App.welcome_to_the_fixture_app":',
  '    "Welcome to the fixture app"',
  '}',
];

export function HeroOutput() {
  return (
    <div aria-hidden="true" className="select-none space-y-4">
      <div className="overflow-hidden rounded-lg border border-line bg-surface">
        <div className="border-b border-subtle px-4 py-2">
          <span className="font-mono text-micro uppercase tracking-wide text-tertiary">
            Terminal
          </span>
        </div>
        <div className="px-4 py-3 font-mono text-caption leading-6">
          <div className="flex gap-2">
            <span className="text-tertiary">$</span>
            <span className="text-primary">npx @localize-infra/cli init</span>
          </div>
          {OUTPUT.map((line) => (
            <div
              key={line.text}
              className={
                line.tone === 'ok' ? 'text-confident-text' : 'text-secondary'
              }
            >
              {line.text}
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-line bg-canvas">
        <div className="flex items-center gap-2 border-b border-subtle px-4 py-2">
          <FileJson className="size-3.5 text-tertiary" />
          <span className="font-mono text-caption text-secondary">
            locales/en.json
          </span>
          <span className="ms-auto font-mono text-micro text-confident-text">
            new
          </span>
        </div>
        <pre className="overflow-x-auto px-4 py-3 font-mono text-caption leading-6 text-secondary">
          <code>{FILE_LINES.join('\n')}</code>
        </pre>
      </div>
    </div>
  );
}
