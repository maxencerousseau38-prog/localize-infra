#!/usr/bin/env node
import { runInit } from './commands/init.js';
import { fromFlagOrEnv } from './config.js';
import { USAGE, parseTopLevel, readVersion } from './meta.js';

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

  /*
   * Answered before anything else is read, and before `init` can start.
   *
   * `--help` and `--version` reached the unknown-command branch until now, so
   * they printed "Unknown command: --version" and exited 1. Handling them here
   * also means `localize-infra init --help` prints help instead of starting a
   * run that calls a model and bills for it.
   */
  const top = parseTopLevel(args);
  if (top.kind === 'help') {
    console.log(USAGE);
    return;
  }
  if (top.kind === 'version') {
    console.log(readVersion());
    return;
  }

  const force = args.includes('--force');
  /*
   * Flag over environment for both, and an empty value counts as neither.
   *
   * `--api-url` had no environment equivalent while `--api-token` did, so the
   * one setting a user cannot avoid — the default points at localhost, and
   * there is no hosted API open to the public — was the one they had to retype
   * on every invocation.
   *
   * `fromFlagOrEnv` rather than `??` because `LOCALIZE_API_URL=` sets the
   * variable to the empty string, which `??` keeps: every request would then
   * be sent to `/v1/translate` with no origin.
   */
  const apiUrl = fromFlagOrEnv(
    readFlagValue(args, '--api-url'),
    process.env.LOCALIZE_API_URL,
  );
  const apiToken = fromFlagOrEnv(
    readFlagValue(args, '--api-token'),
    process.env.LOCALIZE_API_TOKEN,
  );
  const localesArg = readFlagValue(args, '--locales');
  const locales = localesArg
    ? localesArg.split(',').map((locale) => locale.trim())
    : undefined;
  const openPr = args.includes('--open-pr');
  const owner = readFlagValue(args, '--owner');
  const repo = readFlagValue(args, '--repo');
  const baseBranch = readFlagValue(args, '--base-branch');
  const targetDir = findTargetDir(args.slice(1));

  if (top.kind === 'unknown') {
    // One usage text, in `meta.ts`, so the flags this branch advertises
    // cannot drift from the ones `--help` prints or the parser accepts. A
    // test asserts it names every flag consumed.
    console.error(`Unknown command: ${top.command ?? '(none)'}\n\n${USAGE}`);
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
