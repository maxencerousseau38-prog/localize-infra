# M1 Phase 1 — `packages/core` + local dry-run CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the framework-detection, AST hardcoded-string extraction, and locale-file diff engine (`packages/core`), plus a `packages/cli` `init` command that runs them locally end-to-end — detecting a project's framework, extracting hardcoded UI strings, and writing a canonical `locales/en.json` catalog that doesn't duplicate keys or regress on re-runs. This is a complete, independently mergeable slice of M1: no network calls, no translation, no PR yet (that's M1 Phase 2, per `docs/superpowers/specs/2026-08-02-m1-npx-to-pr-design.md`).

**Architecture:** Two new open-source workspace packages. `packages/core` is pure logic (framework detectors, an AST extractor built on `ts-morph`, and a locale-file diff/merge engine) with zero I/O side effects except the explicit file-read/write functions in its `locale-file` module. `packages/cli` is a thin orchestrator: parse argv, call into `packages/core`, print progress, exit non-zero on failure. Both are testable without touching the filesystem beyond what each module's own tests explicitly exercise (temp directories, cleaned up after each test).

**Tech Stack:** TypeScript (strict), `ts-morph` for AST parsing, Vitest, pnpm workspaces (existing `packages/*` glob already covers these).

## Global Constraints

- M1 Phase 1 covers exactly 3 frameworks: Next.js, Vite + React, React Native (all TS/JS/TSX, parseable by `ts-morph`). Rails is explicitly out of scope (spec §2.1 — deferred to a future `tree-sitter` polyglot addition).
- No network calls anywhere in this phase — no translation API, no GitHub App. `runInit` writes only `locales/en.json` (the canonical English catalog), nothing else.
- Re-running `init` on an already-processed project must not duplicate keys or overwrite existing non-English translations (there are none yet in this phase, but the merge engine's contract must hold for M1 Phase 2, which will write real translations).
- TypeScript strict mode; Vitest is the only test runner; Biome is the only lint/format tool (already configured at the repo root — no new config needed, `biome.json`'s `vcs.useIgnoreFile` already excludes `node_modules`/build output).
- Both packages are open source (MIT), matching `packages/eval`'s precedent.
- No placeholders, TBDs, or vague steps.

---

### Task 1: `packages/core` scaffold + framework detectors

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/vitest.config.ts`
- Create: `packages/core/src/detect/types.ts`
- Create: `packages/core/src/detect/index.ts`
- Test: `packages/core/src/detect/index.test.ts`
- Create: `packages/core/src/index.ts`

**Interfaces:**
- Produces: `Framework { id: 'nextjs'|'vite-react'|'react-native'; name: string; sourceGlobs: string[]; localesDir: string }`, `detectFramework(rootDir: string): Framework | null` — consumed by Task 4's `packages/cli` `init` command and by Task 2's extractor (via `sourceGlobs`).

- [ ] **Step 1: Write `packages/core/package.json`**

```json
{
  "name": "@localize-infra/core",
  "version": "0.1.0",
  "private": false,
  "license": "MIT",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run"
  },
  "dependencies": {
    "ts-morph": "^24.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.9.0",
    "typescript": "^5.6.3",
    "vitest": "^2.1.4"
  }
}
```

- [ ] **Step 2: Write `packages/core/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Write `packages/core/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { environment: 'node' },
})
```

- [ ] **Step 4: Write `packages/core/src/detect/types.ts`**

```ts
export type FrameworkId = 'nextjs' | 'vite-react' | 'react-native'

export interface Framework {
  id: FrameworkId
  name: string
  // Glob patterns (relative to the project root) of source files to scan for
  // hardcoded strings. Consumed by the extractor in Task 2.
  sourceGlobs: string[]
  // Directory (relative to the project root) where locale JSON files are read/written.
  localesDir: string
}
```

- [ ] **Step 5: Write the failing test `packages/core/src/detect/index.test.ts`**

```ts
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { detectFramework } from './index.js'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'core-detect-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function writePackageJson(deps: Record<string, string>, devDeps: Record<string, string> = {}): void {
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({ name: 'fixture', dependencies: deps, devDependencies: devDeps }),
  )
}

describe('detectFramework', () => {
  it('detects Next.js from a "next" dependency', () => {
    writePackageJson({ next: '^14.0.0', react: '^18.0.0' })
    const framework = detectFramework(dir)
    expect(framework?.id).toBe('nextjs')
    expect(framework?.sourceGlobs).toContain('app/**/*.{ts,tsx}')
  })

  it('detects Next.js from a next.config.js file even without the dependency listed under a different key', () => {
    writePackageJson({}, { next: '^14.0.0' })
    writeFileSync(join(dir, 'next.config.js'), 'module.exports = {}')
    expect(detectFramework(dir)?.id).toBe('nextjs')
  })

  it('detects Vite + React from vite and react dependencies together', () => {
    writePackageJson({ react: '^18.0.0' }, { vite: '^5.0.0' })
    const framework = detectFramework(dir)
    expect(framework?.id).toBe('vite-react')
    expect(framework?.sourceGlobs).toContain('src/**/*.{ts,tsx}')
  })

  it('does not detect Vite + React from vite alone without react', () => {
    writePackageJson({}, { vite: '^5.0.0' })
    expect(detectFramework(dir)).toBeNull()
  })

  it('detects React Native from a "react-native" dependency', () => {
    writePackageJson({ react: '^18.0.0', 'react-native': '^0.74.0' })
    const framework = detectFramework(dir)
    expect(framework?.id).toBe('react-native')
  })

  it('prefers Next.js over React Native-style detection when both signals could theoretically overlap', () => {
    writePackageJson({ next: '^14.0.0', react: '^18.0.0' })
    expect(detectFramework(dir)?.id).toBe('nextjs')
  })

  it('returns null when no package.json exists', () => {
    expect(detectFramework(dir)).toBeNull()
  })

  it('returns null when package.json exists but matches no known framework', () => {
    writePackageJson({ express: '^4.0.0' })
    expect(detectFramework(dir)).toBeNull()
  })
})
```

- [ ] **Step 6: Install workspace dependencies, then run the test to verify it fails**

`packages/core` is a brand-new workspace member — `vitest` isn't resolvable yet until the workspace is (re-)installed. Run, from the repo root:
```bash
pnpm install
pnpm --filter @localize-infra/core exec vitest run src/detect
```
Expected: install succeeds (links `@localize-infra/core`, installs `ts-morph`/`vitest`; if `ts-morph@^24.0.0` fails to resolve, check what version pnpm reports as latest available and adjust the range in `package.json`, then re-run `pnpm install`); the test run FAILS with `Cannot find module './index.js'`.

- [ ] **Step 7: Write `packages/core/src/detect/index.ts`**

```ts
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Framework } from './types.js'

interface PackageJson {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

function readPackageJson(rootDir: string): PackageJson | null {
  const path = join(rootDir, 'package.json')
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, 'utf-8')) as PackageJson
}

function hasDependency(pkg: PackageJson, name: string): boolean {
  return Boolean(pkg.dependencies?.[name] || pkg.devDependencies?.[name])
}

const NEXT_CONFIG_FILES = ['next.config.js', 'next.config.mjs', 'next.config.ts']
const VITE_CONFIG_FILES = ['vite.config.js', 'vite.config.ts', 'vite.config.mjs']

export function detectFramework(rootDir: string): Framework | null {
  const pkg = readPackageJson(rootDir)
  if (!pkg) return null

  const hasNextConfig = NEXT_CONFIG_FILES.some((f) => existsSync(join(rootDir, f)))
  if (hasDependency(pkg, 'next') || hasNextConfig) {
    return {
      id: 'nextjs',
      name: 'Next.js',
      sourceGlobs: ['app/**/*.{ts,tsx}', 'pages/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}', 'src/**/*.{ts,tsx}'],
      localesDir: 'locales',
    }
  }

  const hasViteConfig = VITE_CONFIG_FILES.some((f) => existsSync(join(rootDir, f)))
  if (hasDependency(pkg, 'react') && (hasDependency(pkg, 'vite') || hasViteConfig)) {
    return {
      id: 'vite-react',
      name: 'Vite + React',
      sourceGlobs: ['src/**/*.{ts,tsx}'],
      localesDir: 'locales',
    }
  }

  if (hasDependency(pkg, 'react-native')) {
    return {
      id: 'react-native',
      name: 'React Native',
      sourceGlobs: ['App.tsx', 'App.ts', 'src/**/*.{ts,tsx}'],
      localesDir: 'locales',
    }
  }

  return null
}
```

- [ ] **Step 8: Write `packages/core/src/index.ts`**

```ts
export * from './detect/index.js'
export * from './detect/types.js'
```

- [ ] **Step 9: Run test to verify it passes**

Run: `pnpm --filter @localize-infra/core exec vitest run src/detect`
Expected: PASS — 8 tests passing

- [ ] **Step 10: Commit**

```bash
git add packages/core/package.json packages/core/tsconfig.json packages/core/vitest.config.ts packages/core/src/detect packages/core/src/index.ts pnpm-lock.yaml
git commit -m "feat(core): scaffold package and add framework detectors (Next.js, Vite+React, React Native)"
```

---

### Task 2: AST hardcoded-string extractor

**Files:**
- Create: `packages/core/src/extract/types.ts`
- Create: `packages/core/src/extract/index.ts`
- Test: `packages/core/src/extract/index.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1 directly (takes `sourceGlobs: string[]` as a plain parameter, not a `Framework` object, to stay independently testable).
- Produces: `ExtractedString { key: string; text: string; filePath: string; componentName: string | null; surroundingCode: string }`, `extractFromProject(rootDir: string, sourceGlobs: string[]): ExtractedString[]` — consumed by Task 4's `packages/cli` `init` command.

This task carries real API-shape risk: the exact `ts-morph` methods used below (`getFirstAncestorByKind`, `asKindOrThrow`, `getLiteralValue`, JSX node kinds) are written from best understanding of the library's public API, not verified against a live install before this plan was written. Treat the RED→GREEN cycle as the verification step — see the note after Step 2.

- [ ] **Step 1: Write `packages/core/src/extract/types.ts`**

```ts
export interface ExtractedString {
  key: string
  text: string
  filePath: string
  componentName: string | null
  surroundingCode: string
}
```

- [ ] **Step 2: Write the failing test `packages/core/src/extract/index.test.ts`**

```ts
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { extractFromProject } from './index.js'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'core-extract-'))
  mkdirSync(join(dir, 'src'), { recursive: true })
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function writeSource(relPath: string, content: string): void {
  writeFileSync(join(dir, relPath), content)
}

describe('extractFromProject', () => {
  it('extracts JSX text content as a hardcoded string', () => {
    writeSource(
      'src/Greeting.tsx',
      `export function Greeting() {\n  return <p>Welcome back</p>\n}\n`,
    )
    const results = extractFromProject(dir, ['src/**/*.{ts,tsx}'])
    expect(results.some((r) => r.text === 'Welcome back')).toBe(true)
  })

  it('extracts string literals from a whitelisted UI-text JSX attribute', () => {
    writeSource(
      'src/Search.tsx',
      `export function Search() {\n  return <input placeholder="Search products" />\n}\n`,
    )
    const results = extractFromProject(dir, ['src/**/*.{ts,tsx}'])
    expect(results.some((r) => r.text === 'Search products')).toBe(true)
  })

  it('does not extract a string literal from a non-whitelisted attribute like className', () => {
    writeSource(
      'src/Box.tsx',
      `export function Box() {\n  return <div className="flex items-center" />\n}\n`,
    )
    const results = extractFromProject(dir, ['src/**/*.{ts,tsx}'])
    expect(results.some((r) => r.text === 'flex items-center')).toBe(false)
  })

  it('skips JSX text already passed through a translation call', () => {
    writeSource(
      'src/Already.tsx',
      `export function Already({ t }: { t: (k: string) => string }) {\n  return <p>{t('already.translated')}</p>\n}\n`,
    )
    const results = extractFromProject(dir, ['src/**/*.{ts,tsx}'])
    expect(results.some((r) => r.text.includes('already.translated'))).toBe(false)
  })

  it('skips whitespace-only and identifier-like JSX text (no false positives on class-name-shaped strings)', () => {
    writeSource(
      'src/Icon.tsx',
      `export function Icon() {\n  return <span className="icon-arrow-right" />\n}\n`,
    )
    const results = extractFromProject(dir, ['src/**/*.{ts,tsx}'])
    expect(results).toHaveLength(0)
  })

  it('records the file path and surrounding code for each extracted string', () => {
    writeSource(
      'src/Header.tsx',
      `export function Header() {\n  return <h1>Dashboard</h1>\n}\n`,
    )
    const results = extractFromProject(dir, ['src/**/*.{ts,tsx}'])
    const match = results.find((r) => r.text === 'Dashboard')
    expect(match?.filePath).toBe('src/Header.tsx')
    expect(match?.surroundingCode).toContain('Dashboard')
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @localize-infra/core exec vitest run src/extract`
Expected: FAIL — `Cannot find module './index.js'`

- [ ] **Step 4: Write `packages/core/src/extract/index.ts`**

```ts
import { relative } from 'node:path'
import { Project, SyntaxKind, type Node, type SourceFile } from 'ts-morph'
import type { ExtractedString } from './types.js'

const TRANSLATION_CALL_NAME_PATTERN = /^(t|translate|i18n)$/i
const UI_TEXT_ATTRIBUTES = new Set(['placeholder', 'alt', 'title', 'aria-label'])
const MIN_TEXT_LENGTH = 2
const CONTEXT_LINES_BEFORE = 3
const CONTEXT_LINES_AFTER = 2

function looksLikeUiText(value: string): boolean {
  const trimmed = value.trim()
  if (trimmed.length < MIN_TEXT_LENGTH) return false
  const looksLikeIdentifierOrClassList = /^[a-z0-9_-]+$/i.test(trimmed) && !trimmed.includes(' ')
  return !looksLikeIdentifierOrClassList
}

function isInsideTranslationCall(node: Node): boolean {
  const call = node.getFirstAncestorByKind(SyntaxKind.CallExpression)
  if (!call) return false
  const calleeName = call.getExpression().getText().split('.').pop() ?? ''
  return TRANSLATION_CALL_NAME_PATTERN.test(calleeName)
}

function enclosingComponentName(node: Node): string | null {
  const fn = node.getFirstAncestor(
    (a) => a.getKind() === SyntaxKind.FunctionDeclaration || a.getKind() === SyntaxKind.VariableDeclaration,
  )
  if (!fn) return null
  if (fn.getKind() === SyntaxKind.FunctionDeclaration) {
    return fn.asKindOrThrow(SyntaxKind.FunctionDeclaration).getName() ?? null
  }
  return fn.asKindOrThrow(SyntaxKind.VariableDeclaration).getName()
}

function surroundingCode(node: Node): string {
  const startLine = node.getStartLineNumber()
  const allLines = node.getSourceFile().getFullText().split('\n')
  const from = Math.max(0, startLine - 1 - CONTEXT_LINES_BEFORE)
  const to = Math.min(allLines.length, startLine + CONTEXT_LINES_AFTER)
  return allLines.slice(from, to).join('\n')
}

function keyFor(filePath: string, text: string): string {
  const slug =
    text
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || 'text'
  const fileStem = filePath.replace(/\\/g, '/').replace(/\.(tsx?|jsx?)$/, '').replace(/\//g, '.')
  return `${fileStem}.${slug}`
}

function extractFromSourceFile(sourceFile: SourceFile, rootDir: string): ExtractedString[] {
  const results: ExtractedString[] = []
  const filePath = relative(rootDir, sourceFile.getFilePath()).replace(/\\/g, '/')

  sourceFile.forEachDescendant((node) => {
    if (node.getKind() === SyntaxKind.JsxText) {
      const text = node.getText()
      if (!looksLikeUiText(text) || isInsideTranslationCall(node)) return
      results.push({
        key: keyFor(filePath, text),
        text: text.trim(),
        filePath,
        componentName: enclosingComponentName(node),
        surroundingCode: surroundingCode(node),
      })
      return
    }

    if (node.getKind() === SyntaxKind.JsxAttribute) {
      const attr = node.asKindOrThrow(SyntaxKind.JsxAttribute)
      const attrName = attr.getNameNode().getText()
      if (!UI_TEXT_ATTRIBUTES.has(attrName)) return
      const initializer = attr.getInitializer()
      if (!initializer || initializer.getKind() !== SyntaxKind.StringLiteral) return
      const text = initializer.asKindOrThrow(SyntaxKind.StringLiteral).getLiteralValue()
      if (!looksLikeUiText(text) || isInsideTranslationCall(attr)) return
      results.push({
        key: keyFor(filePath, text),
        text,
        filePath,
        componentName: enclosingComponentName(attr),
        surroundingCode: surroundingCode(attr),
      })
    }
  })

  return results
}

export function extractFromProject(rootDir: string, sourceGlobs: string[]): ExtractedString[] {
  const project = new Project({ skipAddingFilesFromTsConfig: true, useInMemoryFileSystem: false })
  for (const glob of sourceGlobs) {
    project.addSourceFilesAtPaths(`${rootDir}/${glob}`)
  }
  const results: ExtractedString[] = []
  for (const sourceFile of project.getSourceFiles()) {
    results.push(...extractFromSourceFile(sourceFile, rootDir))
  }
  return results
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @localize-infra/core exec vitest run src/extract`
Expected: PASS — 6 tests passing. If any test fails with a `ts-morph` API error (a method doesn't exist, a kind check behaves differently than assumed) rather than a plain assertion mismatch, this is the expected place to discover it — inspect the actual `ts-morph` API (e.g. `node_modules/ts-morph/dist/ts-morph.d.ts`, or `console.log(Object.keys(node))` in a scratch script) and adjust the implementation to match reality, then re-run. This is expected due-diligence for this specific module, not a sign something else is wrong — see the note at the top of this task.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/extract
git commit -m "feat(core): add AST-based hardcoded string extractor"
```

---

### Task 3: Locale-file diff/merge engine

**Files:**
- Create: `packages/core/src/locale-file/index.ts`
- Test: `packages/core/src/locale-file/index.test.ts`

**Interfaces:**
- Consumes: `ExtractedString` (Task 2, only the `key`/`text` fields).
- Produces: `LocaleCatalog = Record<string, string>`, `buildKeyCatalog(entries: { key: string; text: string }[]): LocaleCatalog`, `readLocaleFile(localesDir: string, locale: string): LocaleCatalog`, `mergeLocaleFile(localesDir: string, locale: string, fresh: LocaleCatalog): LocaleCatalog`, `writeLocaleFile(localesDir: string, locale: string, catalog: LocaleCatalog): void` — all consumed by Task 4's `packages/cli` `init` command.

- [ ] **Step 1: Write the failing test `packages/core/src/locale-file/index.test.ts`**

```ts
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildKeyCatalog, mergeLocaleFile, readLocaleFile, writeLocaleFile } from './index.js'

let localesDir: string

beforeEach(() => {
  localesDir = mkdtempSync(join(tmpdir(), 'core-locale-file-'))
})

afterEach(() => {
  rmSync(localesDir, { recursive: true, force: true })
})

describe('buildKeyCatalog', () => {
  it('builds a key -> text record from extracted entries', () => {
    expect(buildKeyCatalog([{ key: 'a.b', text: 'Hello' }, { key: 'c.d', text: 'World' }])).toEqual({
      'a.b': 'Hello',
      'c.d': 'World',
    })
  })
})

describe('readLocaleFile', () => {
  it('returns an empty object when the file does not exist', () => {
    expect(readLocaleFile(localesDir, 'en')).toEqual({})
  })

  it('reads an existing locale file', () => {
    writeFileSync(join(localesDir, 'en.json'), JSON.stringify({ 'a.b': 'Hello' }))
    expect(readLocaleFile(localesDir, 'en')).toEqual({ 'a.b': 'Hello' })
  })
})

describe('mergeLocaleFile', () => {
  it('for the en locale, always uses the freshly extracted text (source of truth)', () => {
    writeFileSync(join(localesDir, 'en.json'), JSON.stringify({ 'a.b': 'Old text' }))
    const merged = mergeLocaleFile(localesDir, 'en', { 'a.b': 'New text' })
    expect(merged).toEqual({ 'a.b': 'New text' })
  })

  it('for a non-en locale, keeps the existing translated value when the key still exists in fresh', () => {
    writeFileSync(join(localesDir, 'de.json'), JSON.stringify({ 'a.b': 'Hallo' }))
    const merged = mergeLocaleFile(localesDir, 'de', { 'a.b': 'Hello (re-extracted, ignored for de)' })
    expect(merged).toEqual({ 'a.b': 'Hallo' })
  })

  it('for a non-en locale, adds a new key with the fresh (untranslated) value when no existing translation exists', () => {
    const merged = mergeLocaleFile(localesDir, 'de', { 'new.key': 'Brand new string' })
    expect(merged).toEqual({ 'new.key': 'Brand new string' })
  })

  it('drops keys that no longer appear in the fresh extraction, for both en and non-en locales', () => {
    writeFileSync(join(localesDir, 'de.json'), JSON.stringify({ 'stale.key': 'Ancien', 'kept.key': 'Gardé' }))
    const merged = mergeLocaleFile(localesDir, 'de', { 'kept.key': 'Kept (source)' })
    expect(merged).toEqual({ 'kept.key': 'Gardé' })
  })
})

describe('writeLocaleFile', () => {
  it('writes a sorted, pretty-printed JSON file with a trailing newline', () => {
    writeLocaleFile(localesDir, 'en', { 'z.key': 'Last', 'a.key': 'First' })
    const raw = readFileSync(join(localesDir, 'en.json'), 'utf-8')
    expect(raw).toBe('{\n  "a.key": "First",\n  "z.key": "Last"\n}\n')
  })

  it('creates the locales directory if it does not exist', () => {
    const nested = join(localesDir, 'nested', 'dir')
    writeLocaleFile(nested, 'en', { 'a.key': 'Hello' })
    expect(readLocaleFile(nested, 'en')).toEqual({ 'a.key': 'Hello' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @localize-infra/core exec vitest run src/locale-file`
Expected: FAIL — `Cannot find module './index.js'`

- [ ] **Step 3: Write `packages/core/src/locale-file/index.ts`**

```ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export type LocaleCatalog = Record<string, string>

export function buildKeyCatalog(entries: { key: string; text: string }[]): LocaleCatalog {
  const catalog: LocaleCatalog = {}
  for (const entry of entries) catalog[entry.key] = entry.text
  return catalog
}

export function readLocaleFile(localesDir: string, locale: string): LocaleCatalog {
  const path = join(localesDir, `${locale}.json`)
  if (!existsSync(path)) return {}
  return JSON.parse(readFileSync(path, 'utf-8')) as LocaleCatalog
}

// Keys present in `fresh` but not in the existing file are added. Keys present in the
// existing file but not in `fresh` are dropped (the source string was removed/changed
// upstream). For any locale other than 'en', a key present in BOTH keeps its existing
// (human- or model-translated) value — a re-extraction must never silently overwrite a
// real translation with the English source text. For 'en' itself, the freshly extracted
// text is always authoritative (it IS the source of truth).
export function mergeLocaleFile(localesDir: string, locale: string, fresh: LocaleCatalog): LocaleCatalog {
  const existing = readLocaleFile(localesDir, locale)
  const merged: LocaleCatalog = {}
  for (const key of Object.keys(fresh)) {
    merged[key] = locale === 'en' ? fresh[key] : (existing[key] ?? fresh[key])
  }
  return merged
}

export function writeLocaleFile(localesDir: string, locale: string, catalog: LocaleCatalog): void {
  mkdirSync(localesDir, { recursive: true })
  const sorted: LocaleCatalog = {}
  for (const key of Object.keys(catalog).sort()) sorted[key] = catalog[key]
  writeFileSync(join(localesDir, `${locale}.json`), `${JSON.stringify(sorted, null, 2)}\n`)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @localize-infra/core exec vitest run src/locale-file`
Expected: PASS — 9 tests passing

- [ ] **Step 5: Update `packages/core/src/index.ts` to export the new module**

```ts
export * from './detect/index.js'
export * from './detect/types.js'
export * from './extract/index.js'
export * from './extract/types.js'
export * from './locale-file/index.js'
```

- [ ] **Step 6: Run the full package test suite**

Run: `pnpm --filter @localize-infra/core exec vitest run`
Expected: PASS — 3 files, 23 tests passing (8 detect + 6 extract + 9 locale-file)

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/locale-file packages/core/src/index.ts
git commit -m "feat(core): add locale-file diff/merge engine, wire up package barrel export"
```

---

### Task 4: `packages/cli` scaffold + local `init` command

**Files:**
- Create: `packages/cli/package.json`
- Create: `packages/cli/tsconfig.json`
- Create: `packages/cli/vitest.config.ts`
- Create: `packages/cli/src/commands/init.ts`
- Test: `packages/cli/src/commands/init.test.ts`
- Create: `packages/cli/src/index.ts`

**Interfaces:**
- Consumes: `detectFramework`, `extractFromProject`, `buildKeyCatalog`, `mergeLocaleFile`, `writeLocaleFile` (all from `@localize-infra/core`, Tasks 1–3).
- Produces: `runInit(targetDir: string): Promise<{ ok: true; framework: string; keysWritten: number } | { ok: false; reason: string }>` — a return value (not `process.exit`) so it's directly unit-testable; the CLI entrypoint (`src/index.ts`) is the only place that translates this into an exit code and console output.

- [ ] **Step 1: Write `packages/cli/package.json`**

```json
{
  "name": "@localize-infra/cli",
  "version": "0.1.0",
  "private": false,
  "license": "MIT",
  "type": "module",
  "bin": {
    "localize-infra": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "dev": "tsx src/index.ts"
  },
  "dependencies": {
    "@localize-infra/core": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^22.9.0",
    "tsx": "^4.19.2",
    "typescript": "^5.6.3",
    "vitest": "^2.1.4"
  }
}
```

- [ ] **Step 2: Write `packages/cli/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "references": [{ "path": "../core" }],
  "include": ["src"]
}
```

- [ ] **Step 3: Write `packages/cli/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { environment: 'node' },
})
```

- [ ] **Step 4: Write the failing test `packages/cli/src/commands/init.test.ts`**

```ts
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runInit } from './init.js'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cli-init-'))
  mkdirSync(join(dir, 'src'), { recursive: true })
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function writeViteReactProject(): void {
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ dependencies: { react: '^18.0.0', vite: '^5.0.0' } }))
  writeFileSync(join(dir, 'src', 'App.tsx'), `export function App() {\n  return <h1>Welcome</h1>\n}\n`)
}

describe('runInit', () => {
  it('detects the framework, extracts strings, and writes locales/en.json', async () => {
    writeViteReactProject()
    const result = await runInit(dir)
    expect(result).toEqual({ ok: true, framework: 'Vite + React', keysWritten: 1 })
    const catalog = JSON.parse(readFileSync(join(dir, 'locales', 'en.json'), 'utf-8'))
    expect(Object.values(catalog)).toContain('Welcome')
  })

  it('returns ok:false with a clear reason when no framework is detected', async () => {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ dependencies: { express: '^4.0.0' } }))
    const result = await runInit(dir)
    expect(result).toEqual({
      ok: false,
      reason: 'No supported framework detected. Supported: Next.js, Vite + React, React Native.',
    })
  })

  it('re-running init on the same project does not duplicate or change existing keys', async () => {
    writeViteReactProject()
    await runInit(dir)
    const firstRun = JSON.parse(readFileSync(join(dir, 'locales', 'en.json'), 'utf-8'))
    const result = await runInit(dir)
    const secondRun = JSON.parse(readFileSync(join(dir, 'locales', 'en.json'), 'utf-8'))
    expect(result.ok).toBe(true)
    expect(secondRun).toEqual(firstRun)
  })
})
```

- [ ] **Step 5: Install workspace dependencies, then run the test to verify it fails**

`packages/cli` is a brand-new workspace member — `vitest` isn't resolvable yet until the workspace is (re-)installed. Run, from the repo root:
```bash
pnpm install
pnpm --filter @localize-infra/cli exec vitest run src/commands/init
```
Expected: install succeeds (links `@localize-infra/cli` to `@localize-infra/core` via `workspace:*`, installs `tsx`, no errors); the test run FAILS with `Cannot find module './init.js'`.

- [ ] **Step 6: Write `packages/cli/src/commands/init.ts`**

```ts
import { join } from 'node:path'
import {
  buildKeyCatalog,
  detectFramework,
  extractFromProject,
  mergeLocaleFile,
  writeLocaleFile,
} from '@localize-infra/core'

export type InitResult =
  | { ok: true; framework: string; keysWritten: number }
  | { ok: false; reason: string }

export async function runInit(targetDir: string): Promise<InitResult> {
  const framework = detectFramework(targetDir)
  if (!framework) {
    return {
      ok: false,
      reason: 'No supported framework detected. Supported: Next.js, Vite + React, React Native.',
    }
  }

  const extracted = extractFromProject(targetDir, framework.sourceGlobs)
  const fresh = buildKeyCatalog(extracted)
  const localesDir = join(targetDir, framework.localesDir)
  const merged = mergeLocaleFile(localesDir, 'en', fresh)
  writeLocaleFile(localesDir, 'en', merged)

  return { ok: true, framework: framework.name, keysWritten: Object.keys(merged).length }
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `pnpm --filter @localize-infra/cli exec vitest run src/commands/init`
Expected: PASS — 3 tests passing

- [ ] **Step 8: Write `packages/cli/src/index.ts`**

```ts
#!/usr/bin/env node
import { runInit } from './commands/init.js'

async function main(): Promise<void> {
  const [, , command, targetDir] = process.argv

  if (command !== 'init') {
    console.error(`Unknown command: ${command ?? '(none)'}\nUsage: localize-infra init [directory]`)
    process.exitCode = 1
    return
  }

  const result = await runInit(targetDir ?? process.cwd())
  if (!result.ok) {
    console.error(result.reason)
    process.exitCode = 1
    return
  }

  console.log(`Detected framework: ${result.framework}`)
  console.log(`Wrote ${result.keysWritten} key(s) to locales/en.json`)
}

main()
```

- [ ] **Step 9: Manually verify the CLI end-to-end against a throwaway local fixture**

```bash
mkdir -p /tmp/cli-smoke-test/src
cd /tmp/cli-smoke-test
cat > package.json <<'EOF'
{ "dependencies": { "react": "^18.0.0", "vite": "^5.0.0" } }
EOF
cat > src/App.tsx <<'EOF'
export function App() {
  return <h1>Welcome to the app</h1>
}
EOF
cd /c/Users/maxen/Projects/localize-infra
pnpm --filter @localize-infra/cli exec tsx src/index.ts init /tmp/cli-smoke-test
cat /tmp/cli-smoke-test/locales/en.json
rm -rf /tmp/cli-smoke-test
```
Expected: prints `Detected framework: Vite + React` and `Wrote 1 key(s) to locales/en.json`; the printed `en.json` contains a key mapping to `"Welcome to the app"`.

- [ ] **Step 10: Run the full test suite and typecheck for both new packages**

```bash
pnpm --filter @localize-infra/core exec vitest run
pnpm --filter @localize-infra/cli exec vitest run
pnpm --filter @localize-infra/core exec tsc -p tsconfig.json --noEmit
pnpm --filter @localize-infra/cli exec tsc -p tsconfig.json --noEmit
pnpm run lint
```
Expected: all clean.

- [ ] **Step 11: Commit**

```bash
git add packages/cli
git commit -m "feat(cli): add scaffold and local init command (detect + extract + write locales/en.json)"
```

---

## What's next (not in this plan)

M1 Phase 2 (separate plan, to follow immediately after this one is merged, per the design spec): `apps/api`'s `POST /v1/translate` endpoint, `services/github-app`'s PR-opening logic, and wiring `packages/cli`'s `init` command to call both — completing the real `npx → PR` flow. Per spec §2.3, that plan hits a genuine external blocker partway through: opening a real PR requires a GitHub App the human partner must create through GitHub's UI (no API/CLI can do this step). Everything up to that point (the API endpoint, the GitHub App service's logic tested against mocked Octokit calls, the CLI wiring) can be built and reviewed without it.
