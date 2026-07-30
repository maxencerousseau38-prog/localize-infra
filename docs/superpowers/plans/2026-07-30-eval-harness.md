# Eval Harness (Sprint 0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `packages/eval`, the translation-quality evaluation harness that gates the whole localization-infrastructure project: a corpus of real OSS reference translations, a deterministic placeholder/ICU/plural test suite enforced in CI, a minimal two-provider model router, a condition A/B translation pipeline, and a blind human-preference comparison pipeline (generation + import + report + go/no-go gate).

**Architecture:** A pnpm/Turborepo monorepo with `packages/schemas` (shared Zod contracts) and `packages/eval` (the harness itself, organized as independent pipeline stages under `src/`: adapters → corpus → router → conditions → deterministic → human-eval → report). Each stage is a standalone script runnable via `pnpm --filter eval run <stage>` and importable as a module for testing. Corpus and translation outputs are committed as JSON fixtures so CI never depends on live network access or non-deterministic model calls.

**Tech Stack:** TypeScript (strict), pnpm workspaces, Turborepo, Vitest, Biome, Zod, `@formatjs/icu-messageformat-parser`, `gettext-parser`, native `fetch` for the Anthropic and OpenAI APIs.

## Global Constraints

- Deterministic placeholder + ICU integrity on condition-B translations must be ≥ 99.5% across the full corpus — this is the CI-enforced regression gate (spec §6/§11).
- Five target locales only: `de`, `ja`, `es`, `ar`, `pt-BR` (spec §1).
- The corpus is fetched once and **committed to git** — CI never re-fetches from external OSS repos (spec §5/§6).
- Condition B excludes screenshot context (deferred to M3) — it includes file path, surrounding code, component/module name, glossary, ICU structure, and a heuristic length constraint (spec §3).
- `packages/eval` is open source from this commit, licensed MIT (spec §10).
- No placeholders, TBDs, or vague steps — every corpus source, model default, and heuristic used below has been verified against the live repository before being written into this plan.
- TypeScript strict mode everywhere; Biome is the only lint/format tool; Vitest is the only test runner.

---

### Task 1: Monorepo scaffold

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `biome.json`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `CLAUDE.md`
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: workspace root that `packages/schemas` and `packages/eval` (Tasks 2–3) plug into via `pnpm-workspace.yaml` glob `packages/*`.

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "localize-infra",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20" },
  "scripts": {
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "biome check .",
    "format": "biome format --write ."
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.4",
    "turbo": "^2.3.0",
    "typescript": "^5.6.3"
  },
  "packageManager": "pnpm@9.12.0"
}
```

- [ ] **Step 2: Write `pnpm-workspace.yaml`**

```yaml
packages:
  - "packages/*"
```

- [ ] **Step 3: Write `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": []
    }
  }
}
```

- [ ] **Step 4: Write `biome.json`**

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "organizeImports": { "enabled": true },
  "linter": { "enabled": true, "rules": { "recommended": true } },
  "formatter": { "enabled": true, "indentStyle": "space", "indentWidth": 2 },
  "javascript": { "formatter": { "quoteStyle": "single" } }
}
```

- [ ] **Step 5: Write `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "composite": true
  }
}
```

- [ ] **Step 6: Write `.gitignore`**

```
node_modules/
dist/
.turbo/
*.tsbuildinfo
.env
```

- [ ] **Step 7: Write root `CLAUDE.md`**

```md
# Projet — infrastructure de localisation développeur-first

## Invariants (ne jamais violer sans validation explicite)
1. Git est la source de vérité. Postgres = index/cache.
2. Premier livrable = pull request, jamais dashboard.
3. Aucune facturation au mot/caractère/relecteur. Abonnement fixe uniquement.
4. L'agent remonte les ambiguïtés, il ne les devine pas.
5. Résidence des données UE.

## État actuel
Seul `packages/eval` (harnais d'évaluation, Sprint 0) et `packages/schemas`
existent pour l'instant. Voir `docs/superpowers/specs/2026-07-30-eval-harness-design.md`.

## Avant toute UI
Charger /mnt/skills/public/frontend-design/SKILL.md.
Produire le plan de design (palette, typo, layout, signature) AVANT le CSS.
Éviter les défauts IA identifiés dans le skill, notamment l'accent #D97757.

## MCP
Supabase : migrations, types, RLS (get_advisors systématique). Jamais les traductions.
Vercel : deploy, build logs, runtime errors.
Stripe : prix récurrents fixes uniquement. Jamais `metered`.
21st : primitives dashboard. Figma : seulement si design system existant.

## Open source
Ouverts : cli, core, adapters, sdk-*, schemas, eval.
Propriétaires : context, agents, api, web.
Le cœur ouvert doit être utilisable seul.

## Tests obligatoires en CI
Intégrité placeholders/ICU ≥ 99,5 % (packages/eval, condition B).
Harnais d'éval rejoué à chaque changement de modèle ou de prompt.
```

- [ ] **Step 8: Write `.github/workflows/ci.yml`**

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9.12.0
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm run lint
      - run: pnpm run test
```

- [ ] **Step 9: Install root dependencies**

Run: `pnpm install`
Expected: lockfile `pnpm-lock.yaml` created, no errors (no packages exist yet so this just installs root devDependencies).

- [ ] **Step 10: Commit**

```bash
git add package.json pnpm-workspace.yaml turbo.json biome.json tsconfig.base.json .gitignore CLAUDE.md .github pnpm-lock.yaml
git commit -m "chore: scaffold pnpm/turborepo monorepo root"
```

---

### Task 2: `packages/schemas` — shared Zod contracts

**Files:**
- Create: `packages/schemas/package.json`
- Create: `packages/schemas/tsconfig.json`
- Create: `packages/schemas/vitest.config.ts`
- Create: `packages/schemas/src/eval.ts`
- Create: `packages/schemas/src/index.ts`
- Test: `packages/schemas/src/eval.test.ts`

**Interfaces:**
- Produces: `CorpusEntrySchema`, `CorpusEntry`, `TranslationResultSchema`, `TranslationResult`, `DeterministicScoreSchema`, `DeterministicScore`, `GlossaryEntrySchema`, `GlossaryEntry`, `ComparisonTaskSchema`, `ComparisonTask`, `ComparisonJudgmentSchema`, `ComparisonJudgment`, `TARGET_LOCALES` (readonly tuple `['de','ja','es','ar','pt-BR']`), `ErrorTag` (union of the 6 taxonomy values) — all exported from `@localize-infra/schemas`.

- [ ] **Step 1: Write `packages/schemas/package.json`**

```json
{
  "name": "@localize-infra/schemas",
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
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "typescript": "^5.6.3",
    "vitest": "^2.1.4"
  }
}
```

- [ ] **Step 2: Write `packages/schemas/tsconfig.json`**

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

- [ ] **Step 3: Write `packages/schemas/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { environment: 'node' },
})
```

- [ ] **Step 4: Write the failing test `packages/schemas/src/eval.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import {
  ComparisonJudgmentSchema,
  ComparisonTaskSchema,
  CorpusEntrySchema,
  DeterministicScoreSchema,
  GlossaryEntrySchema,
  TARGET_LOCALES,
  TranslationResultSchema,
} from './eval.js'

const validEntry = {
  id: 'excalidraw-labels.paste-de',
  sourceProject: 'excalidraw',
  sourceLicense: 'MIT',
  sourceRepoUrl: 'https://github.com/excalidraw/excalidraw',
  sourceCommit: '786ab266ff3a9cfffaed16804cf9132b44bc08ae',
  filePath: 'packages/excalidraw/locales/en.json',
  surroundingCode: '"labels": { "paste": "Paste", "pasteAsPlaintext": "Paste as plaintext" }',
  componentName: 'labels',
  icuStructure: null,
  sourceText: 'Paste',
  targetLocale: 'de',
  humanReference: 'Einfügen',
  maxLength: 20,
}

describe('CorpusEntrySchema', () => {
  it('accepts a valid entry', () => {
    expect(CorpusEntrySchema.parse(validEntry)).toEqual(validEntry)
  })

  it('rejects a targetLocale outside the 5 supported locales', () => {
    expect(() => CorpusEntrySchema.parse({ ...validEntry, targetLocale: 'fr' })).toThrow()
  })

  it('rejects a negative maxLength', () => {
    expect(() => CorpusEntrySchema.parse({ ...validEntry, maxLength: -1 })).toThrow()
  })
})

describe('TranslationResultSchema', () => {
  it('accepts a valid result with a null error', () => {
    const result = {
      corpusEntryId: validEntry.id,
      condition: 'B',
      targetLocale: 'de',
      provider: 'anthropic',
      modelId: 'claude-sonnet-5',
      text: 'Einfügen',
      error: null,
    }
    expect(TranslationResultSchema.parse(result)).toEqual(result)
  })
})

describe('DeterministicScoreSchema', () => {
  it('allows null pluralCategoriesCorrect when the string has no plural', () => {
    const score = {
      corpusEntryId: validEntry.id,
      condition: 'B',
      placeholderIntact: true,
      icuValid: true,
      pluralCategoriesCorrect: null,
      lengthOverflow: false,
      glossaryHits: [],
    }
    expect(DeterministicScoreSchema.parse(score)).toEqual(score)
  })
})

describe('GlossaryEntrySchema', () => {
  it('accepts a term with per-locale translations', () => {
    const entry = { term: 'GitHub', translations: { de: 'GitHub', ja: 'GitHub' } }
    expect(GlossaryEntrySchema.parse(entry)).toEqual(entry)
  })
})

describe('ComparisonTaskSchema and ComparisonJudgmentSchema', () => {
  it('accepts a blind task and a judgment with a valid error tag', () => {
    const task = {
      id: 'task-1',
      corpusEntryId: validEntry.id,
      targetLocale: 'de',
      pairType: 'B_vs_C',
      left: 'Einfügen',
      right: 'Einfügen (aus Zwischenablage)',
      leftIsCondition: 'B',
      rightIsCondition: 'C',
    }
    expect(ComparisonTaskSchema.parse(task)).toEqual(task)

    const judgment = {
      taskId: 'task-1',
      evaluatorId: 'eval-1',
      preferred: 'equivalent',
      errorTags: ['registre'],
      notes: null,
    }
    expect(ComparisonJudgmentSchema.parse(judgment)).toEqual(judgment)
  })
})

describe('TARGET_LOCALES', () => {
  it('has exactly the 5 spec-mandated locales', () => {
    expect(TARGET_LOCALES).toEqual(['de', 'ja', 'es', 'ar', 'pt-BR'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @localize-infra/schemas exec vitest run`
Expected: FAIL — `Cannot find module './eval.js'`

- [ ] **Step 3: Write `packages/schemas/src/eval.ts`**

```ts
import { z } from 'zod'

export const TARGET_LOCALES = ['de', 'ja', 'es', 'ar', 'pt-BR'] as const
export type TargetLocale = (typeof TARGET_LOCALES)[number]

export const ERROR_TAGS = [
  'terminologie',
  'registre',
  'grammaire',
  'troncature',
  'placeholder_corrompu',
  'contresens',
] as const
export type ErrorTag = (typeof ERROR_TAGS)[number]

export const CorpusEntrySchema = z.object({
  id: z.string().min(1),
  sourceProject: z.string().min(1),
  sourceLicense: z.string().min(1),
  sourceRepoUrl: z.string().url(),
  sourceCommit: z.string().regex(/^[0-9a-f]{40}$/),
  filePath: z.string().min(1),
  surroundingCode: z.string(),
  componentName: z.string().nullable(),
  icuStructure: z.string().nullable(),
  sourceText: z.string().min(1),
  targetLocale: z.enum(TARGET_LOCALES),
  humanReference: z.string().min(1),
  maxLength: z.number().int().positive().nullable(),
})
export type CorpusEntry = z.infer<typeof CorpusEntrySchema>

export const TranslationResultSchema = z.object({
  corpusEntryId: z.string().min(1),
  condition: z.enum(['A', 'B']),
  targetLocale: z.enum(TARGET_LOCALES),
  provider: z.enum(['anthropic', 'openai']),
  modelId: z.string().min(1),
  text: z.string(),
  error: z.string().nullable(),
})
export type TranslationResult = z.infer<typeof TranslationResultSchema>

export const GlossaryHitSchema = z.object({
  term: z.string().min(1),
  respected: z.boolean(),
})

export const DeterministicScoreSchema = z.object({
  corpusEntryId: z.string().min(1),
  condition: z.enum(['A', 'B']),
  placeholderIntact: z.boolean(),
  icuValid: z.boolean(),
  pluralCategoriesCorrect: z.boolean().nullable(),
  lengthOverflow: z.boolean(),
  glossaryHits: z.array(GlossaryHitSchema),
})
export type DeterministicScore = z.infer<typeof DeterministicScoreSchema>

export const GlossaryEntrySchema = z.object({
  term: z.string().min(1),
  translations: z.record(z.string()),
})
export type GlossaryEntry = z.infer<typeof GlossaryEntrySchema>

export const ComparisonTaskSchema = z.object({
  id: z.string().min(1),
  corpusEntryId: z.string().min(1),
  targetLocale: z.enum(TARGET_LOCALES),
  pairType: z.enum(['A_vs_C', 'B_vs_C']),
  left: z.string(),
  right: z.string(),
  leftIsCondition: z.enum(['A', 'B', 'C']),
  rightIsCondition: z.enum(['A', 'B', 'C']),
})
export type ComparisonTask = z.infer<typeof ComparisonTaskSchema>

export const ComparisonJudgmentSchema = z.object({
  taskId: z.string().min(1),
  evaluatorId: z.string().min(1),
  preferred: z.enum(['left', 'right', 'equivalent']),
  errorTags: z.array(z.enum(ERROR_TAGS)),
  notes: z.string().nullable(),
})
export type ComparisonJudgment = z.infer<typeof ComparisonJudgmentSchema>
```

- [ ] **Step 4: Write `packages/schemas/src/index.ts`**

```ts
export * from './eval.js'
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @localize-infra/schemas exec vitest run`
Expected: PASS — 8 tests passing

- [ ] **Step 6: Commit**

```bash
git add packages/schemas
git commit -m "feat(schemas): add eval harness Zod contracts"
```

---

### Task 3: `packages/eval` scaffold + minimal model router

**Files:**
- Create: `packages/eval/package.json`
- Create: `packages/eval/tsconfig.json`
- Create: `packages/eval/vitest.config.ts`
- Create: `packages/eval/src/router/types.ts`
- Create: `packages/eval/src/router/anthropic.ts`
- Create: `packages/eval/src/router/openai.ts`
- Create: `packages/eval/src/router/index.ts`
- Test: `packages/eval/src/router/index.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks (schemas package is only used starting Task 4).
- Produces: `Provider` interface `{ name: 'anthropic'|'openai'; translate(req: TranslateRequest, modelId: string): Promise<string> }`, `TranslateRequest { systemPrompt: string; userPrompt: string }`, `pickProvider(seed: string): 'anthropic'|'openai'`, `getProvider(name): Provider`, `translate(req, { provider, modelId }): Promise<string>` — all consumed by Task 8's `conditions/translate.ts`.

- [ ] **Step 1: Write `packages/eval/package.json`**

```json
{
  "name": "@localize-infra/eval",
  "version": "0.1.0",
  "private": false,
  "license": "MIT",
  "type": "module",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "corpus:build": "tsx src/corpus/build.ts",
    "translate:run": "tsx src/conditions/translate.ts",
    "human-eval:generate": "tsx src/human-eval/export.ts",
    "report:build": "tsx src/report/build.ts"
  },
  "dependencies": {
    "@formatjs/icu-messageformat-parser": "^2.9.4",
    "@localize-infra/schemas": "workspace:*",
    "gettext-parser": "^8.0.0"
  },
  "devDependencies": {
    "@types/gettext-parser": "^4.0.4",
    "@types/node": "^22.9.0",
    "tsx": "^4.19.2",
    "typescript": "^5.6.3",
    "vitest": "^2.1.4"
  }
}
```

- [ ] **Step 2: Write `packages/eval/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "references": [{ "path": "../schemas" }],
  "include": ["src"]
}
```

- [ ] **Step 3: Write `packages/eval/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { environment: 'node' },
})
```

- [ ] **Step 4: Write `packages/eval/src/router/types.ts`**

```ts
export interface TranslateRequest {
  systemPrompt: string
  userPrompt: string
}

export interface Provider {
  name: 'anthropic' | 'openai'
  translate(req: TranslateRequest, modelId: string): Promise<string>
}
```

- [ ] **Step 5: Write the failing test `packages/eval/src/router/index.test.ts`**

```ts
import { describe, expect, it, vi } from 'vitest'
import { pickProvider } from './index.js'
import type { Provider, TranslateRequest } from './types.js'

describe('pickProvider', () => {
  it('is deterministic for the same seed', () => {
    expect(pickProvider('excalidraw-labels.paste-de')).toBe(pickProvider('excalidraw-labels.paste-de'))
  })

  it('distributes across both providers over many seeds', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 50; i++) seen.add(pickProvider(`entry-${i}`))
    expect(seen).toEqual(new Set(['anthropic', 'openai']))
  })
})

describe('translate', () => {
  it('delegates to the given provider with the given modelId', async () => {
    const { translate } = await import('./index.js')
    const fakeProvider: Provider = {
      name: 'anthropic',
      translate: vi.fn(async (_req: TranslateRequest, modelId: string) => `translated-by-${modelId}`),
    }
    const result = await translate({ systemPrompt: 'sys', userPrompt: 'Paste' }, fakeProvider, 'claude-sonnet-5')
    expect(result).toBe('translated-by-claude-sonnet-5')
    expect(fakeProvider.translate).toHaveBeenCalledWith({ systemPrompt: 'sys', userPrompt: 'Paste' }, 'claude-sonnet-5')
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `pnpm --filter @localize-infra/eval exec vitest run src/router`
Expected: FAIL — `Cannot find module './index.js'`

- [ ] **Step 7: Write `packages/eval/src/router/anthropic.ts`**

```ts
import type { Provider, TranslateRequest } from './types.js'

export function createAnthropicProvider(apiKey: string): Provider {
  return {
    name: 'anthropic',
    async translate(req: TranslateRequest, modelId: string): Promise<string> {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: modelId,
          max_tokens: 1024,
          system: req.systemPrompt,
          messages: [{ role: 'user', content: req.userPrompt }],
        }),
      })
      if (!response.ok) {
        throw new Error(`Anthropic API error ${response.status}: ${await response.text()}`)
      }
      const body = (await response.json()) as { content: { type: string; text: string }[] }
      const textBlock = body.content.find((block) => block.type === 'text')
      if (!textBlock) throw new Error('Anthropic response had no text content block')
      return textBlock.text.trim()
    },
  }
}
```

- [ ] **Step 8: Write `packages/eval/src/router/openai.ts`**

```ts
import type { Provider, TranslateRequest } from './types.js'

export function createOpenAiProvider(apiKey: string, baseUrl = 'https://api.openai.com/v1'): Provider {
  return {
    name: 'openai',
    async translate(req: TranslateRequest, modelId: string): Promise<string> {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelId,
          messages: [
            { role: 'system', content: req.systemPrompt },
            { role: 'user', content: req.userPrompt },
          ],
        }),
      })
      if (!response.ok) {
        throw new Error(`OpenAI API error ${response.status}: ${await response.text()}`)
      }
      const body = (await response.json()) as { choices: { message: { content: string } }[] }
      const content = body.choices[0]?.message.content
      if (!content) throw new Error('OpenAI response had no message content')
      return content.trim()
    },
  }
}
```

- [ ] **Step 9: Write `packages/eval/src/router/index.ts`**

```ts
import { createAnthropicProvider } from './anthropic.js'
import { createOpenAiProvider } from './openai.js'
import type { Provider, TranslateRequest } from './types.js'

export type { Provider, TranslateRequest } from './types.js'

export function pickProvider(seed: string): 'anthropic' | 'openai' {
  let hash = 0
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return hash % 2 === 0 ? 'anthropic' : 'openai'
}

export function getProvider(name: 'anthropic' | 'openai'): Provider {
  if (name === 'anthropic') {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set')
    return createAnthropicProvider(apiKey)
  }
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set')
  return createOpenAiProvider(apiKey, process.env.OPENAI_BASE_URL)
}

export async function translate(req: TranslateRequest, provider: Provider, modelId: string): Promise<string> {
  return provider.translate(req, modelId)
}
```

- [ ] **Step 10: Run test to verify it passes**

Run: `pnpm --filter @localize-infra/eval exec vitest run src/router`
Expected: PASS — 3 tests passing

- [ ] **Step 11: Install workspace dependencies**

Run: `pnpm install`
Expected: `@localize-infra/eval` linked to `@localize-infra/schemas` via workspace protocol, no errors.

- [ ] **Step 12: Commit**

```bash
git add packages/eval/package.json packages/eval/tsconfig.json packages/eval/vitest.config.ts packages/eval/src/router pnpm-lock.yaml
git commit -m "feat(eval): scaffold package and minimal Anthropic/OpenAI router"
```

---

### Task 4: JSON locale adapter

**Files:**
- Create: `packages/eval/src/adapters/json-locale.ts`
- Test: `packages/eval/src/adapters/json-locale.test.ts`

**Interfaces:**
- Produces: `flattenLocaleJson(obj: unknown): Map<string, string>` (dot-path key → string leaf, skips non-string/empty leaves), `extractJsonLocaleStrings(sourceJson, targetJson): { key: string; sourceText: string; humanReference: string }[]` — consumed by Task 6's `corpus/build.ts` for excalidraw and gitea.

- [ ] **Step 1: Write the failing test `packages/eval/src/adapters/json-locale.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { extractJsonLocaleStrings, flattenLocaleJson } from './json-locale.js'

describe('flattenLocaleJson', () => {
  it('flattens one level of nesting into dot-path keys, matching excalidraw locale files', () => {
    const input = { labels: { paste: 'Paste', copy: 'Copy' } }
    expect(flattenLocaleJson(input)).toEqual(
      new Map([
        ['labels.paste', 'Paste'],
        ['labels.copy', 'Copy'],
      ]),
    )
  })

  it('keeps flat dot-containing keys as-is, matching gitea locale files', () => {
    const input = { home_title: 'Home', 'form.password_lowercase_one': 'lowercase letter' }
    expect(flattenLocaleJson(input)).toEqual(
      new Map([
        ['home_title', 'Home'],
        ['form.password_lowercase_one', 'lowercase letter'],
      ]),
    )
  })

  it('skips empty-string leaves (untranslated entries)', () => {
    const input = { labels: { chartType_bar: '' } }
    expect(flattenLocaleJson(input)).toEqual(new Map())
  })

  it('skips non-string leaves', () => {
    const input = { count: 5, nested: { flag: true } }
    expect(flattenLocaleJson(input)).toEqual(new Map())
  })
})

describe('extractJsonLocaleStrings', () => {
  it('pairs source and target strings by key, dropping keys missing in either file', () => {
    const source = { labels: { paste: 'Paste', copy: 'Copy', onlyInSource: 'X' } }
    const target = { labels: { paste: 'Einfügen', copy: 'Kopieren', onlyInTarget: 'Y' } }
    expect(extractJsonLocaleStrings(source, target)).toEqual([
      { key: 'labels.paste', sourceText: 'Paste', humanReference: 'Einfügen' },
      { key: 'labels.copy', sourceText: 'Copy', humanReference: 'Kopieren' },
    ])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @localize-infra/eval exec vitest run src/adapters/json-locale`
Expected: FAIL — `Cannot find module './json-locale.js'`

- [ ] **Step 3: Write `packages/eval/src/adapters/json-locale.ts`**

```ts
export function flattenLocaleJson(obj: unknown, prefix = ''): Map<string, string> {
  const result = new Map<string, string>()
  if (typeof obj !== 'object' || obj === null) return result
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'string') {
      if (value.length > 0) result.set(path, value)
    } else if (typeof value === 'object' && value !== null) {
      for (const [nestedKey, nestedValue] of flattenLocaleJson(value, path)) {
        result.set(nestedKey, nestedValue)
      }
    }
  }
  return result
}

export interface ExtractedString {
  key: string
  sourceText: string
  humanReference: string
}

export function extractJsonLocaleStrings(sourceJson: unknown, targetJson: unknown): ExtractedString[] {
  const source = flattenLocaleJson(sourceJson)
  const target = flattenLocaleJson(targetJson)
  const extracted: ExtractedString[] = []
  for (const [key, sourceText] of source) {
    const humanReference = target.get(key)
    if (humanReference) extracted.push({ key, sourceText, humanReference })
  }
  return extracted
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @localize-infra/eval exec vitest run src/adapters/json-locale`
Expected: PASS — 5 tests passing

- [ ] **Step 5: Commit**

```bash
git add packages/eval/src/adapters/json-locale.ts packages/eval/src/adapters/json-locale.test.ts
git commit -m "feat(eval): add JSON locale adapter for flat and one-level-nested files"
```

---

### Task 5: gettext (.po) locale adapter

**Files:**
- Create: `packages/eval/src/adapters/gettext-locale.ts`
- Test: `packages/eval/src/adapters/gettext-locale.test.ts`

**Interfaces:**
- Produces: `extractPoLocaleStrings(sourceBuffer: Buffer, targetBuffer: Buffer): { key: string; sourceText: string; humanReference: string }[]` — consumed by Task 6's `corpus/build.ts` for zulip. Plural entries (`msgid_plural` present) are skipped: gettext plural-index-to-CLDR-category mapping requires evaluating each locale's `Plural-Forms` C expression, which is out of scope for Sprint 0 (spec §6 relies on hand-crafted fixtures, not corpus-sourced strings, for plural-category testing — see Task 7).

- [ ] **Step 1: Write the failing test `packages/eval/src/adapters/gettext-locale.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { extractPoLocaleStrings } from './gettext-locale.js'

const enPo = Buffer.from(`msgid ""
msgstr ""
"Content-Type: text/plain; charset=UTF-8\\n"

msgid "Not allowed for guest users"
msgstr ""

msgid "Invalid organization"
msgstr ""

msgid "{secs}{nbsp}second"
msgid_plural "{secs}{nbsp}seconds"
msgstr[0] ""
msgstr[1] ""
`)

const dePo = Buffer.from(`msgid ""
msgstr ""
"Content-Type: text/plain; charset=UTF-8\\n"

msgid "Not allowed for guest users"
msgstr "Nicht erlaubt für Gastnutzer"

msgid "Invalid organization"
msgstr ""

msgid "{secs}{nbsp}second"
msgid_plural "{secs}{nbsp}seconds"
msgstr[0] "{secs}{nbsp}Sekunde"
msgstr[1] "{secs}{nbsp}Sekunden"
`)

describe('extractPoLocaleStrings', () => {
  it('pairs translated singular entries, using the msgid as both key and source text', () => {
    expect(extractPoLocaleStrings(enPo, dePo)).toEqual([
      {
        key: 'Not allowed for guest users',
        sourceText: 'Not allowed for guest users',
        humanReference: 'Nicht erlaubt für Gastnutzer',
      },
    ])
  })

  it('skips entries with an empty msgstr in the target file', () => {
    const extracted = extractPoLocaleStrings(enPo, dePo)
    expect(extracted.find((e) => e.key === 'Invalid organization')).toBeUndefined()
  })

  it('skips plural entries (msgid_plural present)', () => {
    const extracted = extractPoLocaleStrings(enPo, dePo)
    expect(extracted.find((e) => e.key.includes('second'))).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @localize-infra/eval exec vitest run src/adapters/gettext-locale`
Expected: FAIL — `Cannot find module './gettext-locale.js'`

- [ ] **Step 3: Write `packages/eval/src/adapters/gettext-locale.ts`**

```ts
import gettextParser from 'gettext-parser'

interface PoTranslation {
  msgid: string
  msgid_plural?: string
  msgstr: string[]
}

interface ParsedPo {
  translations: Record<string, Record<string, PoTranslation>>
}

function flattenPoTranslations(buffer: Buffer): Map<string, PoTranslation> {
  const parsed = gettextParser.po.parse(buffer) as ParsedPo
  const flat = new Map<string, PoTranslation>()
  for (const context of Object.values(parsed.translations)) {
    for (const [msgid, entry] of Object.entries(context)) {
      if (msgid === '') continue
      flat.set(msgid, entry)
    }
  }
  return flat
}

export interface ExtractedString {
  key: string
  sourceText: string
  humanReference: string
}

export function extractPoLocaleStrings(sourceBuffer: Buffer, targetBuffer: Buffer): ExtractedString[] {
  const source = flattenPoTranslations(sourceBuffer)
  const target = flattenPoTranslations(targetBuffer)
  const extracted: ExtractedString[] = []
  for (const [msgid, sourceEntry] of source) {
    if (sourceEntry.msgid_plural) continue
    const targetEntry = target.get(msgid)
    const humanReference = targetEntry?.msgstr[0]
    if (targetEntry && !targetEntry.msgid_plural && humanReference) {
      extracted.push({ key: msgid, sourceText: msgid, humanReference })
    }
  }
  return extracted
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @localize-infra/eval exec vitest run src/adapters/gettext-locale`
Expected: PASS — 3 tests passing. If `gettext-parser`'s actual export shape differs from the `gettextParser.po.parse(buffer)` assumed here, this step's failure will show the real error (e.g. a different import path) — adjust the import to match and re-run.

- [ ] **Step 5: Commit**

```bash
git add packages/eval/src/adapters/gettext-locale.ts packages/eval/src/adapters/gettext-locale.test.ts
git commit -m "feat(eval): add gettext .po locale adapter"
```

---

### Task 6: Corpus sources, glossary derivation, and the `corpus:build` script

**Files:**
- Create: `packages/eval/src/corpus/sources.ts`
- Create: `packages/eval/src/corpus/glossary.ts`
- Test: `packages/eval/src/corpus/glossary.test.ts`
- Create: `packages/eval/src/corpus/build.ts`
- Create: `packages/eval/src/corpus/README.md`

**Interfaces:**
- Consumes: `extractJsonLocaleStrings` (Task 4), `extractPoLocaleStrings` (Task 5), `CorpusEntrySchema`/`CorpusEntry`/`GlossaryEntrySchema`/`GlossaryEntry` (Task 2).
- Produces: `packages/eval/src/corpus/data/entries.json` (`CorpusEntry[]`) and `packages/eval/src/corpus/data/glossary.json` (`GlossaryEntry[]`), committed to git. `deriveGlossary(entries: CorpusEntry[]): GlossaryEntry[]` consumed by Task 7's glossary checker and Task 8's condition-B prompt builder.

- [ ] **Step 1: Write `packages/eval/src/corpus/sources.ts`**

```ts
export type LocaleFormat = 'json' | 'po'

export interface JsonSource {
  project: string
  license: string
  repoUrl: string
  commit: string
  format: 'json'
  sourceFilePath: string
  localeFilePath: (locale: string) => string
  locales: Partial<Record<'de' | 'ja' | 'es' | 'ar' | 'pt-BR', string>>
}

export interface PoSource {
  project: string
  license: string
  repoUrl: string
  commit: string
  format: 'po'
  sourceFilePath: (locale: string) => string
  localeFilePath: (locale: string) => string
  locales: Partial<Record<'de' | 'ja' | 'es' | 'ar' | 'pt-BR', string>>
}

export type CorpusSource = JsonSource | PoSource

export const CORPUS_SOURCES: CorpusSource[] = [
  {
    project: 'excalidraw',
    license: 'MIT',
    repoUrl: 'https://github.com/excalidraw/excalidraw',
    commit: '786ab266ff3a9cfffaed16804cf9132b44bc08ae',
    format: 'json',
    sourceFilePath: 'packages/excalidraw/locales/en.json',
    localeFilePath: (fileLocale) => `packages/excalidraw/locales/${fileLocale}.json`,
    locales: { de: 'de-DE', ja: 'ja-JP', es: 'es-ES', ar: 'ar-SA', 'pt-BR': 'pt-BR' },
  },
  {
    project: 'gitea',
    license: 'MIT',
    repoUrl: 'https://github.com/go-gitea/gitea',
    commit: 'a30d865b781b4611826bf44d60e44d9f6e8fdf4e',
    format: 'json',
    sourceFilePath: 'options/locale/locale_en-US.json',
    localeFilePath: (fileLocale) => `options/locale/locale_${fileLocale}.json`,
    locales: { de: 'de-DE', ja: 'ja-JP', es: 'es-ES', 'pt-BR': 'pt-BR' },
  },
  {
    project: 'zulip',
    license: 'Apache-2.0',
    repoUrl: 'https://github.com/zulip/zulip',
    commit: '83cdbfd28c14bb950d67e578893a062add8af633',
    format: 'po',
    sourceFilePath: (fileLocale) => `locale/${fileLocale}/LC_MESSAGES/django.po`,
    localeFilePath: (fileLocale) => `locale/${fileLocale}/LC_MESSAGES/django.po`,
    locales: { de: 'de', ja: 'ja', es: 'es', ar: 'ar' },
  },
]
```

- [ ] **Step 2: Write the failing test `packages/eval/src/corpus/glossary.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import type { CorpusEntry } from '@localize-infra/schemas'
import { deriveGlossary } from './glossary.js'

function entry(overrides: Partial<CorpusEntry>): CorpusEntry {
  return {
    id: 'x',
    sourceProject: 'excalidraw',
    sourceLicense: 'MIT',
    sourceRepoUrl: 'https://github.com/excalidraw/excalidraw',
    sourceCommit: '786ab266ff3a9cfffaed16804cf9132b44bc08ae',
    filePath: 'en.json',
    surroundingCode: '',
    componentName: null,
    icuStructure: null,
    sourceText: 'Sign in with GitHub',
    targetLocale: 'de',
    humanReference: 'Mit GitHub anmelden',
    maxLength: null,
    ...overrides,
  }
}

describe('deriveGlossary', () => {
  it('keeps a candidate term for a locale when it appears verbatim in at least 80% of matching translations', () => {
    const entries = [
      entry({ id: '1' }),
      entry({ id: '2' }),
      entry({ id: '3' }),
      entry({ id: '4', sourceText: 'Connect GitHub account', humanReference: 'GitHub-Konto verbinden' }),
    ]
    const glossary = deriveGlossary(entries)
    const github = glossary.find((g) => g.term === 'GitHub')
    expect(github?.translations.de).toBe('GitHub')
  })

  it('drops a term for a locale below the 80% verbatim threshold', () => {
    const entries = [
      entry({ id: '1' }),
      entry({ id: '2' }),
      entry({ id: '3' }),
      entry({ id: '4', humanReference: 'Übersetzt ohne den Begriff' }),
      entry({ id: '5', humanReference: 'Auch ohne den Begriff' }),
    ]
    const glossary = deriveGlossary(entries)
    expect(glossary.find((g) => g.term === 'GitHub')).toBeUndefined()
  })

  it('drops a term seen fewer than 3 times for a locale', () => {
    const entries = [entry({ id: '1' }), entry({ id: '2' })]
    const glossary = deriveGlossary(entries)
    expect(glossary.find((g) => g.term === 'GitHub')).toBeUndefined()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @localize-infra/eval exec vitest run src/corpus/glossary`
Expected: FAIL — `Cannot find module './glossary.js'`

- [ ] **Step 4: Write `packages/eval/src/corpus/glossary.ts`**

```ts
import type { CorpusEntry, GlossaryEntry } from '@localize-infra/schemas'

const CANDIDATE_TERMS = ['GitHub', 'OAuth', 'SSH', 'Markdown', 'API', 'URL', 'Excalidraw', 'Gitea', 'Zulip', 'webhook']
const MIN_OCCURRENCES = 3
const VERBATIM_THRESHOLD = 0.8

export function deriveGlossary(entries: CorpusEntry[]): GlossaryEntry[] {
  const byLocale = new Map<string, CorpusEntry[]>()
  for (const e of entries) {
    const list = byLocale.get(e.targetLocale) ?? []
    list.push(e)
    byLocale.set(e.targetLocale, list)
  }

  const glossary: GlossaryEntry[] = []
  for (const term of CANDIDATE_TERMS) {
    const translations: Record<string, string> = {}
    for (const [locale, localeEntries] of byLocale) {
      const withTerm = localeEntries.filter((e) => e.sourceText.includes(term))
      if (withTerm.length < MIN_OCCURRENCES) continue
      const keptVerbatim = withTerm.filter((e) => e.humanReference.includes(term))
      if (keptVerbatim.length / withTerm.length >= VERBATIM_THRESHOLD) {
        translations[locale] = term
      }
    }
    if (Object.keys(translations).length > 0) glossary.push({ term, translations })
  }
  return glossary
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @localize-infra/eval exec vitest run src/corpus/glossary`
Expected: PASS — 3 tests passing

- [ ] **Step 6: Write `packages/eval/src/corpus/build.ts`**

```ts
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { CorpusEntrySchema, type CorpusEntry, type TargetLocale } from '@localize-infra/schemas'
import { extractJsonLocaleStrings } from '../adapters/json-locale.js'
import { extractPoLocaleStrings } from '../adapters/gettext-locale.js'
import { CORPUS_SOURCES, type CorpusSource } from './sources.js'
import { deriveGlossary } from './glossary.js'

const WORKDIR = join(process.cwd(), '.corpus-checkout')
const DATA_DIR = join(process.cwd(), 'src/corpus/data')
const MAX_LENGTH_MULTIPLIER = 1.4
const CONTEXT_WINDOW = 2

function cloneAtCommit(source: CorpusSource, dir: string): void {
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  execSync(`git clone --filter=blob:none --no-checkout ${source.repoUrl} .`, { cwd: dir, stdio: 'inherit' })
  execSync(`git checkout ${source.commit}`, { cwd: dir, stdio: 'inherit' })
}

function surroundingContext(fileContent: string, needle: string): string {
  const lines = fileContent.split('\n')
  const index = lines.findIndex((line) => line.includes(needle))
  if (index === -1) return ''
  const start = Math.max(0, index - CONTEXT_WINDOW)
  const end = Math.min(lines.length, index + CONTEXT_WINDOW + 1)
  return lines.slice(start, end).join('\n')
}

function buildFromJsonSource(source: Extract<CorpusSource, { format: 'json' }>, repoDir: string): CorpusEntry[] {
  const sourcePath = join(repoDir, source.sourceFilePath)
  const sourceRaw = readFileSync(sourcePath, 'utf-8')
  const sourceJson = JSON.parse(sourceRaw)
  const entries: CorpusEntry[] = []

  for (const [locale, fileLocale] of Object.entries(source.locales) as [TargetLocale, string][]) {
    const targetPath = join(repoDir, source.localeFilePath(fileLocale))
    if (!existsSync(targetPath)) continue
    const targetJson = JSON.parse(readFileSync(targetPath, 'utf-8'))
    const strings = extractJsonLocaleStrings(sourceJson, targetJson)
    for (const { key, sourceText, humanReference } of strings) {
      entries.push(
        CorpusEntrySchema.parse({
          id: `${source.project}-${key}-${locale}`,
          sourceProject: source.project,
          sourceLicense: source.license,
          sourceRepoUrl: source.repoUrl,
          sourceCommit: source.commit,
          filePath: source.sourceFilePath,
          surroundingCode: surroundingContext(sourceRaw, `"${key.split('.').pop()}"`),
          componentName: key.includes('.') ? key.split('.')[0] : null,
          icuStructure: null,
          sourceText,
          targetLocale: locale,
          humanReference,
          maxLength: Math.ceil(sourceText.length * MAX_LENGTH_MULTIPLIER),
        }),
      )
    }
  }
  return entries
}

function buildFromPoSource(source: Extract<CorpusSource, { format: 'po' }>, repoDir: string): CorpusEntry[] {
  const entries: CorpusEntry[] = []
  for (const [locale, fileLocale] of Object.entries(source.locales) as [TargetLocale, string][]) {
    const sourcePath = join(repoDir, source.sourceFilePath(fileLocale))
    const targetPath = join(repoDir, source.localeFilePath(fileLocale))
    if (!existsSync(sourcePath) || !existsSync(targetPath)) continue
    const strings = extractPoLocaleStrings(readFileSync(sourcePath), readFileSync(targetPath))
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
      )
    }
  }
  return entries
}

function main(): void {
  mkdirSync(DATA_DIR, { recursive: true })
  const allEntries: CorpusEntry[] = []

  for (const source of CORPUS_SOURCES) {
    const repoDir = join(WORKDIR, source.project)
    cloneAtCommit(source, repoDir)
    const entries = source.format === 'json' ? buildFromJsonSource(source, repoDir) : buildFromPoSource(source, repoDir)
    allEntries.push(...entries)
    console.log(`${source.project}: ${entries.length} entries`)
  }

  writeFileSync(join(DATA_DIR, 'entries.json'), JSON.stringify(allEntries, null, 2))
  writeFileSync(join(DATA_DIR, 'glossary.json'), JSON.stringify(deriveGlossary(allEntries), null, 2))
  rmSync(WORKDIR, { recursive: true, force: true })

  const perLocale = new Map<string, number>()
  for (const e of allEntries) perLocale.set(e.targetLocale, (perLocale.get(e.targetLocale) ?? 0) + 1)
  console.log('Total entries:', allEntries.length)
  console.log('Per locale:', Object.fromEntries(perLocale))
}

main()
```

- [ ] **Step 7: Write `packages/eval/src/corpus/README.md`**

```md
# Corpus de référence

Chaînes UI et traductions communautaires natives extraites de projets OSS sous
licence permissive, pour évaluer la qualité de traduction du harnais sans
payer de référence humaine.

## Sources (voir `sources.ts` pour les commits exacts)

| Projet | Licence | Format | Locales couvertes |
|---|---|---|---|
| [excalidraw](https://github.com/excalidraw/excalidraw) | MIT | JSON (`packages/excalidraw/locales/*.json`) | de, ja, es, ar, pt-BR |
| [gitea](https://github.com/go-gitea/gitea) | MIT | JSON (`options/locale/locale_*.json`) | de, ja, es, pt-BR |
| [zulip](https://github.com/zulip/zulip) | Apache-2.0 | gettext `.po` (`locale/*/LC_MESSAGES/django.po`) | de, ja, es, ar |

Chaque `CorpusEntry` conserve `sourceRepoUrl` et `sourceCommit` pour l'attribution et la reproductibilité.

## Régénérer le corpus

```bash
pnpm --filter @localize-infra/eval run corpus:build
```

Écrit `data/entries.json` et `data/glossary.json`. Les deux fichiers sont committés — le CI ne dépend jamais d'un accès réseau à ces dépôts externes.

## Simplifications assumées (Sprint 0)

- Les entrées gettext avec `msgid_plural` sont ignorées (voir `adapters/gettext-locale.ts`) : la reconstruction ICU à partir de l'index `msgstr[n]` + l'expression `Plural-Forms` par locale est hors périmètre. Le checker de catégories de pluriel (`deterministic/plurals.ts`) est testé avec des fixtures ICU manuelles, pas avec ce corpus.
- `maxLength` est une heuristique (1,4 × la longueur de la chaîne source), pas une mesure de conteneur réelle — voir spec §3.
- Le glossaire est dérivé automatiquement à partir d'une liste de termes techniques/marque candidats, pas d'un glossaire officiel des projets sources.
```

- [ ] **Step 8: Run the corpus builder against the live repositories**

Run: `pnpm --filter @localize-infra/eval run corpus:build`
Expected: clones excalidraw, gitea, zulip at the pinned commits into `.corpus-checkout/` (git-ignored), prints per-project and per-locale entry counts, writes `packages/eval/src/corpus/data/entries.json` and `glossary.json`, then deletes `.corpus-checkout/`. If any locale file path has moved since the commits were pinned in Task 6 Step 1, this step's error will name the missing path — fix the path in `sources.ts` and re-run.

- [ ] **Step 9: Commit**

```bash
git add packages/eval/src/corpus
git commit -m "feat(eval): build reference corpus from excalidraw, gitea, zulip"
```

---

### Task 7: Deterministic checkers

**Files:**
- Create: `packages/eval/src/deterministic/placeholders.ts`
- Test: `packages/eval/src/deterministic/placeholders.test.ts`
- Create: `packages/eval/src/deterministic/icu.ts`
- Test: `packages/eval/src/deterministic/icu.test.ts`
- Create: `packages/eval/src/deterministic/plurals.ts`
- Test: `packages/eval/src/deterministic/plurals.test.ts`
- Create: `packages/eval/src/deterministic/length.ts`
- Test: `packages/eval/src/deterministic/length.test.ts`
- Create: `packages/eval/src/deterministic/glossary.ts`
- Test: `packages/eval/src/deterministic/glossary.test.ts`
- Create: `packages/eval/src/deterministic/score.ts`
- Test: `packages/eval/src/deterministic/score.test.ts`

**Interfaces:**
- Consumes: `CorpusEntry`, `TranslationResult`, `DeterministicScore`, `GlossaryEntry` (Task 2), `deriveGlossary` (Task 6, only in the score test fixture).
- Produces: `scoreTranslation(entry: CorpusEntry, result: TranslationResult, glossary: GlossaryEntry[]): DeterministicScore` — consumed by Task 9's regression gate test.

- [ ] **Step 1: Write the failing test `packages/eval/src/deterministic/placeholders.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { extractPlaceholders, placeholdersIntact } from './placeholders.js'

describe('extractPlaceholders', () => {
  it('extracts single-brace, double-brace, and printf placeholders', () => {
    expect(extractPlaceholders('Hello {name}, you have %d new {{type}}')).toEqual([
      { syntax: 'doubleBrace', token: '{{type}}' },
      { syntax: 'brace', token: '{name}' },
      { syntax: 'printf', token: '%d' },
    ])
  })

  it('does not treat ICU control clauses as plain brace placeholders', () => {
    expect(extractPlaceholders('{count, plural, one {# item} other {# items}}')).toEqual([])
  })
})

describe('placeholdersIntact', () => {
  it('is true when all placeholder tokens are preserved, in any order', () => {
    expect(placeholdersIntact('Hi {name}, {{count}} items', 'Salut {{count}} objets, {name}')).toBe(true)
  })

  it('is false when a placeholder is dropped', () => {
    expect(placeholdersIntact('Hi {name}', 'Salut')).toBe(false)
  })

  it('is false when a placeholder is duplicated', () => {
    expect(placeholdersIntact('Hi {name}', 'Salut {name} {name}')).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @localize-infra/eval exec vitest run src/deterministic/placeholders`
Expected: FAIL — `Cannot find module './placeholders.js'`

- [ ] **Step 3: Write `packages/eval/src/deterministic/placeholders.ts`**

```ts
export type PlaceholderSyntax = 'brace' | 'doubleBrace' | 'printf'

export interface PlaceholderToken {
  syntax: PlaceholderSyntax
  token: string
}

export function extractPlaceholders(text: string): PlaceholderToken[] {
  const tokens: PlaceholderToken[] = []

  for (const m of text.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)) {
    tokens.push({ syntax: 'doubleBrace', token: `{{${m[1]}}}` })
  }

  const withoutDoubleBrace = text.replace(/\{\{\s*[a-zA-Z0-9_]+\s*\}\}/g, '')
  for (const m of withoutDoubleBrace.matchAll(/\{([a-zA-Z0-9_]+)\}/g)) {
    tokens.push({ syntax: 'brace', token: `{${m[1]}}` })
  }

  for (const m of text.matchAll(/%(?:\d+\$)?[sd]/g)) {
    tokens.push({ syntax: 'printf', token: m[0] })
  }

  return tokens
}

function tokenCounts(tokens: PlaceholderToken[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const t of tokens) counts.set(t.token, (counts.get(t.token) ?? 0) + 1)
  return counts
}

export function placeholdersIntact(source: string, translated: string): boolean {
  const sourceCounts = tokenCounts(extractPlaceholders(source))
  const translatedCounts = tokenCounts(extractPlaceholders(translated))
  if (sourceCounts.size !== translatedCounts.size) return false
  for (const [token, count] of sourceCounts) {
    if (translatedCounts.get(token) !== count) return false
  }
  return true
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @localize-infra/eval exec vitest run src/deterministic/placeholders`
Expected: PASS — 5 tests passing

- [ ] **Step 5: Write the failing test `packages/eval/src/deterministic/icu.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { isIcuMessage, validateIcu } from './icu.js'

describe('isIcuMessage', () => {
  it('detects a plural control structure', () => {
    expect(isIcuMessage('{count, plural, one {# item} other {# items}}')).toBe(true)
  })

  it('does not flag a plain interpolation as ICU', () => {
    expect(isIcuMessage('Hello {name}')).toBe(false)
  })
})

describe('validateIcu', () => {
  it('accepts a well-formed ICU plural message', () => {
    expect(validateIcu('{count, plural, one {# item} other {# items}}')).toBe(true)
  })

  it('rejects a malformed ICU message', () => {
    expect(validateIcu('{count, plural, one {# item} other')).toBe(false)
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `pnpm --filter @localize-infra/eval exec vitest run src/deterministic/icu`
Expected: FAIL — `Cannot find module './icu.js'`

- [ ] **Step 7: Write `packages/eval/src/deterministic/icu.ts`**

```ts
import { parse } from '@formatjs/icu-messageformat-parser'

const ICU_CONTROL_PATTERN = /\{[a-zA-Z0-9_]+,\s*(plural|select|selectordinal),/

export function isIcuMessage(text: string): boolean {
  return ICU_CONTROL_PATTERN.test(text)
}

export function validateIcu(text: string): boolean {
  try {
    parse(text)
    return true
  } catch {
    return false
  }
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `pnpm --filter @localize-infra/eval exec vitest run src/deterministic/icu`
Expected: PASS — 4 tests passing

- [ ] **Step 9: Write the failing test `packages/eval/src/deterministic/plurals.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { expectedPluralCategories, pluralCategoriesCorrect } from './plurals.js'

describe('expectedPluralCategories', () => {
  it('returns 2 categories for German', () => {
    expect(expectedPluralCategories('de')).toEqual(['one', 'other'])
  })

  it('returns 1 category for Japanese', () => {
    expect(expectedPluralCategories('ja')).toEqual(['other'])
  })

  it('returns 6 categories for Arabic', () => {
    expect(expectedPluralCategories('ar')).toEqual(['zero', 'one', 'two', 'few', 'many', 'other'])
  })
})

describe('pluralCategoriesCorrect', () => {
  it('accepts a German plural message using exactly one and other', () => {
    expect(pluralCategoriesCorrect('{count, plural, one {# Element} other {# Elemente}}', 'de')).toBe(true)
  })

  it('rejects a message missing the mandatory other category', () => {
    expect(pluralCategoriesCorrect('{count, plural, one {# Element}}', 'de')).toBe(false)
  })

  it('rejects a message using a category not valid for the locale', () => {
    expect(pluralCategoriesCorrect('{count, plural, one {# Element} few {# Elemente} other {# Elemente}}', 'de')).toBe(false)
  })

  it('accepts a full 6-category Arabic plural message', () => {
    const msg =
      '{count, plural, zero {# عنصر} one {# عنصر} two {# عنصران} few {# عناصر} many {# عنصرًا} other {# عنصر}}'
    expect(pluralCategoriesCorrect(msg, 'ar')).toBe(true)
  })

  it('accepts explicit-value arms like =0 alongside named categories', () => {
    expect(pluralCategoriesCorrect('{count, plural, =0 {none} one {# item} other {# items}}', 'en')).toBe(true)
  })
})
```

- [ ] **Step 10: Run test to verify it fails**

Run: `pnpm --filter @localize-infra/eval exec vitest run src/deterministic/plurals`
Expected: FAIL — `Cannot find module './plurals.js'`

- [ ] **Step 11: Write `packages/eval/src/deterministic/plurals.ts`**

```ts
import { parse, TYPE, type MessageFormatElement } from '@formatjs/icu-messageformat-parser'

export function expectedPluralCategories(locale: string): string[] {
  return new Intl.PluralRules(locale).resolvedOptions().pluralCategories
}

function findPluralArms(ast: MessageFormatElement[]): string[] {
  const arms: string[] = []
  for (const node of ast) {
    if (node.type === TYPE.plural || node.type === TYPE.select) {
      for (const [key, option] of Object.entries(node.options)) {
        arms.push(key)
        arms.push(...findPluralArms(option.value))
      }
    } else if ('children' in node && node.children) {
      arms.push(...findPluralArms(node.children))
    }
  }
  return arms
}

export function pluralCategoriesCorrect(icuText: string, locale: string): boolean {
  const ast = parse(icuText)
  const arms = findPluralArms(ast)
  const namedArms = new Set(arms.filter((arm) => !arm.startsWith('=')))
  if (!namedArms.has('other')) return false
  const expected = new Set(expectedPluralCategories(locale))
  for (const arm of namedArms) {
    if (!expected.has(arm)) return false
  }
  return true
}
```

- [ ] **Step 12: Run test to verify it passes**

Run: `pnpm --filter @localize-infra/eval exec vitest run src/deterministic/plurals`
Expected: PASS — 8 tests passing. If `@formatjs/icu-messageformat-parser`'s `MessageFormatElement` plural node shape differs from `{ options: Record<string, { value: MessageFormatElement[] }> }` assumed here, this step's failure will show a real type or runtime error — adjust `findPluralArms` to match the actual AST and re-run.

- [ ] **Step 13: Write the failing test `packages/eval/src/deterministic/length.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { lengthOverflow } from './length.js'

describe('lengthOverflow', () => {
  it('is false when there is no length constraint', () => {
    expect(lengthOverflow('a very long translated string indeed', null)).toBe(false)
  })

  it('is false when the translation fits within the constraint', () => {
    expect(lengthOverflow('short', 10)).toBe(false)
  })

  it('is true when the translation exceeds the constraint', () => {
    expect(lengthOverflow('this translation is too long', 10)).toBe(true)
  })
})
```

- [ ] **Step 14: Run test to verify it fails**

Run: `pnpm --filter @localize-infra/eval exec vitest run src/deterministic/length`
Expected: FAIL — `Cannot find module './length.js'`

- [ ] **Step 15: Write `packages/eval/src/deterministic/length.ts`**

```ts
export function lengthOverflow(translated: string, maxLength: number | null): boolean {
  if (maxLength === null) return false
  return translated.length > maxLength
}
```

- [ ] **Step 16: Run test to verify it passes**

Run: `pnpm --filter @localize-infra/eval exec vitest run src/deterministic/length`
Expected: PASS — 3 tests passing

- [ ] **Step 17: Write the failing test `packages/eval/src/deterministic/glossary.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import type { GlossaryEntry } from '@localize-infra/schemas'
import { checkGlossaryConsistency } from './glossary.js'

const glossary: GlossaryEntry[] = [{ term: 'GitHub', translations: { de: 'GitHub' } }]

describe('checkGlossaryConsistency', () => {
  it('marks a term respected when the source contains it and the translation keeps it verbatim', () => {
    expect(checkGlossaryConsistency('Sign in with GitHub', 'Mit GitHub anmelden', 'de', glossary)).toEqual([
      { term: 'GitHub', respected: true },
    ])
  })

  it('marks a term unrespected when the translation drops it', () => {
    expect(checkGlossaryConsistency('Sign in with GitHub', 'Anmelden', 'de', glossary)).toEqual([
      { term: 'GitHub', respected: false },
    ])
  })

  it('ignores a glossary term absent from the source text', () => {
    expect(checkGlossaryConsistency('Sign in', 'Anmelden', 'de', glossary)).toEqual([])
  })

  it('ignores a glossary term with no known translation for the locale', () => {
    expect(checkGlossaryConsistency('Sign in with GitHub', 'GitHubでログイン', 'ja', glossary)).toEqual([])
  })
})
```

- [ ] **Step 18: Run test to verify it fails**

Run: `pnpm --filter @localize-infra/eval exec vitest run src/deterministic/glossary`
Expected: FAIL — `Cannot find module './glossary.js'`

- [ ] **Step 19: Write `packages/eval/src/deterministic/glossary.ts`**

```ts
import type { GlossaryEntry } from '@localize-infra/schemas'

export interface GlossaryHit {
  term: string
  respected: boolean
}

export function checkGlossaryConsistency(
  sourceText: string,
  translatedText: string,
  locale: string,
  glossary: GlossaryEntry[],
): GlossaryHit[] {
  const hits: GlossaryHit[] = []
  for (const entry of glossary) {
    if (!sourceText.includes(entry.term)) continue
    const expected = entry.translations[locale]
    if (!expected) continue
    hits.push({ term: entry.term, respected: translatedText.includes(expected) })
  }
  return hits
}
```

- [ ] **Step 20: Run test to verify it passes**

Run: `pnpm --filter @localize-infra/eval exec vitest run src/deterministic/glossary`
Expected: PASS — 4 tests passing

- [ ] **Step 21: Write the failing test `packages/eval/src/deterministic/score.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import type { CorpusEntry, GlossaryEntry, TranslationResult } from '@localize-infra/schemas'
import { scoreTranslation } from './score.js'

const entry: CorpusEntry = {
  id: 'x',
  sourceProject: 'excalidraw',
  sourceLicense: 'MIT',
  sourceRepoUrl: 'https://github.com/excalidraw/excalidraw',
  sourceCommit: '786ab266ff3a9cfffaed16804cf9132b44bc08ae',
  filePath: 'en.json',
  surroundingCode: '',
  componentName: null,
  icuStructure: null,
  sourceText: 'Delete {{count}} item(s) from GitHub?',
  targetLocale: 'de',
  humanReference: '{{count}} Element(e) von GitHub löschen?',
  maxLength: 60,
}

const glossary: GlossaryEntry[] = [{ term: 'GitHub', translations: { de: 'GitHub' } }]

function result(overrides: Partial<TranslationResult>): TranslationResult {
  return {
    corpusEntryId: 'x',
    condition: 'B',
    targetLocale: 'de',
    provider: 'anthropic',
    modelId: 'claude-sonnet-5',
    text: '{{count}} Element(e) von GitHub löschen?',
    error: null,
    ...overrides,
  }
}

describe('scoreTranslation', () => {
  it('scores a clean translation as fully passing with no plural/ICU applicable', () => {
    expect(scoreTranslation(entry, result({}), glossary)).toEqual({
      corpusEntryId: 'x',
      condition: 'B',
      placeholderIntact: true,
      icuValid: true,
      pluralCategoriesCorrect: null,
      lengthOverflow: false,
      glossaryHits: [{ term: 'GitHub', respected: true }],
    })
  })

  it('flags a dropped placeholder', () => {
    const score = scoreTranslation(entry, result({ text: 'Element von GitHub löschen?' }), glossary)
    expect(score.placeholderIntact).toBe(false)
  })

  it('flags a length overflow against the entry maxLength', () => {
    const score = scoreTranslation(entry, result({ text: '{{count}} '.repeat(20) + 'GitHub' }), glossary)
    expect(score.lengthOverflow).toBe(true)
  })
})
```

- [ ] **Step 22: Run test to verify it fails**

Run: `pnpm --filter @localize-infra/eval exec vitest run src/deterministic/score`
Expected: FAIL — `Cannot find module './score.js'`

- [ ] **Step 23: Write `packages/eval/src/deterministic/score.ts`**

```ts
import type { CorpusEntry, DeterministicScore, GlossaryEntry, TranslationResult } from '@localize-infra/schemas'
import { checkGlossaryConsistency } from './glossary.js'
import { isIcuMessage, validateIcu } from './icu.js'
import { lengthOverflow } from './length.js'
import { placeholdersIntact } from './placeholders.js'
import { pluralCategoriesCorrect } from './plurals.js'

export function scoreTranslation(
  entry: CorpusEntry,
  result: TranslationResult,
  glossary: GlossaryEntry[],
): DeterministicScore {
  const sourceIsIcu = isIcuMessage(entry.sourceText)

  return {
    corpusEntryId: entry.id,
    condition: result.condition,
    placeholderIntact: placeholdersIntact(entry.sourceText, result.text),
    icuValid: sourceIsIcu ? validateIcu(result.text) : true,
    pluralCategoriesCorrect: sourceIsIcu && validateIcu(result.text) ? pluralCategoriesCorrect(result.text, entry.targetLocale) : null,
    lengthOverflow: lengthOverflow(result.text, entry.maxLength),
    glossaryHits: checkGlossaryConsistency(entry.sourceText, result.text, entry.targetLocale, glossary),
  }
}
```

- [ ] **Step 24: Run test to verify it passes**

Run: `pnpm --filter @localize-infra/eval exec vitest run src/deterministic/score`
Expected: PASS — 3 tests passing

- [ ] **Step 25: Commit**

```bash
git add packages/eval/src/deterministic
git commit -m "feat(eval): add deterministic placeholder/ICU/plural/length/glossary checkers"
```

---

### Task 8: Condition A/B prompts and the `translate:run` pipeline

**Files:**
- Create: `packages/eval/src/conditions/prompts.ts`
- Test: `packages/eval/src/conditions/prompts.test.ts`
- Create: `packages/eval/src/conditions/translate.ts`
- Test: `packages/eval/src/conditions/translate.test.ts`

**Interfaces:**
- Consumes: `CorpusEntry`, `TranslationResult`, `GlossaryEntry` (Task 2), `Provider`, `pickProvider`, `getProvider`, `translate` (Task 3), `packages/eval/src/corpus/data/entries.json` and `glossary.json` (Task 6).
- Produces: `buildConditionAPrompt(entry): TranslateRequest`, `buildConditionBPrompt(entry, glossary): TranslateRequest`, `runTranslationPipeline(entries, glossary, providers): Promise<TranslationResult[]>` (dependency-injected providers for testing), `packages/eval/src/corpus/data/translations.json` (committed).

- [ ] **Step 1: Write the failing test `packages/eval/src/conditions/prompts.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import type { CorpusEntry, GlossaryEntry } from '@localize-infra/schemas'
import { buildConditionAPrompt, buildConditionBPrompt } from './prompts.js'

const entry: CorpusEntry = {
  id: 'x',
  sourceProject: 'excalidraw',
  sourceLicense: 'MIT',
  sourceRepoUrl: 'https://github.com/excalidraw/excalidraw',
  sourceCommit: '786ab266ff3a9cfffaed16804cf9132b44bc08ae',
  filePath: 'packages/excalidraw/locales/en.json',
  surroundingCode: '"paste": "Paste",\n"copy": "Copy"',
  componentName: 'labels',
  icuStructure: null,
  sourceText: 'Delete {{count}} item(s) from GitHub?',
  targetLocale: 'de',
  humanReference: 'ignored',
  maxLength: 60,
}

const glossary: GlossaryEntry[] = [{ term: 'GitHub', translations: { de: 'GitHub' } }]

describe('buildConditionAPrompt', () => {
  it('contains only the source text, target locale, and preservation instructions — no file/component/glossary context', () => {
    const req = buildConditionAPrompt(entry)
    expect(req.userPrompt).toBe('Delete {{count}} item(s) from GitHub?')
    expect(req.systemPrompt).toContain('de')
    expect(req.systemPrompt).not.toContain('labels')
    expect(req.systemPrompt).not.toContain('GitHub-Konto')
  })
})

describe('buildConditionBPrompt', () => {
  it('includes file path, component name, surrounding code, glossary, and length constraint', () => {
    const req = buildConditionBPrompt(entry, glossary)
    expect(req.systemPrompt).toContain('packages/excalidraw/locales/en.json')
    expect(req.systemPrompt).toContain('labels')
    expect(req.systemPrompt).toContain('"paste": "Paste"')
    expect(req.systemPrompt).toContain('GitHub -> GitHub')
    expect(req.systemPrompt).toContain('60')
    expect(req.userPrompt).toBe('Delete {{count}} item(s) from GitHub?')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @localize-infra/eval exec vitest run src/conditions/prompts`
Expected: FAIL — `Cannot find module './prompts.js'`

- [ ] **Step 3: Write `packages/eval/src/conditions/prompts.ts`**

```ts
import type { CorpusEntry, GlossaryEntry } from '@localize-infra/schemas'
import type { TranslateRequest } from '../router/types.js'

const BASE_INSTRUCTIONS =
  'You are a professional software localization translator. Preserve any placeholders or interpolation syntax exactly as they appear (e.g. %s, {{variable}}, {variable}, ICU plural/select blocks). Return only the translated string, with no explanation, quotes, or markdown.'

export function buildConditionAPrompt(entry: CorpusEntry): TranslateRequest {
  return {
    systemPrompt: `${BASE_INSTRUCTIONS} Translate the following UI string from English to locale "${entry.targetLocale}".`,
    userPrompt: entry.sourceText,
  }
}

export function buildConditionBPrompt(entry: CorpusEntry, glossary: GlossaryEntry[]): TranslateRequest {
  const relevantGlossary = glossary
    .filter((g) => entry.sourceText.includes(g.term) && g.translations[entry.targetLocale])
    .map((g) => `${g.term} -> ${g.translations[entry.targetLocale]}`)

  const contextLines = [
    `${BASE_INSTRUCTIONS} Translate the following UI string from English to locale "${entry.targetLocale}".`,
    `Source file: ${entry.filePath}`,
    entry.componentName ? `Component/module: ${entry.componentName}` : null,
    entry.surroundingCode ? `Surrounding code:\n${entry.surroundingCode}` : null,
    relevantGlossary.length > 0 ? `Glossary (use these exact translations for these terms):\n${relevantGlossary.join('\n')}` : null,
    entry.icuStructure ? `ICU message structure to preserve: ${entry.icuStructure}` : null,
    entry.maxLength ? `Length constraint: the translation must not exceed ${entry.maxLength} characters.` : null,
  ].filter((line): line is string => line !== null)

  return {
    systemPrompt: contextLines.join('\n'),
    userPrompt: entry.sourceText,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @localize-infra/eval exec vitest run src/conditions/prompts`
Expected: PASS — 2 tests passing

- [ ] **Step 5: Write the failing test `packages/eval/src/conditions/translate.test.ts`**

```ts
import { describe, expect, it, vi } from 'vitest'
import type { CorpusEntry, GlossaryEntry } from '@localize-infra/schemas'
import type { Provider } from '../router/types.js'
import { runTranslationPipeline } from './translate.js'

const entries: CorpusEntry[] = [
  {
    id: 'entry-a',
    sourceProject: 'excalidraw',
    sourceLicense: 'MIT',
    sourceRepoUrl: 'https://github.com/excalidraw/excalidraw',
    sourceCommit: '786ab266ff3a9cfffaed16804cf9132b44bc08ae',
    filePath: 'en.json',
    surroundingCode: '',
    componentName: null,
    icuStructure: null,
    sourceText: 'Paste',
    targetLocale: 'de',
    humanReference: 'Einfügen',
    maxLength: 20,
  },
]

const glossary: GlossaryEntry[] = []

function fakeProvider(name: 'anthropic' | 'openai'): Provider {
  return { name, translate: vi.fn(async () => `${name}-translation`) }
}

describe('runTranslationPipeline', () => {
  it('produces one TranslationResult per entry per condition (A and B)', async () => {
    const results = await runTranslationPipeline(entries, glossary, {
      anthropic: fakeProvider('anthropic'),
      openai: fakeProvider('openai'),
    })
    expect(results).toHaveLength(2)
    expect(results.map((r) => r.condition).sort()).toEqual(['A', 'B'])
    expect(results.every((r) => r.corpusEntryId === 'entry-a')).toBe(true)
    expect(results.every((r) => r.error === null)).toBe(true)
  })

  it('captures a provider error without throwing, leaving text empty', async () => {
    const failingProvider: Provider = {
      name: 'anthropic',
      translate: vi.fn(async () => {
        throw new Error('rate limited')
      }),
    }
    const results = await runTranslationPipeline(entries, glossary, {
      anthropic: failingProvider,
      openai: fakeProvider('openai'),
    })
    const failed = results.find((r) => r.provider === 'anthropic')
    expect(failed?.error).toBe('rate limited')
    expect(failed?.text).toBe('')
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `pnpm --filter @localize-infra/eval exec vitest run src/conditions/translate`
Expected: FAIL — `Cannot find module './translate.js'`

- [ ] **Step 7: Write `packages/eval/src/conditions/translate.ts`**

```ts
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { CorpusEntrySchema, GlossaryEntrySchema, type CorpusEntry, type GlossaryEntry, type TranslationResult } from '@localize-infra/schemas'
import { getProvider, pickProvider } from '../router/index.js'
import type { Provider } from '../router/types.js'
import { buildConditionAPrompt, buildConditionBPrompt } from './prompts.js'

const DATA_DIR = join(process.cwd(), 'src/corpus/data')
const ANTHROPIC_MODEL = process.env.EVAL_ANTHROPIC_MODEL ?? 'claude-sonnet-5'
const OPENAI_MODEL = process.env.EVAL_OPENAI_MODEL ?? 'gpt-4o'

interface Providers {
  anthropic: Provider
  openai: Provider
}

async function translateOne(
  entry: CorpusEntry,
  condition: 'A' | 'B',
  glossary: GlossaryEntry[],
  providers: Providers,
): Promise<TranslationResult> {
  const providerName = pickProvider(`${entry.id}-${condition}`)
  const provider = providers[providerName]
  const modelId = providerName === 'anthropic' ? ANTHROPIC_MODEL : OPENAI_MODEL
  const request = condition === 'A' ? buildConditionAPrompt(entry) : buildConditionBPrompt(entry, glossary)

  try {
    const text = await provider.translate(request, modelId)
    return { corpusEntryId: entry.id, condition, targetLocale: entry.targetLocale, provider: providerName, modelId, text, error: null }
  } catch (err) {
    return {
      corpusEntryId: entry.id,
      condition,
      targetLocale: entry.targetLocale,
      provider: providerName,
      modelId,
      text: '',
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function runTranslationPipeline(
  entries: CorpusEntry[],
  glossary: GlossaryEntry[],
  providers: Providers,
): Promise<TranslationResult[]> {
  const results: TranslationResult[] = []
  for (const entry of entries) {
    results.push(await translateOne(entry, 'A', glossary, providers))
    results.push(await translateOne(entry, 'B', glossary, providers))
  }
  return results
}

async function main(): Promise<void> {
  const entries = (JSON.parse(readFileSync(join(DATA_DIR, 'entries.json'), 'utf-8')) as unknown[]).map((e) =>
    CorpusEntrySchema.parse(e),
  )
  const glossary = (JSON.parse(readFileSync(join(DATA_DIR, 'glossary.json'), 'utf-8')) as unknown[]).map((g) =>
    GlossaryEntrySchema.parse(g),
  )
  const results = await runTranslationPipeline(entries, glossary, {
    anthropic: getProvider('anthropic'),
    openai: getProvider('openai'),
  })
  writeFileSync(join(DATA_DIR, 'translations.json'), JSON.stringify(results, null, 2))
  const failures = results.filter((r) => r.error !== null)
  console.log(`${results.length} translations written, ${failures.length} failed`)
}

if (process.argv[1] === new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')) {
  main()
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `pnpm --filter @localize-infra/eval exec vitest run src/conditions/translate`
Expected: PASS — 4 tests passing

- [ ] **Step 9: Run the pipeline against the live corpus and real APIs**

Run: `pnpm --filter @localize-infra/eval run translate:run`
Expected: reads `entries.json`/`glossary.json`, calls the live Anthropic and OpenAI APIs for every entry × condition, writes `packages/eval/src/corpus/data/translations.json`, and prints a summary line. This performs real, billed API calls — expect it to take several minutes for 300+ entries × 2 conditions. If either `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` is missing, `getProvider` throws immediately with a clear message naming the missing variable.

- [ ] **Step 10: Commit**

```bash
git add packages/eval/src/conditions packages/eval/src/corpus/data/translations.json
git commit -m "feat(eval): add condition A/B prompts and translate:run pipeline"
```

---

### Task 9: CI-enforced regression gate (≥99.5% placeholder/ICU integrity)

**Files:**
- Create: `packages/eval/src/regression/gate.test.ts`

**Interfaces:**
- Consumes: `scoreTranslation` (Task 7), committed `entries.json`/`glossary.json`/`translations.json` (Tasks 6, 8).
- Produces: nothing new — this is the test that turns the deterministic gate into a real CI check, run automatically by `.github/workflows/ci.yml` (Task 1) via `pnpm run test`.

- [ ] **Step 1: Write `packages/eval/src/regression/gate.test.ts`**

```ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CorpusEntrySchema, GlossaryEntrySchema, TranslationResultSchema, type CorpusEntry } from '@localize-infra/schemas'
import { scoreTranslation } from '../deterministic/score.js'

const DATA_DIR = join(process.cwd(), 'src/corpus/data')
const PLACEHOLDER_ICU_THRESHOLD = 0.995

const entries = (JSON.parse(readFileSync(join(DATA_DIR, 'entries.json'), 'utf-8')) as unknown[]).map((e) =>
  CorpusEntrySchema.parse(e),
)
const glossary = (JSON.parse(readFileSync(join(DATA_DIR, 'glossary.json'), 'utf-8')) as unknown[]).map((g) =>
  GlossaryEntrySchema.parse(g),
)
const translations = (JSON.parse(readFileSync(join(DATA_DIR, 'translations.json'), 'utf-8')) as unknown[]).map((t) =>
  TranslationResultSchema.parse(t),
)

const entriesById = new Map<string, CorpusEntry>(entries.map((e) => [e.id, e]))

describe('Sprint 0 exit gate: placeholder/ICU integrity on condition B', () => {
  it('meets or exceeds 99.5% across the full corpus', () => {
    const conditionB = translations.filter((t) => t.condition === 'B' && t.error === null)
    expect(conditionB.length).toBeGreaterThan(0)

    let intact = 0
    const failures: string[] = []
    for (const result of conditionB) {
      const entry = entriesById.get(result.corpusEntryId)
      if (!entry) continue
      const score = scoreTranslation(entry, result, glossary)
      const passed = score.placeholderIntact && score.icuValid
      if (passed) intact++
      else failures.push(`${entry.id}: source="${entry.sourceText}" translated="${result.text}"`)
    }

    const rate = intact / conditionB.length
    if (rate < PLACEHOLDER_ICU_THRESHOLD) {
      console.error(`Failures (${failures.length}):\n${failures.slice(0, 20).join('\n')}`)
    }
    expect(rate).toBeGreaterThanOrEqual(PLACEHOLDER_ICU_THRESHOLD)
  })
})
```

- [ ] **Step 2: Run the gate test against the real translations from Task 8**

Run: `pnpm --filter @localize-infra/eval exec vitest run src/regression/gate`
Expected: PASS if condition B held ≥99.5% placeholder/ICU integrity across the live corpus. If it FAILS, this is Sprint 0's actual invalidation signal for the deterministic half of the exit criteria (spec §6) — do not adjust the threshold; the printed failures list the specific entries to inspect (e.g. a systematically dropped `{{count}}` on a particular provider/locale combination), which is exactly the regression detail this gate exists to surface.

- [ ] **Step 3: Commit**

```bash
git add packages/eval/src/regression
git commit -m "test(eval): add CI-enforced 99.5% placeholder/ICU regression gate"
```

---

### Task 10: Blind human-comparison task generation and export

**Files:**
- Create: `packages/eval/src/human-eval/generate.ts`
- Test: `packages/eval/src/human-eval/generate.test.ts`
- Create: `packages/eval/src/human-eval/export.ts`
- Test: `packages/eval/src/human-eval/export.test.ts`
- Create: `packages/eval/src/human-eval/instructions.md`

**Interfaces:**
- Consumes: `CorpusEntry`, `TranslationResult`, `ComparisonTask` (Task 2/6/8).
- Produces: `generateComparisonTasks(entries: CorpusEntry[], translations: TranslationResult[], seedShuffle: (id: string) => boolean): ComparisonTask[]` — consumed by Task 11's report builder to look up `leftIsCondition`/`rightIsCondition` when scoring judgments. Writes `packages/eval/src/human-eval/export/tasks.json` and `tasks.csv`.

- [ ] **Step 1: Write the failing test `packages/eval/src/human-eval/generate.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import type { CorpusEntry, TranslationResult } from '@localize-infra/schemas'
import { generateComparisonTasks } from './generate.js'

const entry: CorpusEntry = {
  id: 'x',
  sourceProject: 'excalidraw',
  sourceLicense: 'MIT',
  sourceRepoUrl: 'https://github.com/excalidraw/excalidraw',
  sourceCommit: '786ab266ff3a9cfffaed16804cf9132b44bc08ae',
  filePath: 'en.json',
  surroundingCode: '',
  componentName: null,
  icuStructure: null,
  sourceText: 'Paste',
  targetLocale: 'de',
  humanReference: 'Einfügen',
  maxLength: 20,
}

function result(condition: 'A' | 'B', text: string): TranslationResult {
  return { corpusEntryId: 'x', condition, targetLocale: 'de', provider: 'anthropic', modelId: 'm', text, error: null }
}

describe('generateComparisonTasks', () => {
  it('produces one A_vs_C and one B_vs_C task per entry, hiding provenance behind leftIsCondition/rightIsCondition', () => {
    const tasks = generateComparisonTasks([entry], [result('A', 'A-text'), result('B', 'B-text')], () => false)
    expect(tasks).toHaveLength(2)
    const aVsC = tasks.find((t) => t.pairType === 'A_vs_C')!
    expect(new Set([aVsC.leftIsCondition, aVsC.rightIsCondition])).toEqual(new Set(['A', 'C']))
    expect(new Set([aVsC.left, aVsC.right])).toEqual(new Set(['A-text', 'Einfügen']))
  })

  it('swaps left/right when the shuffle function returns true, keeping provenance tracked correctly', () => {
    const tasks = generateComparisonTasks([entry], [result('A', 'A-text'), result('B', 'B-text')], () => true)
    const aVsC = tasks.find((t) => t.pairType === 'A_vs_C')!
    expect(aVsC.leftIsCondition).toBe('C')
    expect(aVsC.left).toBe('Einfügen')
    expect(aVsC.rightIsCondition).toBe('A')
    expect(aVsC.right).toBe('A-text')
  })

  it('skips a pair when the model translation for that condition errored out', () => {
    const errored: TranslationResult = { ...result('A', ''), error: 'timeout' }
    const tasks = generateComparisonTasks([entry], [errored, result('B', 'B-text')], () => false)
    expect(tasks.find((t) => t.pairType === 'A_vs_C')).toBeUndefined()
    expect(tasks.find((t) => t.pairType === 'B_vs_C')).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @localize-infra/eval exec vitest run src/human-eval/generate`
Expected: FAIL — `Cannot find module './generate.js'`

- [ ] **Step 3: Write `packages/eval/src/human-eval/generate.ts`**

```ts
import type { ComparisonTask, CorpusEntry, TranslationResult } from '@localize-infra/schemas'

function buildTask(
  entry: CorpusEntry,
  condition: 'A' | 'B',
  modelText: string,
  shouldSwap: boolean,
): ComparisonTask {
  const pairType = condition === 'A' ? 'A_vs_C' : 'B_vs_C'
  const [leftIsCondition, left, rightIsCondition, right] = shouldSwap
    ? (['C', entry.humanReference, condition, modelText] as const)
    : ([condition, modelText, 'C', entry.humanReference] as const)

  return {
    id: `${entry.id}-${pairType}`,
    corpusEntryId: entry.id,
    targetLocale: entry.targetLocale,
    pairType,
    left,
    right,
    leftIsCondition,
    rightIsCondition,
  }
}

export function generateComparisonTasks(
  entries: CorpusEntry[],
  translations: TranslationResult[],
  shouldSwap: (taskId: string) => boolean,
): ComparisonTask[] {
  const byEntryAndCondition = new Map<string, TranslationResult>()
  for (const t of translations) {
    if (t.error === null) byEntryAndCondition.set(`${t.corpusEntryId}-${t.condition}`, t)
  }

  const tasks: ComparisonTask[] = []
  for (const entry of entries) {
    for (const condition of ['A', 'B'] as const) {
      const translation = byEntryAndCondition.get(`${entry.id}-${condition}`)
      if (!translation) continue
      const taskId = `${entry.id}-${condition === 'A' ? 'A_vs_C' : 'B_vs_C'}`
      tasks.push(buildTask(entry, condition, translation.text, shouldSwap(taskId)))
    }
  }
  return tasks
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @localize-infra/eval exec vitest run src/human-eval/generate`
Expected: PASS — 3 tests passing

- [ ] **Step 5: Write the failing test `packages/eval/src/human-eval/export.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import type { ComparisonTask } from '@localize-infra/schemas'
import { tasksToCsv } from './export.js'

const tasks: ComparisonTask[] = [
  {
    id: 'x-A_vs_C',
    corpusEntryId: 'x',
    targetLocale: 'de',
    pairType: 'A_vs_C',
    left: 'A-text',
    right: 'Einfügen, mit "Komma"',
    leftIsCondition: 'A',
    rightIsCondition: 'C',
  },
]

describe('tasksToCsv', () => {
  it('produces a header row plus one quoted, comma-safe row per task, omitting provenance columns', () => {
    const csv = tasksToCsv(tasks)
    const lines = csv.trim().split('\n')
    expect(lines[0]).toBe('id,targetLocale,pairType,left,right')
    expect(lines[1]).toBe('x-A_vs_C,de,A_vs_C,A-text,"Einfügen, mit ""Komma"""')
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `pnpm --filter @localize-infra/eval exec vitest run src/human-eval/export`
Expected: FAIL — `Cannot find module './export.js'`

- [ ] **Step 7: Write `packages/eval/src/human-eval/export.ts`**

```ts
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { CorpusEntrySchema, TranslationResultSchema } from '@localize-infra/schemas'
import { generateComparisonTasks } from './generate.js'

const DATA_DIR = join(process.cwd(), 'src/corpus/data')
const EXPORT_DIR = join(process.cwd(), 'src/human-eval/export')

function csvField(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

export function tasksToCsv(tasks: { id: string; targetLocale: string; pairType: string; left: string; right: string }[]): string {
  const header = 'id,targetLocale,pairType,left,right'
  const rows = tasks.map((t) => `${t.id},${t.targetLocale},${t.pairType},${csvField(t.left)},${csvField(t.right)}`)
  return [header, ...rows].join('\n') + '\n'
}

function deterministicShuffle(taskId: string): boolean {
  let hash = 0
  for (const char of taskId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return hash % 2 === 0
}

function main(): void {
  const entries = (JSON.parse(readFileSync(join(DATA_DIR, 'entries.json'), 'utf-8')) as unknown[]).map((e) =>
    CorpusEntrySchema.parse(e),
  )
  const translations = (JSON.parse(readFileSync(join(DATA_DIR, 'translations.json'), 'utf-8')) as unknown[]).map((t) =>
    TranslationResultSchema.parse(t),
  )
  const tasks = generateComparisonTasks(entries, translations, deterministicShuffle)

  mkdirSync(EXPORT_DIR, { recursive: true })
  writeFileSync(join(EXPORT_DIR, 'tasks.json'), JSON.stringify(tasks, null, 2))
  writeFileSync(join(EXPORT_DIR, 'tasks.csv'), tasksToCsv(tasks))
  console.log(`${tasks.length} comparison tasks exported to ${EXPORT_DIR}`)
}

if (process.argv[1] === new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')) {
  main()
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `pnpm --filter @localize-infra/eval exec vitest run src/human-eval/export`
Expected: PASS — 1 test passing

- [ ] **Step 9: Write `packages/eval/src/human-eval/instructions.md`**

```md
# Instructions évaluateur — comparaison de traductions en aveugle

Vous allez comparer des paires de traductions pour une même chaîne source anglaise,
sans savoir laquelle vient d'un modèle et laquelle vient d'une traduction humaine
de référence. Ne cherchez pas à deviner — jugez uniquement la qualité.

## Pour chaque ligne du fichier `tasks.csv`

1. Lisez `left` et `right`.
2. Choisissez : `left` est meilleure, `right` est meilleure, ou `equivalent`.
3. Si l'une des deux comporte un défaut, indiquez au moins une étiquette parmi :
   `terminologie`, `registre`, `grammaire`, `troncature`, `placeholder_corrompu`, `contresens`.
4. Notes libres optionnelles.

## Rendu attendu

Un fichier `judgments.json`, un objet par tâche :

```json
{
  "taskId": "excalidraw-labels.paste-de-A_vs_C",
  "evaluatorId": "votre-identifiant",
  "preferred": "left",
  "errorTags": ["registre"],
  "notes": "Ton trop formel pour un bouton"
}
```

`taskId` doit correspondre exactement au champ `id` de `tasks.csv`/`tasks.json`.
`evaluatorId` est libre mais doit rester identique sur tous vos jugements.
```

- [ ] **Step 10: Generate the real export from the corpus and live translations**

Run: `pnpm --filter @localize-infra/eval run human-eval:generate`
Expected: writes `packages/eval/src/human-eval/export/tasks.json` and `tasks.csv`, prints the total task count.

- [ ] **Step 11: Commit**

```bash
git add packages/eval/src/human-eval/generate.ts packages/eval/src/human-eval/generate.test.ts packages/eval/src/human-eval/export.ts packages/eval/src/human-eval/export.test.ts packages/eval/src/human-eval/instructions.md packages/eval/src/human-eval/export/tasks.json packages/eval/src/human-eval/export/tasks.csv
git commit -m "feat(eval): generate blind human-comparison export (JSON+CSV+instructions)"
```

---

### Task 11: Judgment import and per-language report with the go/no-go gate

**Files:**
- Create: `packages/eval/src/human-eval/import.ts`
- Test: `packages/eval/src/human-eval/import.test.ts`
- Create: `packages/eval/src/report/gate.ts`
- Test: `packages/eval/src/report/gate.test.ts`
- Create: `packages/eval/src/report/build.ts`
- Test: `packages/eval/src/report/build.test.ts`

**Interfaces:**
- Consumes: `ComparisonJudgmentSchema`, `ComparisonTask` (Task 2/10).
- Produces: `parseJudgmentsFile(raw: string): ComparisonJudgment[]`, `computeGate(perLanguageResults: Map<string, { bPreferredOrEquivalentRate: number }>): { passed: boolean; passingLocales: string[] }`, `buildReport(tasks, judgments): { markdownByLocale: Map<string, string>; gate: ReturnType<typeof computeGate> }`.

- [ ] **Step 1: Write the failing test `packages/eval/src/human-eval/import.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { parseJudgmentsFile } from './import.js'

describe('parseJudgmentsFile', () => {
  it('parses a JSON array of judgments, validating each against the schema', () => {
    const raw = JSON.stringify([
      { taskId: 't1', evaluatorId: 'e1', preferred: 'left', errorTags: [], notes: null },
    ])
    expect(parseJudgmentsFile(raw)).toEqual([
      { taskId: 't1', evaluatorId: 'e1', preferred: 'left', errorTags: [], notes: null },
    ])
  })

  it('throws with a clear message when an entry has an invalid preferred value', () => {
    const raw = JSON.stringify([{ taskId: 't1', evaluatorId: 'e1', preferred: 'sideways', errorTags: [], notes: null }])
    expect(() => parseJudgmentsFile(raw)).toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @localize-infra/eval exec vitest run src/human-eval/import`
Expected: FAIL — `Cannot find module './import.js'`

- [ ] **Step 3: Write `packages/eval/src/human-eval/import.ts`**

```ts
import { ComparisonJudgmentSchema, type ComparisonJudgment } from '@localize-infra/schemas'

export function parseJudgmentsFile(raw: string): ComparisonJudgment[] {
  const parsed = JSON.parse(raw) as unknown[]
  return parsed.map((entry) => ComparisonJudgmentSchema.parse(entry))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @localize-infra/eval exec vitest run src/human-eval/import`
Expected: PASS — 2 tests passing

- [ ] **Step 5: Write the failing test `packages/eval/src/report/gate.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { computeGate } from './gate.js'

describe('computeGate', () => {
  it('passes when B is preferred-or-equivalent to C in at least 3 of 5 locales at the 50% threshold', () => {
    const perLocale = new Map([
      ['de', { bPreferredOrEquivalentRate: 0.6 }],
      ['ja', { bPreferredOrEquivalentRate: 0.55 }],
      ['es', { bPreferredOrEquivalentRate: 0.51 }],
      ['ar', { bPreferredOrEquivalentRate: 0.4 }],
      ['pt-BR', { bPreferredOrEquivalentRate: 0.3 }],
    ])
    const gate = computeGate(perLocale)
    expect(gate.passed).toBe(true)
    expect(gate.passingLocales).toEqual(['de', 'ja', 'es'])
  })

  it('fails when fewer than 3 of 5 locales clear the threshold', () => {
    const perLocale = new Map([
      ['de', { bPreferredOrEquivalentRate: 0.6 }],
      ['ja', { bPreferredOrEquivalentRate: 0.4 }],
      ['es', { bPreferredOrEquivalentRate: 0.3 }],
      ['ar', { bPreferredOrEquivalentRate: 0.2 }],
      ['pt-BR', { bPreferredOrEquivalentRate: 0.1 }],
    ])
    expect(computeGate(perLocale).passed).toBe(false)
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `pnpm --filter @localize-infra/eval exec vitest run src/report/gate`
Expected: FAIL — `Cannot find module './gate.js'`

- [ ] **Step 7: Write `packages/eval/src/report/gate.ts`**

```ts
const B_PREFERRED_OR_EQUIVALENT_THRESHOLD = 0.5
const MIN_PASSING_LOCALES = 3

export interface LocaleResult {
  bPreferredOrEquivalentRate: number
}

export function computeGate(perLocale: Map<string, LocaleResult>): { passed: boolean; passingLocales: string[] } {
  const passingLocales = [...perLocale.entries()]
    .filter(([, result]) => result.bPreferredOrEquivalentRate >= B_PREFERRED_OR_EQUIVALENT_THRESHOLD)
    .map(([locale]) => locale)
  return { passed: passingLocales.length >= MIN_PASSING_LOCALES, passingLocales }
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `pnpm --filter @localize-infra/eval exec vitest run src/report/gate`
Expected: PASS — 2 tests passing

- [ ] **Step 9: Write the failing test `packages/eval/src/report/build.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import type { ComparisonJudgment, ComparisonTask } from '@localize-infra/schemas'
import { buildReport } from './build.js'

const tasks: ComparisonTask[] = [
  {
    id: 't1',
    corpusEntryId: 'e1',
    targetLocale: 'de',
    pairType: 'B_vs_C',
    left: 'B-text',
    right: 'C-text',
    leftIsCondition: 'B',
    rightIsCondition: 'C',
  },
  {
    id: 't2',
    corpusEntryId: 'e2',
    targetLocale: 'de',
    pairType: 'B_vs_C',
    left: 'C-text',
    right: 'B-text',
    leftIsCondition: 'C',
    rightIsCondition: 'B',
  },
]

const judgments: ComparisonJudgment[] = [
  { taskId: 't1', evaluatorId: 'e1', preferred: 'left', errorTags: [], notes: null },
  { taskId: 't2', evaluatorId: 'e1', preferred: 'equivalent', errorTags: [], notes: null },
]

describe('buildReport', () => {
  it('resolves preferred left/right back to B/C using task provenance, and counts B-preferred-or-equivalent correctly', () => {
    const { markdownByLocale, gate } = buildReport(tasks, judgments)
    const deReport = markdownByLocale.get('de')!
    expect(deReport).toContain('B_vs_C')
    expect(deReport).toContain('2/2')
    expect(gate.passingLocales).toContain('de')
  })
})
```

- [ ] **Step 10: Run test to verify it fails**

Run: `pnpm --filter @localize-infra/eval exec vitest run src/report/build`
Expected: FAIL — `Cannot find module './build.js'`

- [ ] **Step 11: Write `packages/eval/src/report/build.ts`**

```ts
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ComparisonTaskSchema, type ComparisonJudgment, type ComparisonTask } from '@localize-infra/schemas'
import { parseJudgmentsFile } from '../human-eval/import.js'
import { computeGate, type LocaleResult } from './gate.js'

const EXPORT_DIR = join(process.cwd(), 'src/human-eval/export')
const REPORTS_DIR = join(process.cwd(), 'reports')

function resolvedPreference(task: ComparisonTask, judgment: ComparisonJudgment): 'B' | 'C' | 'equivalent' {
  if (judgment.preferred === 'equivalent') return 'equivalent'
  const condition = judgment.preferred === 'left' ? task.leftIsCondition : task.rightIsCondition
  return condition === 'B' ? 'B' : 'C'
}

export function buildReport(
  tasks: ComparisonTask[],
  judgments: ComparisonJudgment[],
): { markdownByLocale: Map<string, string>; gate: ReturnType<typeof computeGate> } {
  const tasksById = new Map(tasks.map((t) => [t.id, t]))
  const byLocale = new Map<string, { bWins: number; equivalent: number; cWins: number; total: number }>()

  for (const judgment of judgments) {
    const task = tasksById.get(judgment.taskId)
    if (!task || task.pairType !== 'B_vs_C') continue
    const locale = task.targetLocale
    const counts = byLocale.get(locale) ?? { bWins: 0, equivalent: 0, cWins: 0, total: 0 }
    const resolved = resolvedPreference(task, judgment)
    if (resolved === 'B') counts.bWins++
    else if (resolved === 'equivalent') counts.equivalent++
    else counts.cWins++
    counts.total++
    byLocale.set(locale, counts)
  }

  const gateInput = new Map<string, LocaleResult>()
  const markdownByLocale = new Map<string, string>()
  for (const [locale, counts] of byLocale) {
    const bPreferredOrEquivalent = counts.bWins + counts.equivalent
    const rate = counts.total > 0 ? bPreferredOrEquivalent / counts.total : 0
    gateInput.set(locale, { bPreferredOrEquivalentRate: rate })
    markdownByLocale.set(
      locale,
      [
        `# Rapport — ${locale}`,
        '',
        `B_vs_C : ${bPreferredOrEquivalent}/${counts.total} préféré-ou-équivalent (${(rate * 100).toFixed(1)}%)`,
        `- B préféré : ${counts.bWins}`,
        `- Équivalent : ${counts.equivalent}`,
        `- C (référence humaine) préféré : ${counts.cWins}`,
      ].join('\n'),
    )
  }

  return { markdownByLocale, gate: computeGate(gateInput) }
}

function main(): void {
  const tasks = (JSON.parse(readFileSync(join(EXPORT_DIR, 'tasks.json'), 'utf-8')) as unknown[]).map((t) =>
    ComparisonTaskSchema.parse(t),
  )
  const judgments = parseJudgmentsFile(readFileSync(join(EXPORT_DIR, 'judgments.json'), 'utf-8'))
  const { markdownByLocale, gate } = buildReport(tasks, judgments)

  mkdirSync(REPORTS_DIR, { recursive: true })
  for (const [locale, markdown] of markdownByLocale) {
    writeFileSync(join(REPORTS_DIR, `${locale}.md`), markdown)
  }
  console.log(`Gate ${gate.passed ? 'PASSED' : 'FAILED'} — passing locales: ${gate.passingLocales.join(', ') || 'none'}`)
}

if (process.argv[1] === new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')) {
  main()
}
```

- [ ] **Step 12: Run test to verify it passes**

Run: `pnpm --filter @localize-infra/eval exec vitest run src/report/build`
Expected: PASS — 1 test passing

- [ ] **Step 13: Commit**

```bash
git add packages/eval/src/human-eval/import.ts packages/eval/src/human-eval/import.test.ts packages/eval/src/report
git commit -m "feat(eval): add judgment import and per-locale report with go/no-go gate"
```

---

### Task 12: Extend corpus sources toward 300–500 entries and rebalance locale coverage

**Files:**
- Modify: `packages/eval/src/corpus/sources.ts`
- Modify: `packages/eval/src/corpus/README.md`

**Interfaces:**
- Consumes: `CorpusSource`, `JsonSource`, `PoSource` (Task 6) — no new types, this task only adds config entries and re-runs the existing pipeline.

Task 6's 3 pilot sources (excalidraw, gitea, zulip) already cover all 5 target locales, but likely fall short of 300–500 entries and are unevenly distributed (e.g. `pt-BR` only has 2 sources, `ar` only has 2). This task is a bounded, repeatable procedure — not open-ended source hunting.

- [ ] **Step 1: Run the corpus builder and record the current baseline**

Run: `pnpm --filter @localize-infra/eval run corpus:build`
Expected: prints total entries and the per-locale breakdown from Task 6 Step 6's `main()`. Record these numbers — they're the baseline this task must improve on.

- [ ] **Step 2: For each candidate project, verify its license and locale file layout before adding it**

For each candidate below, run:
```bash
gh api repos/<owner>/<repo> --jq '.license.spdx_id'
```
Only proceed if the result is `MIT`, `Apache-2.0`, `BSD-3-Clause`, or `MPL-2.0`. Then run:
```bash
gh api repos/<owner>/<repo>/contents/<candidate-locale-dir> --jq '.[].name'
```
to confirm which of `de`, `ja`, `es`, `ar`, `pt-BR` (or their file-locale variants, e.g. `de-DE`, `pt_BR`) actually have files present — do not assume from the project's reputation.

Candidates to check, in priority order (chosen to shore up the weakest locales, `ar` and `pt-BR`, first): `wekan/wekan` (MIT), `TryGhost/Ghost` (MIT), `syncthing/syncthing` (MPL-2.0), `coder/code-server` (MIT), `wallabag/wallabag` (MIT), `appwrite/appwrite` (BSD-3-Clause).

- [ ] **Step 3: For each project that passes Step 2 with at least 2 target locales present, add a `CorpusSource` entry**

Use the exact `JsonSource`/`PoSource` shape from Task 6 Step 1. Get the pinned commit with:
```bash
gh api repos/<owner>/<repo>/commits/<default-branch> --jq '.sha'
```
Add the entry to `CORPUS_SOURCES` in `packages/eval/src/corpus/sources.ts`.

- [ ] **Step 4: Re-run the corpus builder after each added source and check progress toward the target**

Run: `pnpm --filter @localize-infra/eval run corpus:build`
Expected: total entries increases; the per-locale breakdown shows `ar` and `pt-BR` counts rising. Stop adding sources once total entries is in the 300–500 range AND every locale has at least 2 contributing projects — whichever condition is reached last. If entries exceed 500, remove the least-diverse recently-added source (same locale coverage as an existing one) rather than truncating arbitrarily.

- [ ] **Step 5: Update `packages/eval/src/corpus/README.md`'s source table with the final project list, licenses, and locale coverage**

Follow the exact table format already in the file from Task 6 Step 7.

- [ ] **Step 6: Re-run the full pipeline end to end against the expanded corpus**

Run, in order:
```bash
pnpm --filter @localize-infra/eval run translate:run
pnpm --filter @localize-infra/eval exec vitest run src/regression/gate
pnpm --filter @localize-infra/eval run human-eval:generate
```
Expected: all three succeed; the regression gate test result (pass/fail against the 99.5% threshold) reflects the expanded, better-balanced corpus — this is the number that goes into the Sprint 0 exit report, not the Task 9 baseline.

- [ ] **Step 7: Commit**

```bash
git add packages/eval/src/corpus packages/eval/src/human-eval/export packages/eval/src/corpus/data
git commit -m "feat(eval): expand corpus sources for 300-500 entries and balanced locale coverage"
```

---

## What's still open after this plan

- Real human judgments: recruit the 15 native-speaker evaluators (spec §2, out of scope for Claude Code), hand them `packages/eval/src/human-eval/export/{tasks.csv,instructions.md}`, collect `judgments.json` per evaluator, concatenate into a single array at `packages/eval/src/human-eval/export/judgments.json`, then run `pnpm --filter @localize-infra/eval run report:build` (Task 11 — its `main()` reads and validates `judgments.json` via `parseJudgmentsFile` and writes the per-locale reports plus the gate result in one step) to get the real go/no-go gate result.
- Once M3 ships the Playwright capture engine, extend `buildConditionBPrompt` (Task 8) with a screenshot reference and re-run Tasks 8–9 to measure the marginal effect of visual context, per spec §3.
