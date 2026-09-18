'use client';

import {
  type CommandTarget,
  SHELLS,
  instructionsFor,
} from '@/lib/onboarding/commands';
import {
  CopyCommand,
  TabsContent,
  TabsList,
  TabsRoot,
  TabsTrigger,
} from '@localize-infra/ui';

/**
 * The two commands that take a freshly issued token to a pull request.
 *
 * ## Two shells, because one of them was broken
 *
 * This panel used to print `export LOCALIZE_API_TOKEN="…"` and nothing else.
 * `export` is not a PowerShell command, and PowerShell is the default shell on
 * Windows: the reader got `The term 'export' is not recognized`, which reads
 * like a missing program rather than the wrong dialect. Half the audience was
 * handed a paste that cannot work, with an error that does not say why.
 *
 * ## And the run line has to reach a pull request
 *
 * The old second line was `npx @localize-infra/cli init`, which translates and
 * opens nothing. Invariant 2 of this project is that the first deliverable is a
 * pull request; the screen whose whole job is getting somebody there stopped
 * one flag short of it. The flags come from `lib/onboarding/commands.ts`, where
 * a test pins them to the ones `packages/cli` actually parses.
 *
 * When no repository is connected the command is honestly the translate-only
 * one, and the panel says so rather than emitting `--owner null`.
 */
export function ShellInstructions({
  token,
  target,
}: {
  token: string;
  /** Null when no project has both a repository and a target locale. */
  target: CommandTarget | null;
}) {
  const perShell = SHELLS.map((shell) => instructionsFor(shell, token, target));
  const first = perShell[0];
  if (!first) return null;

  return (
    <TabsRoot defaultValue={first.shell}>
      <TabsList>
        {perShell.map((instructions) => (
          <TabsTrigger key={instructions.shell} value={instructions.shell}>
            {instructions.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {perShell.map((instructions) => (
        <TabsContent key={instructions.shell} value={instructions.shell}>
          <div className="flex flex-col gap-3" data-testid="shell-commands">
            <div>
              <p className="mb-1.5 text-caption text-tertiary">
                1 — hand the token to the CLI
              </p>
              {instructions.setToken ? (
                <CopyCommand
                  command={instructions.setToken}
                  prompt={instructions.shell === 'powershell' ? '>' : '$'}
                />
              ) : (
                /*
                 * Only reachable if the issued token is not a well-formed one,
                 * which would be a bug here rather than user error. Said plainly
                 * instead of rendering a command that cannot work.
                 */
                <p className="text-small text-failed-text">
                  This token could not be turned into a shell command. Revoke it
                  and issue another.
                </p>
              )}
            </div>

            <div>
              <p className="mb-1.5 text-caption text-tertiary">
                2 — run it in your project
              </p>
              <CopyCommand
                command={instructions.run}
                prompt={instructions.shell === 'powershell' ? '>' : '$'}
              />
            </div>

            {instructions.openPr ? null : (
              <p className="max-w-[64ch] text-caption leading-5 text-tertiary">
                This command translates and writes{' '}
                <span className="font-mono">locales/</span>; it does not open a
                pull request, because no project here has both a repository and
                a target language yet. Connect one and this command gains{' '}
                <span className="font-mono">--open-pr</span>.
              </p>
            )}
          </div>
        </TabsContent>
      ))}

      <p className="mt-3 max-w-[64ch] text-caption leading-5 text-tertiary">
        The first line puts the token in your shell’s history. On a shared
        machine, prefer setting it in your shell profile or a secret manager.
      </p>
    </TabsRoot>
  );
}
