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
const VALUE_FLAGS = new Set(['--api-url', '--locales']);

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
  const localesArg = readFlagValue(args, '--locales');
  const locales = localesArg
    ? localesArg.split(',').map((locale) => locale.trim())
    : undefined;
  const targetDir = findTargetDir(args.slice(1));

  if (command !== 'init') {
    console.error(
      `Unknown command: ${command ?? '(none)'}\nUsage: localize-infra init [directory] [--force] [--api-url <url>] [--locales <comma,separated,list>]`,
    );
    process.exitCode = 1;
    return;
  }

  const result = await runInit(targetDir ?? process.cwd(), {
    force,
    apiUrl,
    locales,
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
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
