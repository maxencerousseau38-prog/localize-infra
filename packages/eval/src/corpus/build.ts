import { execSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import {
  type CorpusEntry,
  CorpusEntrySchema,
  type TargetLocale,
} from '@localize-infra/schemas';
import { extractPoLocaleStrings } from '../adapters/gettext-locale.js';
import { extractJsonLocaleStrings } from '../adapters/json-locale.js';
import { deriveGlossary } from './glossary.js';
import { CORPUS_SOURCES, type CorpusSource } from './sources.js';

const WORKDIR = join(process.cwd(), '.corpus-checkout');
const DATA_DIR = join(process.cwd(), 'src/corpus/data');
const MAX_LENGTH_MULTIPLIER = 1.4;
const CONTEXT_WINDOW = 2;
const TARGET_CORPUS_SIZE = 400;

function cloneAtCommit(source: CorpusSource, dir: string): void {
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  // -c core.longpaths=true is scoped to these two invocations only (not a persistent git config
  // change) to work around Windows' 260-char MAX_PATH, which some source repos' unrelated
  // history files exceed.
  execSync(
    `git -c core.longpaths=true clone --filter=blob:none --no-checkout ${source.repoUrl} .`,
    {
      cwd: dir,
      stdio: 'inherit',
    },
  );
  execSync(`git -c core.longpaths=true checkout ${source.commit}`, {
    cwd: dir,
    stdio: 'inherit',
  });
}

function surroundingContext(fileContent: string, needle: string): string {
  const lines = fileContent.split('\n');
  const index = lines.findIndex((line) => line.includes(needle));
  if (index === -1) return '';
  const start = Math.max(0, index - CONTEXT_WINDOW);
  const end = Math.min(lines.length, index + CONTEXT_WINDOW + 1);
  return lines.slice(start, end).join('\n');
}

function buildFromJsonSource(
  source: Extract<CorpusSource, { format: 'json' }>,
  repoDir: string,
): CorpusEntry[] {
  const sourcePath = join(repoDir, source.sourceFilePath);
  const sourceRaw = readFileSync(sourcePath, 'utf-8');
  const sourceJson = JSON.parse(sourceRaw);
  const entries: CorpusEntry[] = [];

  for (const [locale, fileLocale] of Object.entries(source.locales) as [
    TargetLocale,
    string,
  ][]) {
    const targetPath = join(repoDir, source.localeFilePath(fileLocale));
    if (!existsSync(targetPath)) continue;
    const targetJson = JSON.parse(readFileSync(targetPath, 'utf-8'));
    const strings = extractJsonLocaleStrings(sourceJson, targetJson);
    for (const { key, sourceText, humanReference } of strings) {
      entries.push(
        CorpusEntrySchema.parse({
          id: `${source.project}-${key}-${locale}`,
          sourceProject: source.project,
          sourceLicense: source.license,
          sourceRepoUrl: source.repoUrl,
          sourceCommit: source.commit,
          filePath: source.sourceFilePath,
          surroundingCode: surroundingContext(
            sourceRaw,
            `"${key.split('.').pop()}"`,
          ),
          componentName: key.includes('.') ? key.split('.')[0] : null,
          icuStructure: null,
          sourceText,
          targetLocale: locale,
          humanReference,
          maxLength: Math.ceil(sourceText.length * MAX_LENGTH_MULTIPLIER),
        }),
      );
    }
  }
  return entries;
}

// zulip's .po files contain obsolete entries (lines prefixed `#~`), including some with the
// `#~|` "previous fuzzy msgid" comment form. gettext-parser@8.0.0 fails to parse that combination
// (throws "Invalid key name '|'"). Obsolete entries are dead/historical strings, not live
// translations, so stripping every `#~`-prefixed line before parsing discards no real corpus data
// — it only removes content the extractor would never have used anyway.
function stripObsoletePoEntries(buffer: Buffer): Buffer {
  const cleaned = buffer
    .toString('utf-8')
    .split('\n')
    .filter((line) => !line.startsWith('#~'))
    .join('\n');
  return Buffer.from(cleaned, 'utf-8');
}

function buildFromPoSource(
  source: Extract<CorpusSource, { format: 'po' }>,
  repoDir: string,
): CorpusEntry[] {
  const entries: CorpusEntry[] = [];
  for (const [locale, fileLocale] of Object.entries(source.locales) as [
    TargetLocale,
    string,
  ][]) {
    const sourcePath = join(repoDir, source.sourceFilePath(fileLocale));
    const targetPath = join(repoDir, source.localeFilePath(fileLocale));
    if (!existsSync(sourcePath) || !existsSync(targetPath)) continue;
    const strings = extractPoLocaleStrings(
      stripObsoletePoEntries(readFileSync(sourcePath)),
      stripObsoletePoEntries(readFileSync(targetPath)),
    );
    for (const { key, sourceText, humanReference } of strings) {
      entries.push(
        CorpusEntrySchema.parse({
          id: `${source.project}-${Buffer.from(key).toString('base64url').slice(0, 24)}-${locale}`,
          sourceProject: source.project,
          sourceLicense: source.license,
          sourceRepoUrl: source.repoUrl,
          sourceCommit: source.commit,
          filePath: source.sourceFilePath(fileLocale),
          surroundingCode: '',
          componentName: null,
          icuStructure: null,
          sourceText,
          targetLocale: locale,
          humanReference,
          maxLength: Math.ceil(sourceText.length * MAX_LENGTH_MULTIPLIER),
        }),
      );
    }
  }
  return entries;
}

function stratifiedSample(
  entries: CorpusEntry[],
  targetTotal: number,
): CorpusEntry[] {
  const groups = new Map<string, CorpusEntry[]>();
  for (const e of entries) {
    const key = `${e.sourceProject}-${e.targetLocale}`;
    const list = groups.get(key) ?? [];
    list.push(e);
    groups.set(key, list);
  }
  const perGroup = Math.ceil(targetTotal / groups.size);
  const sampled: CorpusEntry[] = [];
  for (const group of groups.values()) {
    const sorted = [...group].sort((a, b) =>
      a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
    );
    const stride = Math.max(1, Math.floor(sorted.length / perGroup));
    let count = 0;
    for (let i = 0; i < sorted.length && count < perGroup; i += stride) {
      const entry = sorted[i];
      if (!entry) continue;
      sampled.push(entry);
      count++;
    }
  }
  return sampled;
}

function main(): void {
  mkdirSync(DATA_DIR, { recursive: true });
  const allEntries: CorpusEntry[] = [];

  for (const source of CORPUS_SOURCES) {
    const repoDir = join(WORKDIR, source.project);
    cloneAtCommit(source, repoDir);
    const entries =
      source.format === 'json'
        ? buildFromJsonSource(source, repoDir)
        : buildFromPoSource(source, repoDir);
    allEntries.push(...entries);
    console.log(`${source.project}: ${entries.length} entries`);
  }

  const glossary = deriveGlossary(allEntries);
  const sampledEntries = stratifiedSample(allEntries, TARGET_CORPUS_SIZE);

  writeFileSync(
    join(DATA_DIR, 'entries.json'),
    JSON.stringify(sampledEntries, null, 2),
  );
  writeFileSync(
    join(DATA_DIR, 'glossary.json'),
    JSON.stringify(glossary, null, 2),
  );
  rmSync(WORKDIR, { recursive: true, force: true });

  const perLocale = new Map<string, number>();
  for (const e of sampledEntries)
    perLocale.set(e.targetLocale, (perLocale.get(e.targetLocale) ?? 0) + 1);
  console.log('Raw entries before sampling:', allEntries.length);
  console.log('Total entries:', sampledEntries.length);
  console.log('Per locale:', Object.fromEntries(perLocale));
}

const invokedPath = process.argv[1]?.replace(/\\/g, '/');
const modulePath = new URL(import.meta.url).pathname.replace(
  /^\/([A-Za-z]:)/,
  '$1',
);
if (invokedPath === modulePath) {
  main();
}
