import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export type TopLevel =
  | { kind: 'help' }
  | { kind: 'version' }
  | { kind: 'init' }
  | { kind: 'unknown'; command: string | undefined };

/**
 * What the arguments are asking for, before any of them are interpreted.
 *
 * `--help` and `--version` used to fall through to the unknown-command branch,
 * so they printed "Unknown command: --version" and exited 1 — the two things
 * anyone types first at a newly installed command, answered as mistakes.
 *
 * Scanned anywhere in the arguments rather than only in first position:
 * `localize-infra init --help` is a reasonable thing to type, and answering it
 * with a translation run — which calls a model and costs money — would be the
 * wrong reading of the request.
 */
export function parseTopLevel(args: readonly string[]): TopLevel {
  // Help before version when both appear: the more general request wins, and
  // stating the rule is better than letting argument order decide silently.
  if (args.includes('--help') || args.includes('-h')) return { kind: 'help' };
  if (args.includes('--version') || args.includes('-v')) {
    return { kind: 'version' };
  }
  if (args[0] === 'init') return { kind: 'init' };
  return { kind: 'unknown', command: args[0] };
}

export const USAGE = `Usage: localize-infra init [directory] [options]

Detects the framework, extracts hardcoded UI strings, writes locales/en.json,
translates into each target locale, and optionally opens a pull request.

Options:
  --force                     Overwrite existing locale files
  --api-url <url>             apps/api base URL (default: http://localhost:8787)
  --api-token <token>         Bearer token for apps/api — prefer the environment
                              variable, see below
  --locales <a,b,c>           Target locales (default: de,ja,es,ar,pt-BR)
  --open-pr                   Open a pull request with the updated locale files
  --owner <owner>             GitHub owner — required with --open-pr
  --repo <repo>               GitHub repository — required with --open-pr
  --base-branch <branch>      Base branch for the pull request (default: main)
  -h, --help                  Print this message
  -v, --version               Print the version

API token: set the LOCALIZE_API_TOKEN environment variable (recommended). The
--api-token flag is also available but leaks the token into shell history and
process listings (e.g. \`ps\`); prefer the environment variable. If both are set,
--api-token takes precedence.

Steps 4 and 5 talk to a running apps/api instance. There is no hosted API open
to the public, so --api-url must point at one you run yourself.`;

/**
 * The version this build carries, read from the manifest rather than baked in.
 *
 * A number written at build time can disagree with the one npm installed; this
 * one cannot. It matters because a bug report is worth exactly what its version
 * line is worth, and until now there was no way to print it.
 *
 * `..` resolves the same from `src/` and from `dist/`, because both sit one
 * level under the package root. A test asserts the result against the manifest
 * so a future `dist/cli/` breaks loudly rather than reporting `undefined`.
 */
export function readVersion(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const manifest = JSON.parse(
    readFileSync(join(here, '..', 'package.json'), 'utf8'),
  ) as { version?: string };
  return manifest.version ?? '0.0.0-unknown';
}
