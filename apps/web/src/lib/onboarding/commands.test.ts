import { describe, expect, it } from 'vitest';
import {
  type CommandTarget,
  SHELLS,
  instructionsFor,
  isSafeTarget,
  isSafeToken,
  runCommand,
  setTokenCommand,
  translateOnlyCommand,
} from './commands.js';

const TOKEN = `lit_${'a'.repeat(43)}`;
const target = (over: Partial<CommandTarget> = {}): CommandTarget => ({
  owner: 'acme',
  repo: 'site',
  baseBranch: 'main',
  ...over,
});

describe('the run command reaches a pull request', () => {
  /*
   * The regression this file exists for: the panel printed
   * `npx @localize-infra/cli init` with no --open-pr, so following it
   * literally produced translations on disk and never a pull request — on the
   * one screen whose entire purpose is the first pull request.
   */
  it('passes --open-pr, and the owner, repo and branch it needs', () => {
    const command = runCommand('posix', target());
    expect(command).toContain('--open-pr');
    expect(command).toContain('--owner acme');
    expect(command).toContain('--repo site');
    expect(command).toContain('--base-branch main');
  });

  it('is the same line in both shells', () => {
    expect(runCommand('posix', target())).toBe(
      runCommand('powershell', target()),
    );
  });

  it('falls back to translate-only, which opens nothing, when there is no target', () => {
    const instructions = instructionsFor('posix', TOKEN, null);
    expect(instructions.openPr).toBe(false);
    expect(instructions.run).toBe(translateOnlyCommand());
    expect(instructions.run).not.toContain('--open-pr');
  });
});

describe('the two shells differ where they actually differ', () => {
  it('uses export for POSIX', () => {
    expect(setTokenCommand('posix', TOKEN)).toBe(
      `export LOCALIZE_API_TOKEN="${TOKEN}"`,
    );
  });

  it('uses $env: for PowerShell, because export is a syntax error there', () => {
    expect(setTokenCommand('powershell', TOKEN)).toBe(
      `$env:LOCALIZE_API_TOKEN = "${TOKEN}"`,
    );
  });

  it('never emits the POSIX form under a PowerShell label', () => {
    for (const shell of SHELLS) {
      const instructions = instructionsFor(shell, TOKEN, target());
      if (instructions.label === 'PowerShell') {
        expect(instructions.setToken).not.toContain('export ');
      } else {
        expect(instructions.setToken).not.toContain('$env:');
      }
    }
  });

  it('offers exactly the two shells, each labelled', () => {
    expect(SHELLS).toHaveLength(2);
    const labels = SHELLS.map(
      (shell) => instructionsFor(shell, TOKEN, target()).label,
    );
    expect(new Set(labels).size).toBe(2);
    for (const label of labels) expect(label.length).toBeGreaterThan(0);
  });
});

describe('values that cannot occur are refused, not escaped', () => {
  it('refuses a token that is not one', () => {
    for (const bad of [
      '',
      'nope',
      'lit_',
      `lit_${'a'.repeat(43)}"; rm -rf /`,
    ]) {
      expect(isSafeToken(bad), bad).toBe(false);
      expect(setTokenCommand('posix', bad), bad).toBeNull();
    }
  });

  it('accepts a real token shape', () => {
    expect(isSafeToken(TOKEN)).toBe(true);
    expect(isSafeToken('lit_aB3-_xyz')).toBe(true);
  });

  it('refuses shell metacharacters in owner, repo and branch', () => {
    const bad = [
      target({ owner: 'acme"; rm -rf /' }),
      target({ owner: '$(whoami)' }),
      target({ repo: 'site`id`' }),
      target({ repo: 'a b' }),
      target({ baseBranch: 'main; echo pwned' }),
      target({ owner: '' }),
      target({ repo: '' }),
    ];
    for (const value of bad) {
      expect(isSafeTarget(value), JSON.stringify(value)).toBe(false);
      expect(runCommand('posix', value)).toBeNull();
    }
  });

  it('accepts the branch shapes git itself accepts', () => {
    expect(isSafeTarget(target({ baseBranch: 'release/2.0' }))).toBe(true);
    expect(isSafeTarget(target({ baseBranch: 'feature/a-b_c.1' }))).toBe(true);
  });

  it('refuses the branch shapes git refuses', () => {
    for (const branch of ['/main', 'main/', 'a//b']) {
      expect(isSafeTarget(target({ baseBranch: branch })), branch).toBe(false);
    }
  });

  it('degrades to a runnable command rather than a broken one', () => {
    // A bad target must not produce `npx … --owner $(whoami)`; it produces the
    // translate-only line, and `openPr` says so.
    const instructions = instructionsFor(
      'posix',
      TOKEN,
      target({ owner: ';' }),
    );
    expect(instructions.openPr).toBe(false);
    expect(instructions.run).toBe(translateOnlyCommand());
  });
});

describe('every emitted command is one a shell can run', () => {
  it('never contains an unclosed quote', () => {
    for (const shell of SHELLS) {
      const instructions = instructionsFor(shell, TOKEN, target());
      for (const line of [instructions.setToken, instructions.run]) {
        if (!line) continue;
        expect((line.match(/"/g) ?? []).length % 2, line).toBe(0);
      }
    }
  });

  it('never contains a newline, which would run two commands from one paste', () => {
    for (const shell of SHELLS) {
      const instructions = instructionsFor(shell, TOKEN, target());
      expect(instructions.setToken ?? '').not.toContain('\n');
      expect(instructions.run).not.toContain('\n');
    }
  });
});
