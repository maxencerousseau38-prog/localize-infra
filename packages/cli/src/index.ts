#!/usr/bin/env node
import { runInit } from './commands/init.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];
  const force = args.includes('--force');
  const targetDir = args.slice(1).find((arg) => !arg.startsWith('--'));

  if (command !== 'init') {
    console.error(
      `Unknown command: ${command ?? '(none)'}\nUsage: localize-infra init [directory] [--force]`,
    );
    process.exitCode = 1;
    return;
  }

  const result = await runInit(targetDir ?? process.cwd(), { force });
  if (!result.ok) {
    console.error(result.reason);
    process.exitCode = 1;
    return;
  }

  console.log(`Detected framework: ${result.framework}`);
  console.log(`Wrote ${result.keysWritten} key(s) to locales/en.json`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
