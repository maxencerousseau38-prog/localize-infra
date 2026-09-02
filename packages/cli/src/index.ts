#!/usr/bin/env node
import { runInit } from './commands/init.js';

function readFlagValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index === -1) {
    return undefined;
  }
  return args[index + 1];
}

// Flags that consume the following argument as their value, so it must be
// skipped when scanning for the positional target-directory argument.
const VALUE_FLAGS = new Set([
  '--api-url',
  '--api-token',
  '--locales',
  '--owner',
  '--repo',
  '--base-branch',
]);

function findTargetDir(args: string[]): string | undefined {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === undefined) {
      continue;
    }
    if (VALUE_FLAGS.has(arg)) {
      i++; // skip this flag's value
      continue;
    }
    if (!arg.startsWith('--')) {
      return arg;
    }
  }
  return undefined;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];
  const force = args.includes('--force');
  const apiUrl = readFlagValue(args, '--api-url');
  // --api-token takes precedence over LOCALIZE_API_TOKEN when both are given.
  const apiToken =
    readFlagValue(args, '--api-token') ?? process.env.LOCALIZE_API_TOKEN;
  const localesArg = readFlagValue(args, '--locales');
  const locales = localesArg
    ? localesArg.split(',').map((locale) => locale.trim())
    : undefined;
  const openPr = args.includes('--open-pr');
  const owner = readFlagValue(args, '--owner');
  const repo = readFlagValue(args, '--repo');
  const baseBranch = readFlagValue(args, '--base-branch');
  const targetDir = findTargetDir(args.slice(1));

  if (command !== 'init') {
    console.error(
      `Unknown command: ${command ?? '(none)'}\nUsage: localize-infra init [directory] [--force] [--api-url <url>] [--locales <comma,separated,list>] [--open-pr] [--owner <owner>] [--repo <repo>] [--base-branch <branch>] [--api-token <token>]\nAPI token: set the LOCALIZE_API_TOKEN environment variable (recommended). The --api-token flag is also available but leaks the token into shell history and process listings (e.g. \`ps\`); prefer the environment variable. If both are set, --api-token takes precedence.`,
    );
    process.exitCode = 1;
    return;
  }

  const result = await runInit(targetDir ?? process.cwd(), {
    force,
    apiUrl,
    apiToken,
    locales,
    openPr,
    owner,
    repo,
    baseBranch,
  });
  if (!result.ok) {
    console.error(result.reason);
    process.exitCode = 1;
    return;
  }

  console.log(`Detected framework: ${result.framework}`);
  console.log(`Wrote ${result.keysWritten} key(s) to locales/en.json`);
  for (const localeResult of result.locales) {
    if (localeResult.error !== null) {
      console.log(`  ${localeResult.locale}: FAILED - ${localeResult.error}`);
      continue;
    }
    const missingNote =
      localeResult.missingKeys.length > 0
        ? ` (${localeResult.missingKeys.length} string(s) not translated: ${localeResult.missingKeys.join(', ')})`
        : '';
    console.log(
      `  ${localeResult.locale}: ${localeResult.keysWritten} key(s)${missingNote}`,
    );
  }
  if (result.pr) {
    console.log(`Opened PR: ${result.pr.prUrl}`);
  } else if (openPr && result.locales.every((l) => l.error !== null)) {
    console.log(
      'No PR opened: all locale translations failed, so there was nothing to include.',
    );
  } else if (openPr) {
    // Reached when the API answered 409: every file the request carried is
    // already on the base branch. Said as the outcome it is, not as a failure —
    // the repository is up to date, which is the point of running again.
    console.log(
      'No PR opened: every translation is already on the base branch.',
    );
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
