/**
 * The exact commands to paste, for the two shells people actually have.
 *
 * ## Why this is a module and not a template literal in a component
 *
 * The panel that issues a token used to print `export LOCALIZE_API_TOKEN="…"`
 * followed by `npx @localize-infra/cli init`, and following those two lines
 * literally produces translated files on disk and **no pull request** — because
 * `init` does not open one without `--open-pr --owner --repo`. The screen that
 * exists to get someone to their first pull request was handing out the one
 * command that cannot produce one. Invariant 2 says the first deliverable is a
 * pull request; the copy block quietly stopped short of it.
 *
 * Putting the commands here means they can be asserted. A test reads the flags
 * `packages/cli` actually parses, so the day a flag is renamed the failure is a
 * red test rather than a customer whose paste does nothing.
 *
 * ## Why two shells
 *
 * `export VAR=…` is a syntax error in PowerShell, and PowerShell is the default
 * shell on Windows. Offering only the POSIX form is not a smaller feature, it
 * is a broken one for a large share of readers — and the failure is silent:
 * PowerShell reports `export : The term 'export' is not recognized`, which
 * reads like a missing program rather than the wrong dialect.
 */

export type Shell = 'posix' | 'powershell';

export interface CommandTarget {
  owner: string;
  repo: string;
  baseBranch: string;
}

/**
 * Values that may be interpolated into a shell command.
 *
 * Tokens are base64url, and GitHub owner/repo names are letters, digits, dot,
 * underscore and hyphen — so nothing legitimate needs quoting or escaping. That
 * is precisely why anything *outside* those sets is refused rather than
 * escaped: a value that cannot occur has no correct escaping, and emitting it
 * inside quotes would be guessing at what somebody meant by it.
 */
const SAFE_TOKEN = /^lit_[A-Za-z0-9_-]{1,128}$/;
const SAFE_SLUG = /^[A-Za-z0-9._-]{1,100}$/;
const SAFE_BRANCH = /^[A-Za-z0-9._\-/]{1,250}$/;

export function isSafeToken(value: string): boolean {
  return SAFE_TOKEN.test(value);
}

export function isSafeTarget(target: CommandTarget): boolean {
  return (
    SAFE_SLUG.test(target.owner) &&
    SAFE_SLUG.test(target.repo) &&
    SAFE_BRANCH.test(target.baseBranch) &&
    // A branch may contain '/', but not at either end and never doubled — the
    // shapes git itself refuses.
    !target.baseBranch.startsWith('/') &&
    !target.baseBranch.endsWith('/') &&
    !target.baseBranch.includes('//')
  );
}

/** `export VAR="value"` / `$env:VAR = "value"`. Null if the token is not one. */
export function setTokenCommand(shell: Shell, token: string): string | null {
  if (!isSafeToken(token)) return null;
  return shell === 'powershell'
    ? `$env:LOCALIZE_API_TOKEN = "${token}"`
    : `export LOCALIZE_API_TOKEN="${token}"`;
}

/**
 * The run that ends in a pull request.
 *
 * Identical in both shells — `npx` takes the same arguments either way — but it
 * is still asked for by shell, so a caller cannot accidentally pair a PowerShell
 * assignment with a POSIX run line and discover the asymmetry at the worst
 * moment.
 *
 * Null when the target is not something a shell should be handed.
 */
export function runCommand(
  _shell: Shell,
  target: CommandTarget,
): string | null {
  if (!isSafeTarget(target)) return null;
  return [
    'npx @localize-infra/cli init',
    '--open-pr',
    `--owner ${target.owner}`,
    `--repo ${target.repo}`,
    `--base-branch ${target.baseBranch}`,
  ].join(' ');
}

/**
 * The translate-only run, for a workspace with no repository connected yet.
 *
 * Offered instead of the pull-request command rather than alongside it: two
 * commands where one will fail is a choice the reader has no way to make.
 */
export function translateOnlyCommand(): string {
  return 'npx @localize-infra/cli init';
}

export interface ShellInstructions {
  shell: Shell;
  label: string;
  /** Null when the issued token is not a well-formed one. */
  setToken: string | null;
  /**
   * The run line, and whether it can reach a pull request. `openPr: false`
   * means no repository is connected, so the command translates only — said
   * out loud rather than presented as the same thing.
   */
  run: string;
  openPr: boolean;
}

export function instructionsFor(
  shell: Shell,
  token: string,
  target: CommandTarget | null,
): ShellInstructions {
  const pr = target ? runCommand(shell, target) : null;
  return {
    shell,
    label: shell === 'powershell' ? 'PowerShell' : 'macOS / Linux',
    setToken: setTokenCommand(shell, token),
    run: pr ?? translateOnlyCommand(),
    openPr: pr !== null,
  };
}

export const SHELLS: Shell[] = ['posix', 'powershell'];
