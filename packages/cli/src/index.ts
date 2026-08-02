#!/usr/bin/env node
import { runInit } from './commands/init.js';

async function main(): Promise<void> {
  const [, , command, targetDir] = process.argv;

  if (command !== 'init') {
    console.error(
      `Unknown command: ${command ?? '(none)'}\nUsage: localize-infra init [directory]`,
    );
    process.exitCode = 1;
    return;
  }

  const result = await runInit(targetDir ?? process.cwd());
  if (!result.ok) {
    console.error(result.reason);
    process.exitCode = 1;
    return;
  }

  console.log(`Detected framework: ${result.framework}`);
  console.log(`Wrote ${result.keysWritten} key(s) to locales/en.json`);
}

main();
