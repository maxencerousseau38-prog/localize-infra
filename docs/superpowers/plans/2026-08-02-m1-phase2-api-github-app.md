# M1 Phase 2 — Translate API + GitHub App PR flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the real `npx → PR` flow from `docs/superpowers/specs/2026-08-02-m1-npx-to-pr-design.md`: a proprietary `apps/api` (Hono) exposing translation and PR-opening over HTTP, a proprietary `services/github-app` (Octokit) doing the actual GitHub work, and `packages/cli`'s `init` command extended to call both — producing a real, mergeable pull request. This plan reaches a genuine external blocker partway through (Task 6): opening a real PR requires a GitHub App the human partner must create through GitHub's UI. Everything up to that point is buildable and testable without it.

**Architecture — one refinement beyond the design spec:** the spec establishes `packages/cli` as a thin HTTP client against `apps/api` for translation (§2.2), to keep proprietary logic out of the open-source CLI. This plan extends that same principle to PR-opening: rather than `packages/cli` importing `services/github-app` directly (which would make an "open source" package depend on a proprietary one to even build), `apps/api` gains a second endpoint, `POST /v1/open-pr`, that internally calls into `services/github-app`. `packages/cli` talks to `apps/api` over HTTP for both translation and PR-opening; it never imports anything from `apps/api` or `services/github-app`. This keeps the open-core boundary consistent and keeps `packages/cli`/`packages/core` genuinely usable standalone (spec §3: "le cœur ouvert doit être utilisable seul").

**Tech Stack:** Hono + `@hono/node-server` (local dev server, per spec §2.2 — real Vercel deployment is a separate, later decision), `octokit` (the umbrella package: REST client + App auth), Zod (shared request/response contracts, added to `packages/schemas`), Vitest, npm workspaces.

## Global Constraints

- `apps/api` and `services/github-app` are proprietary: `"private": true`, no `"license": "MIT"` field (use `"license": "UNLICENSED"`), not published to npm. `packages/core` and `packages/cli` remain open source (MIT) and must not import anything from `apps/api` or `services/github-app`.
- `packages/cli` talks to `apps/api` only over HTTP (`fetch`), never via direct package import — this is the mechanism that enforces the open-core boundary, not just a convention.
- Every module that makes a real network call (Anthropic/OpenAI, Octokit/GitHub) must be dependency-injection-testable with a fake — no real network calls in any `vitest run`. Real calls only happen in explicit manual smoke-test steps, using the existing gitignored `.env` (`ANTHROPIC_API_KEY`) and ambient `OPENAI_API_KEY` from Sprint 0's setup.
- No translation payload may silently drop a string: if the model's response is missing a requested key, that's surfaced as `missingKeys` in the API response and the CLI prints it — never silently ignored (CLAUDE.md invariant #4; this is the same discipline M1 Phase 1's C1/C2 fixes established).
- TypeScript strict mode; Vitest only; Biome only; **npm workspaces** (`npm run <script> -w <package>` / `npm exec -w <package> -- <command>`, NOT `pnpm` — the repo migrated to npm after M1 Phase 1 shipped).
- No placeholders, TBDs, or vague steps.
- Task 6 is a genuine external blocker: creating a GitHub App requires a human to click through `github.com/settings/apps/new` (or approve the manifest flow) in a browser. No prior step in this plan should assume that's already done.

---

### Task 1: `apps/api` scaffold + reimplemented provider router

**Files:**
- Modify: `package.json` (add `apps/*`, `services/*` to `workspaces`)
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/vitest.config.ts`
- Create: `apps/api/src/router/types.ts`
- Create: `apps/api/src/router/anthropic.ts`
- Create: `apps/api/src/router/openai.ts`
- Create: `apps/api/src/router/index.ts`
- Test: `apps/api/src/router/index.test.ts`

**Interfaces:**
- Produces: `Provider { name: 'anthropic'|'openai'; translate(req: TranslateRequest, modelId: string): Promise<string> }`, `TranslateRequest { systemPrompt: string; userPrompt: string }`, `pickProvider(seed: string): 'anthropic'|'openai'`, `getProvider(name): Provider`, `translate(req, provider, modelId): Promise<string>` — consumed by Task 2's translate handler and Task 5's open-pr wiring is unaffected (only translation uses the model router).

This is a deliberate re-transcription of the same design `packages/eval/src/router` already proved out in Sprint 0 — reimplemented here because `apps/api` is proprietary and `packages/eval` is open source (spec §2.2). The API shapes (Anthropic Messages API, OpenAI Chat Completions) are already verified working from Sprint 0's real live runs.

- [ ] **Step 1: Update root `package.json`'s workspaces**

```json
"workspaces": ["packages/*", "apps/*", "services/*"],
```
(Edit the existing `"workspaces": ["packages/*"]` line — keep everything else in the file unchanged.)

- [ ] **Step 2: Write `apps/api/package.json`**

```json
{
  "name": "@localize-infra/api",
  "version": "0.1.0",
  "private": true,
  "license": "UNLICENSED",
  "type": "module",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "dev": "tsx watch src/index.ts"
  },
  "dependencies": {
    "@hono/node-server": "^1.13.0",
    "@localize-infra/schemas": "*",
    "hono": "^4.6.0"
  },
  "devDependencies": {
    "@types/node": "^22.9.0",
    "tsx": "^4.19.2",
    "typescript": "^5.6.3",
    "vitest": "^2.1.4"
  }
}
```

- [ ] **Step 3: Write `apps/api/tsconfig.json`**

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

- [ ] **Step 4: Write `apps/api/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { environment: 'node' },
})
```

- [ ] **Step 5: Write `apps/api/src/router/types.ts`**

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

- [ ] **Step 6: Write the failing test `apps/api/src/router/index.test.ts`**

```ts
import { describe, expect, it, vi } from 'vitest'
import { pickProvider, translate } from './index.js'
import type { Provider, TranslateRequest } from './types.js'

describe('pickProvider', () => {
  it('is deterministic for the same seed', () => {
    expect(pickProvider('de')).toBe(pickProvider('de'))
  })

  it('distributes across both providers over many seeds', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 50; i++) seen.add(pickProvider(`seed-${i}`))
    expect(seen).toEqual(new Set(['anthropic', 'openai']))
  })
})

describe('translate', () => {
  it('delegates to the given provider with the given modelId', async () => {
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

- [ ] **Step 7: Install workspace dependencies, then run the test to verify it fails**

`apps/api` is a brand-new workspace member. Run from the repo root:
```bash
npm install
npm exec -w @localize-infra/api -- vitest run src/router
```
Expected: install succeeds (links `@localize-infra/api`, installs `hono`/`@hono/node-server`/`vitest`); the test run FAILS with `Cannot find module './index.js'`.

- [ ] **Step 8: Write `apps/api/src/router/anthropic.ts`**

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
          max_tokens: 4096,
          system: req.systemPrompt,
          messages: [{ role: 'user', content: req.userPrompt }],
        }),
      })
      if (!response.ok) {
        throw new Error(`Anthropic API error ${response.status}: ${await response.text()}`)
      }
      const body = (await response.json()) as { content: { type: string; text: string }[] }
      const textBlock = body.content.find((block) => block.type === 'text')
      if (!textBlock || !textBlock.text.trim()) {
        throw new Error('Anthropic response had no usable text content block')
      }
      return textBlock.text.trim()
    },
  }
}
```

- [ ] **Step 9: Write `apps/api/src/router/openai.ts`**

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

- [ ] **Step 10: Write `apps/api/src/router/index.ts`**

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

- [ ] **Step 11: Run test to verify it passes**

Run: `npm exec -w @localize-infra/api -- vitest run src/router`
Expected: PASS — 3 tests passing

- [ ] **Step 12: Commit**

```bash
git add package.json apps/api package-lock.json
git commit -m "feat(api): scaffold app and add reimplemented Anthropic/OpenAI router"
```

---

### Task 2: Translation batch endpoint — prompt, parser, handler, route

**Files:**
- Create: `packages/schemas/src/translate-api.ts`
- Modify: `packages/schemas/src/index.ts` (export the new module)
- Test: `packages/schemas/src/translate-api.test.ts`
- Create: `apps/api/src/translate/prompt.ts`
- Create: `apps/api/src/translate/parse-response.ts`
- Create: `apps/api/src/translate/handler.ts`
- Create: `apps/api/src/translate/route.ts`
- Test: `apps/api/src/translate/prompt.test.ts`
- Test: `apps/api/src/translate/parse-response.test.ts`
- Test: `apps/api/src/translate/handler.test.ts`
- Test: `apps/api/src/translate/route.test.ts`
- Create: `apps/api/src/index.ts`

**Interfaces:**
- Consumes: `Provider`, `TranslateRequest`, `pickProvider` (Task 1).
- Produces: `TranslatableStringSchema`/`TranslatableString`, `TranslateBatchRequestSchema`/`TranslateBatchRequest`, `TranslatedStringSchema`/`TranslatedString`, `TranslateBatchResponseSchema`/`TranslateBatchResponse` (all from `@localize-infra/schemas`, consumed by Task 3's CLI client), `translateRouteHandler(body: unknown, providers: {anthropic,openai}, modelIds: {anthropic,openai}): Promise<{status: number; body: unknown}>` (consumed by Task 3's manual smoke test only — it's wired into the real Hono app in this task, not re-exported for reuse).

- [ ] **Step 1: Write the failing test `packages/schemas/src/translate-api.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import {
  TranslatableStringSchema,
  TranslateBatchRequestSchema,
  TranslateBatchResponseSchema,
  TranslatedStringSchema,
} from './translate-api.js'

describe('TranslatableStringSchema', () => {
  it('accepts a valid entry with a null componentName', () => {
    const entry = {
      key: 'src.App.welcome',
      text: 'Welcome',
      filePath: 'src/App.tsx',
      componentName: null,
      surroundingCode: '<h1>Welcome</h1>',
    }
    expect(TranslatableStringSchema.parse(entry)).toEqual(entry)
  })

  it('rejects an empty key', () => {
    expect(() =>
      TranslatableStringSchema.parse({
        key: '',
        text: 'x',
        filePath: 'a.tsx',
        componentName: null,
        surroundingCode: '',
      }),
    ).toThrow()
  })
})

describe('TranslateBatchRequestSchema', () => {
  it('requires at least one string', () => {
    expect(() => TranslateBatchRequestSchema.parse({ targetLocale: 'de', strings: [] })).toThrow()
  })

  it('accepts a valid batch request', () => {
    const request = {
      targetLocale: 'de',
      strings: [
        { key: 'a', text: 'Hello', filePath: 'a.tsx', componentName: null, surroundingCode: '' },
      ],
    }
    expect(TranslateBatchRequestSchema.parse(request)).toEqual(request)
  })
})

describe('TranslatedStringSchema and TranslateBatchResponseSchema', () => {
  it('allows an empty translations array alongside missingKeys', () => {
    const response = { translations: [], missingKeys: ['a', 'b'] }
    expect(TranslateBatchResponseSchema.parse(response)).toEqual(response)
  })

  it('accepts a translated string', () => {
    expect(TranslatedStringSchema.parse({ key: 'a', text: 'Hallo' })).toEqual({ key: 'a', text: 'Hallo' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm exec -w @localize-infra/schemas -- vitest run src/translate-api`
Expected: FAIL — `Cannot find module './translate-api.js'`

- [ ] **Step 3: Write `packages/schemas/src/translate-api.ts`**

```ts
import { z } from 'zod'

export const TranslatableStringSchema = z.object({
  key: z.string().min(1),
  text: z.string().min(1),
  filePath: z.string(),
  componentName: z.string().nullable(),
  surroundingCode: z.string(),
})
export type TranslatableString = z.infer<typeof TranslatableStringSchema>

export const TranslateBatchRequestSchema = z.object({
  targetLocale: z.string().min(1),
  strings: z.array(TranslatableStringSchema).min(1),
})
export type TranslateBatchRequest = z.infer<typeof TranslateBatchRequestSchema>

export const TranslatedStringSchema = z.object({
  key: z.string().min(1),
  text: z.string(),
})
export type TranslatedString = z.infer<typeof TranslatedStringSchema>

export const TranslateBatchResponseSchema = z.object({
  translations: z.array(TranslatedStringSchema),
  missingKeys: z.array(z.string()),
})
export type TranslateBatchResponse = z.infer<typeof TranslateBatchResponseSchema>
```

- [ ] **Step 4: Update `packages/schemas/src/index.ts`**

```ts
export * from './eval.js'
export * from './translate-api.js'
```

- [ ] **Step 5: Run test to verify it passes, then rebuild the package**

```bash
npm exec -w @localize-infra/schemas -- vitest run src/translate-api
npm run build -w @localize-infra/schemas
```
Expected: 5 tests pass; build succeeds (both `apps/api` and `packages/cli` will resolve `@localize-infra/schemas` through its built `dist/`, same pattern as `packages/core`/`packages/cli` in M1 Phase 1).

- [ ] **Step 6: Write the failing test `apps/api/src/translate/prompt.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import type { TranslateBatchRequest } from '@localize-infra/schemas'
import { buildBatchPrompt } from './prompt.js'

const request: TranslateBatchRequest = {
  targetLocale: 'de',
  strings: [
    { key: 'a', text: 'Welcome', filePath: 'src/App.tsx', componentName: 'App', surroundingCode: '<h1>Welcome</h1>' },
  ],
}

describe('buildBatchPrompt', () => {
  it('includes the target locale and preservation instructions in the system prompt', () => {
    const prompt = buildBatchPrompt(request)
    expect(prompt.systemPrompt).toContain('de')
    expect(prompt.systemPrompt.toLowerCase()).toContain('placeholder')
  })

  it('serializes the strings array (key, text, context) as the user prompt', () => {
    const prompt = buildBatchPrompt(request)
    const parsed = JSON.parse(prompt.userPrompt)
    expect(parsed).toEqual([
      { key: 'a', text: 'Welcome', filePath: 'src/App.tsx', componentName: 'App', surroundingCode: '<h1>Welcome</h1>' },
    ])
  })
})
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npm exec -w @localize-infra/api -- vitest run src/translate/prompt`
Expected: FAIL — `Cannot find module './prompt.js'`

- [ ] **Step 8: Write `apps/api/src/translate/prompt.ts`**

```ts
import type { TranslateBatchRequest } from '@localize-infra/schemas'
import type { TranslateRequest } from '../router/types.js'

const INSTRUCTIONS =
  'You are a professional software localization translator. Translate each UI string in the given JSON array from English to the target locale. Preserve any placeholders or interpolation syntax exactly as they appear (e.g. %s, {{variable}}, {variable}, ICU plural/select blocks). Use the file path, component name, and surrounding code as context for tone and terminology. Respond with ONLY a JSON array of objects, each with exactly "key" and "text" fields, one per input string, no markdown code fences, no explanation.'

export function buildBatchPrompt(request: TranslateBatchRequest): TranslateRequest {
  const items = request.strings.map((s) => ({
    key: s.key,
    text: s.text,
    filePath: s.filePath,
    componentName: s.componentName,
    surroundingCode: s.surroundingCode,
  }))
  return {
    systemPrompt: `${INSTRUCTIONS}\nTarget locale: ${request.targetLocale}`,
    userPrompt: JSON.stringify(items, null, 2),
  }
}
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npm exec -w @localize-infra/api -- vitest run src/translate/prompt`
Expected: PASS — 2 tests passing

- [ ] **Step 10: Write the failing test `apps/api/src/translate/parse-response.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { parseTranslationResponse } from './parse-response.js'

describe('parseTranslationResponse', () => {
  it('parses a clean JSON array response', () => {
    const raw = '[{"key":"a","text":"Hallo"},{"key":"b","text":"Welt"}]'
    expect(parseTranslationResponse(raw)).toEqual([
      { key: 'a', text: 'Hallo' },
      { key: 'b', text: 'Welt' },
    ])
  })

  it('extracts a JSON array wrapped in a markdown code fence', () => {
    const raw = '```json\n[{"key":"a","text":"Hallo"}]\n```'
    expect(parseTranslationResponse(raw)).toEqual([{ key: 'a', text: 'Hallo' }])
  })

  it('throws a clear error when no JSON array is present', () => {
    expect(() => parseTranslationResponse('Sorry, I cannot help with that.')).toThrow(
      'No JSON array found in model response',
    )
  })

  it('throws a clear error when an array item is missing key or text', () => {
    expect(() => parseTranslationResponse('[{"key":"a"}]')).toThrow('missing key or text')
  })
})
```

- [ ] **Step 11: Run test to verify it fails**

Run: `npm exec -w @localize-infra/api -- vitest run src/translate/parse-response`
Expected: FAIL — `Cannot find module './parse-response.js'`

- [ ] **Step 12: Write `apps/api/src/translate/parse-response.ts`**

```ts
import type { TranslatedString } from '@localize-infra/schemas'

function extractJsonArray(raw: string): string {
  const start = raw.indexOf('[')
  const end = raw.lastIndexOf(']')
  if (start === -1 || end === -1 || end < start) {
    throw new Error('No JSON array found in model response')
  }
  return raw.slice(start, end + 1)
}

export function parseTranslationResponse(raw: string): TranslatedString[] {
  const jsonText = extractJsonArray(raw)
  const parsed: unknown = JSON.parse(jsonText)
  if (!Array.isArray(parsed)) throw new Error('Model response was not a JSON array')

  return parsed.map((item, index) => {
    if (
      typeof item !== 'object' ||
      item === null ||
      typeof (item as Record<string, unknown>).key !== 'string' ||
      typeof (item as Record<string, unknown>).text !== 'string'
    ) {
      throw new Error(`Model response array item at index ${index} is missing key or text`)
    }
    const record = item as Record<string, unknown>
    return { key: record.key as string, text: record.text as string }
  })
}
```

- [ ] **Step 13: Run test to verify it passes**

Run: `npm exec -w @localize-infra/api -- vitest run src/translate/parse-response`
Expected: PASS — 4 tests passing

- [ ] **Step 14: Write the failing test `apps/api/src/translate/handler.test.ts`**

```ts
import { describe, expect, it, vi } from 'vitest'
import type { TranslateBatchRequest } from '@localize-infra/schemas'
import type { Provider } from '../router/types.js'
import { handleTranslateBatch } from './handler.js'

const request: TranslateBatchRequest = {
  targetLocale: 'de',
  strings: [
    { key: 'a', text: 'Welcome', filePath: 'x.tsx', componentName: null, surroundingCode: '' },
    { key: 'b', text: 'Cancel', filePath: 'x.tsx', componentName: null, surroundingCode: '' },
  ],
}

function fakeProvider(responseText: string): Provider {
  return { name: 'anthropic', translate: vi.fn(async () => responseText) }
}

describe('handleTranslateBatch', () => {
  it('returns translations for every requested key when the model responds completely', async () => {
    const provider = fakeProvider('[{"key":"a","text":"Willkommen"},{"key":"b","text":"Abbrechen"}]')
    const result = await handleTranslateBatch(request, provider, 'claude-sonnet-5')
    expect(result.translations).toEqual([
      { key: 'a', text: 'Willkommen' },
      { key: 'b', text: 'Abbrechen' },
    ])
    expect(result.missingKeys).toEqual([])
  })

  it('reports missingKeys for requested strings the model did not translate, without throwing', async () => {
    const provider = fakeProvider('[{"key":"a","text":"Willkommen"}]')
    const result = await handleTranslateBatch(request, provider, 'claude-sonnet-5')
    expect(result.translations).toEqual([{ key: 'a', text: 'Willkommen' }])
    expect(result.missingKeys).toEqual(['b'])
  })
})
```

- [ ] **Step 15: Run test to verify it fails**

Run: `npm exec -w @localize-infra/api -- vitest run src/translate/handler`
Expected: FAIL — `Cannot find module './handler.js'`

- [ ] **Step 16: Write `apps/api/src/translate/handler.ts`**

```ts
import type { TranslateBatchRequest, TranslateBatchResponse } from '@localize-infra/schemas'
import type { Provider } from '../router/types.js'
import { buildBatchPrompt } from './prompt.js'
import { parseTranslationResponse } from './parse-response.js'

export async function handleTranslateBatch(
  request: TranslateBatchRequest,
  provider: Provider,
  modelId: string,
): Promise<TranslateBatchResponse> {
  const prompt = buildBatchPrompt(request)
  const raw = await provider.translate(prompt, modelId)
  const translations = parseTranslationResponse(raw)
  const foundKeys = new Set(translations.map((t) => t.key))
  const missingKeys = request.strings.filter((s) => !foundKeys.has(s.key)).map((s) => s.key)
  return { translations, missingKeys }
}
```

- [ ] **Step 17: Run test to verify it passes**

Run: `npm exec -w @localize-infra/api -- vitest run src/translate/handler`
Expected: PASS — 2 tests passing

- [ ] **Step 18: Write the failing test `apps/api/src/translate/route.test.ts`**

```ts
import { describe, expect, it, vi } from 'vitest'
import type { Provider } from '../router/types.js'
import { translateRouteHandler } from './route.js'

function fakeProvider(name: 'anthropic' | 'openai', responseText: string): Provider {
  return { name, translate: vi.fn(async () => responseText) }
}

const providers = {
  anthropic: fakeProvider('anthropic', '[{"key":"a","text":"Willkommen"}]'),
  openai: fakeProvider('openai', '[{"key":"a","text":"Willkommen"}]'),
}
const modelIds = { anthropic: 'claude-sonnet-5', openai: 'gpt-4o' }

describe('translateRouteHandler', () => {
  it('returns 200 with translations for a valid request', async () => {
    const body = {
      targetLocale: 'de',
      strings: [{ key: 'a', text: 'Welcome', filePath: 'x.tsx', componentName: null, surroundingCode: '' }],
    }
    const result = await translateRouteHandler(body, providers, modelIds)
    expect(result.status).toBe(200)
    expect(result.body).toEqual({ translations: [{ key: 'a', text: 'Willkommen' }], missingKeys: [] })
  })

  it('returns 400 for a request body that fails schema validation', async () => {
    const result = await translateRouteHandler({ targetLocale: 'de', strings: [] }, providers, modelIds)
    expect(result.status).toBe(400)
  })

  it('returns 502 when the provider throws', async () => {
    const failingProviders = {
      anthropic: { name: 'anthropic' as const, translate: vi.fn(async () => { throw new Error('rate limited') }) },
      openai: providers.openai,
    }
    const body = {
      targetLocale: 'de',
      strings: [{ key: 'a', text: 'Welcome', filePath: 'x.tsx', componentName: null, surroundingCode: '' }],
    }
    // Force the 'de' seed to route to anthropic deterministically isn't guaranteed; instead
    // exercise both providers failing to make the test provider-independent.
    const bothFail = {
      anthropic: failingProviders.anthropic,
      openai: { name: 'openai' as const, translate: vi.fn(async () => { throw new Error('rate limited') }) },
    }
    const result = await translateRouteHandler(body, bothFail, modelIds)
    expect(result.status).toBe(502)
  })
})
```

- [ ] **Step 19: Run test to verify it fails**

Run: `npm exec -w @localize-infra/api -- vitest run src/translate/route`
Expected: FAIL — `Cannot find module './route.js'`

- [ ] **Step 20: Write `apps/api/src/translate/route.ts`**

```ts
import { TranslateBatchRequestSchema, TranslateBatchResponseSchema } from '@localize-infra/schemas'
import { pickProvider } from '../router/index.js'
import type { Provider } from '../router/types.js'
import { handleTranslateBatch } from './handler.js'

export interface Providers {
  anthropic: Provider
  openai: Provider
}

export interface ModelIds {
  anthropic: string
  openai: string
}

export async function translateRouteHandler(
  body: unknown,
  providers: Providers,
  modelIds: ModelIds,
): Promise<{ status: number; body: unknown }> {
  const parsed = TranslateBatchRequestSchema.safeParse(body)
  if (!parsed.success) {
    return { status: 400, body: { error: 'Invalid request body', details: parsed.error.flatten() } }
  }

  const providerName = pickProvider(parsed.data.targetLocale)
  const provider = providers[providerName]
  const modelId = modelIds[providerName]

  try {
    const result = await handleTranslateBatch(parsed.data, provider, modelId)
    return { status: 200, body: TranslateBatchResponseSchema.parse(result) }
  } catch (err) {
    return { status: 502, body: { error: err instanceof Error ? err.message : String(err) } }
  }
}
```

- [ ] **Step 21: Run test to verify it passes**

Run: `npm exec -w @localize-infra/api -- vitest run src/translate/route`
Expected: PASS — 3 tests passing

- [ ] **Step 22: Write `apps/api/src/index.ts`**

```ts
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { getProvider } from './router/index.js'
import { translateRouteHandler } from './translate/route.js'

const ANTHROPIC_MODEL = process.env.API_ANTHROPIC_MODEL ?? 'claude-sonnet-5'
const OPENAI_MODEL = process.env.API_OPENAI_MODEL ?? 'gpt-4o'
const PORT = Number(process.env.PORT ?? 8787)

export const app = new Hono()

app.post('/v1/translate', async (c) => {
  const body = await c.req.json().catch(() => null)
  const { status, body: responseBody } = await translateRouteHandler(
    body,
    { anthropic: getProvider('anthropic'), openai: getProvider('openai') },
    { anthropic: ANTHROPIC_MODEL, openai: OPENAI_MODEL },
  )
  return c.json(responseBody as Record<string, unknown>, status as 200 | 400 | 502)
})

app.get('/health', (c) => c.json({ ok: true }))

const invokedPath = process.argv[1]?.replace(/\\/g, '/')
const modulePath = new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
if (invokedPath === modulePath) {
  serve({ fetch: app.fetch, port: PORT })
  console.log(`apps/api listening on http://localhost:${PORT}`)
}
```

(The `import.meta.url`/`process.argv[1]` guard uses the Windows-safe form established across three separate bugs found in M1 Phase 1 — apply it as-is, don't use the naive `===` form.)

- [ ] **Step 23: Manually verify the live server against the real Anthropic API**

Source the Anthropic key the same way established since Sprint 0 (foreground, blocking — do not background this):
```bash
cd /c/Users/maxen/Projects/localize-infra
set -a && source .env && set +a
npm exec -w @localize-infra/api -- tsx src/index.ts &
API_PID=$!
sleep 2
curl -s -X POST http://localhost:8787/v1/translate \
  -H 'content-type: application/json' \
  -d '{"targetLocale":"de","strings":[{"key":"a","text":"Welcome","filePath":"src/App.tsx","componentName":"App","surroundingCode":"<h1>Welcome</h1>"}]}'
kill $API_PID
```
Expected: the `curl` response is a JSON object `{"translations":[{"key":"a","text":"<a real German translation>"}],"missingKeys":[]}`. If the model routed to OpenAI instead of Anthropic (`pickProvider('de')`'s hash could go either way) and `OPENAI_API_KEY` isn't valid for direct calls in this environment (a known state from Sprint 0), the request may fail — if so, temporarily hardcode `getProvider('anthropic')` for both entries in `src/index.ts` for this one manual check, confirm it works, then revert before committing (do not commit a hardcoded single-provider override — that's the same mistake flagged in Sprint 0 if left in place).

- [ ] **Step 24: Run the full package test suite and typecheck**

```bash
npm exec -w @localize-infra/schemas -- vitest run
npm exec -w @localize-infra/api -- vitest run
npm exec -w @localize-infra/schemas -- tsc -p tsconfig.json --noEmit
npm exec -w @localize-infra/api -- tsc -p tsconfig.json --noEmit
npm run lint
```
Expected: all clean.

- [ ] **Step 25: Commit**

```bash
git add packages/schemas/src/translate-api.ts packages/schemas/src/translate-api.test.ts packages/schemas/src/index.ts apps/api/src/translate apps/api/src/index.ts
git commit -m "feat(schemas,api): add translate-api contracts and the POST /v1/translate endpoint"
```

---

### Task 3: `packages/cli` translation client + extend `init`

**Files:**
- Create: `packages/cli/src/translate-client.ts`
- Test: `packages/cli/src/translate-client.test.ts`
- Modify: `packages/cli/src/commands/init.ts`
- Modify: `packages/cli/src/commands/init.test.ts`
- Modify: `packages/cli/src/index.ts`
- Modify: `packages/cli/package.json` (add `@localize-infra/schemas` dependency)

**Interfaces:**
- Consumes: `TranslateBatchRequestSchema`, `TranslateBatchResponseSchema`, `TranslatableString`, `TranslateBatchResponse` (Task 2, via `@localize-infra/schemas`).
- Produces: `translateBatch(apiUrl: string, targetLocale: string, strings: TranslatableString[]): Promise<TranslateBatchResponse>` and an extended `runInit(targetDir, options?: {force?, apiUrl?, locales?}): Promise<InitResult>` where `InitResult`'s success variant now includes per-locale results — consumed by Task 5's PR-opening wiring.

- [ ] **Step 1: Add `@localize-infra/schemas` to `packages/cli/package.json`'s dependencies**

```json
"dependencies": {
  "@localize-infra/core": "*",
  "@localize-infra/schemas": "*"
},
```
(Read the current file first — this replaces the existing single-line `"dependencies"` block with both entries; keep everything else unchanged.)

- [ ] **Step 2: Write the failing test `packages/cli/src/translate-client.test.ts`**

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TranslatableString } from '@localize-infra/schemas'
import { translateBatch } from './translate-client.js'

const strings: TranslatableString[] = [
  { key: 'a', text: 'Welcome', filePath: 'x.tsx', componentName: null, surroundingCode: '' },
]

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('translateBatch', () => {
  it('POSTs to <apiUrl>/v1/translate and returns the parsed response', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ translations: [{ key: 'a', text: 'Willkommen' }], missingKeys: [] }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await translateBatch('http://localhost:8787', 'de', strings)

    expect(result).toEqual({ translations: [{ key: 'a', text: 'Willkommen' }], missingKeys: [] })
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8787/v1/translate',
      expect.objectContaining({ method: 'POST' }),
    )
    const [, init] = fetchMock.mock.calls[0]
    expect(JSON.parse(init.body as string)).toEqual({ targetLocale: 'de', strings })
  })

  it('throws a clear error including the status and body when the API responds with an error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 502, text: async () => 'upstream provider failed' })),
    )
    await expect(translateBatch('http://localhost:8787', 'de', strings)).rejects.toThrow(
      'Translation API request failed (502): upstream provider failed',
    )
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm install && npm exec -w @localize-infra/cli -- vitest run src/translate-client`
Expected: install links the new `@localize-infra/schemas` dependency; test FAILS with `Cannot find module './translate-client.js'`.

- [ ] **Step 4: Write `packages/cli/src/translate-client.ts`**

```ts
import {
  TranslateBatchRequestSchema,
  TranslateBatchResponseSchema,
  type TranslatableString,
  type TranslateBatchResponse,
} from '@localize-infra/schemas'

export async function translateBatch(
  apiUrl: string,
  targetLocale: string,
  strings: TranslatableString[],
): Promise<TranslateBatchResponse> {
  const request = TranslateBatchRequestSchema.parse({ targetLocale, strings })
  const response = await fetch(`${apiUrl}/v1/translate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
  })
  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Translation API request failed (${response.status}): ${errorBody}`)
  }
  const json: unknown = await response.json()
  return TranslateBatchResponseSchema.parse(json)
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm exec -w @localize-infra/cli -- vitest run src/translate-client`
Expected: PASS — 2 tests passing

- [ ] **Step 6: Read the current `packages/cli/src/commands/init.ts` and `init.test.ts` in full before editing**

M1 Phase 1's final review added a `force` option and a dropped-keys guard — read the actual current file, don't guess at its structure from the earlier plan. You'll be extending `InitOptions`/`InitResult` and adding a translation loop after the existing `en.json` write.

- [ ] **Step 7: Write the new failing tests, appended to `packages/cli/src/commands/init.test.ts`**

```ts
describe('runInit with translation', () => {
  it('translates extracted strings into each requested locale and writes locales/<locale>.json', async () => {
    writeViteReactProject()
    // writeViteReactProject()'s fixture is `<h1>Welcome</h1>` in src/App.tsx, so keyFor()
    // deterministically produces this exact key (file-path stem + slugified text) — see
    // Task 2/keyFor in the M1 Phase 1 plan if this ever needs re-deriving.
    const extractedKey = 'src.App.welcome'
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ translations: [{ key: extractedKey, text: 'Willkommen' }], missingKeys: [] }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await runInit(dir, { apiUrl: 'http://localhost:8787', locales: ['de'] })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.locales).toEqual([{ locale: 'de', keysWritten: 1, missingKeys: [] }])
    }
    const deCatalog = JSON.parse(readFileSync(join(dir, 'locales', 'de.json'), 'utf-8'))
    expect(Object.values(deCatalog)).toContain('Willkommen')

    vi.unstubAllGlobals()
  })

  it('surfaces missingKeys per locale without failing the whole run', async () => {
    writeViteReactProject()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ translations: [], missingKeys: ['src.App.welcome'] }) })),
    )

    const result = await runInit(dir, { apiUrl: 'http://localhost:8787', locales: ['de'] })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.locales[0].missingKeys).toEqual(['src.App.welcome'])
    }

    vi.unstubAllGlobals()
  })

  it('defaults to the 5 target locales (de, ja, es, ar, pt-BR) when none are specified', async () => {
    writeViteReactProject()
    const calledLocales: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        calledLocales.push(JSON.parse(init.body as string).targetLocale)
        return { ok: true, json: async () => ({ translations: [], missingKeys: [] }) }
      }),
    )

    await runInit(dir, { apiUrl: 'http://localhost:8787' })

    expect(calledLocales).toEqual(['de', 'ja', 'es', 'ar', 'pt-BR'])
    vi.unstubAllGlobals()
  })
})
```

(These tests need `vi` imported from `vitest` in the test file's existing import line — add it if not already present.)

- [ ] **Step 8: Run tests to verify they fail**

Run: `npm exec -w @localize-infra/cli -- vitest run src/commands/init`
Expected: FAIL — `runInit` doesn't accept `apiUrl`/`locales` options yet, `result.locales` is `undefined`.

- [ ] **Step 9: Extend `packages/cli/src/commands/init.ts`**

Add to the top-level imports:
```ts
import { translateBatch } from '../translate-client.js'
```

Add these constants near the top of the file:
```ts
const DEFAULT_LOCALES = ['de', 'ja', 'es', 'ar', 'pt-BR']
const DEFAULT_API_URL = 'http://localhost:8787'
```

Extend the `InitOptions` interface (read the current one first — it already has `force?: boolean` from Phase 1) to also include:
```ts
apiUrl?: string
locales?: string[]
```

Extend the success variant of `InitResult` (read the current shape first) to also include:
```ts
locales: { locale: string; keysWritten: number; missingKeys: string[] }[]
```

After the existing logic that writes `locales/en.json` (the extraction + force-guard + `en` merge/write you already have), append:
```ts
const apiUrl = options?.apiUrl ?? DEFAULT_API_URL
const targetLocales = options?.locales ?? DEFAULT_LOCALES
const translatableStrings = extracted.map((e) => ({
  key: e.key,
  text: e.text,
  filePath: e.filePath,
  componentName: e.componentName,
  surroundingCode: e.surroundingCode,
}))

const localeResults: { locale: string; keysWritten: number; missingKeys: string[] }[] = []
for (const locale of targetLocales) {
  const { translations, missingKeys } = await translateBatch(apiUrl, locale, translatableStrings)
  const freshForLocale = buildKeyCatalog(translations)
  const merged = mergeLocaleFile(localesDir, locale, freshForLocale)
  writeLocaleFile(localesDir, locale, merged)
  localeResults.push({ locale, keysWritten: Object.keys(merged).length, missingKeys })
}
```
and include `locales: localeResults` in the final returned `{ ok: true, ... }` object (alongside the existing `framework`/`keysWritten` fields from Phase 1 — don't remove those).

- [ ] **Step 10: Run tests to verify they pass**

Run: `npm exec -w @localize-infra/cli -- vitest run src/commands/init`
Expected: PASS — all tests (the original Phase 1 tests plus the 3 new ones) passing.

- [ ] **Step 11: Extend `packages/cli/src/index.ts`'s CLI entrypoint**

Read the current file first (it already parses `--force` from Phase 1's final-review fix). Add parsing for `--api-url <url>` and `--locales <comma,separated,list>`, pass them through as `apiUrl`/`locales` in the options object given to `runInit`. Update the usage string to mention both new flags. After a successful run, also print each locale's result, e.g.:
```ts
for (const localeResult of result.locales) {
  const missingNote = localeResult.missingKeys.length > 0 ? ` (${localeResult.missingKeys.length} string(s) not translated: ${localeResult.missingKeys.join(', ')})` : ''
  console.log(`  ${localeResult.locale}: ${localeResult.keysWritten} key(s)${missingNote}`)
}
```

- [ ] **Step 12: Manually verify against a real local `apps/api` instance**

```bash
cd /c/Users/maxen/Projects/localize-infra
set -a && source .env && set +a
npm exec -w @localize-infra/api -- tsx src/index.ts &
API_PID=$!
sleep 2

mkdir -p /tmp/cli-translate-smoke/src
cd /tmp/cli-translate-smoke
cat > package.json <<'EOF'
{ "dependencies": { "react": "^18.0.0", "vite": "^5.0.0" } }
EOF
cat > src/App.tsx <<'EOF'
export function App() {
  return <h1>Welcome to the app</h1>
}
EOF
cd /c/Users/maxen/Projects/localize-infra
npm run build -w @localize-infra/core
npm run build -w @localize-infra/schemas
npm exec -w @localize-infra/cli -- tsx src/index.ts init /tmp/cli-translate-smoke --locales de,ja

kill $API_PID
cat /tmp/cli-translate-smoke/locales/de.json
cat /tmp/cli-translate-smoke/locales/ja.json
rm -rf /tmp/cli-translate-smoke
```
Expected: both `locales/de.json` and `locales/ja.json` contain real, plausible translations of "Welcome to the app" (German and Japanese respectively), with `missingKeys: []` implied by no warning being printed.

- [ ] **Step 13: Run the full test suite, typecheck, and lint**

```bash
npm exec -w @localize-infra/cli -- vitest run
npm exec -w @localize-infra/cli -- tsc -p tsconfig.json --noEmit
npm run lint
```
Expected: all clean.

- [ ] **Step 14: Commit**

```bash
git add packages/cli
git commit -m "feat(cli): call the translate API per locale and write real locale files"
```

---

### Task 4: `services/github-app` — Octokit PR-opening logic

**Files:**
- Create: `services/github-app/package.json`
- Create: `services/github-app/tsconfig.json`
- Create: `services/github-app/vitest.config.ts`
- Create: `services/github-app/src/client.ts`
- Create: `services/github-app/src/open-pr.ts`
- Test: `services/github-app/src/open-pr.test.ts`
- Create: `services/github-app/src/index.ts`

**Interfaces:**
- Produces: `GitHubAppConfig { appId: string; privateKey: string; installationId: number }`, `createGitHubAppClient(config: GitHubAppConfig): Promise<Octokit>`, `OpenPrRequest { owner: string; repo: string; baseBranch: string; headBranch: string; title: string; body: string; files: {path: string; content: string}[] }`, `OpenPrResult { prUrl: string; prNumber: number }`, `openTranslationPr(octokit: Octokit, request: OpenPrRequest): Promise<OpenPrResult>` — `openTranslationPr` consumed by Task 5's `apps/api` `/v1/open-pr` route.

This task carries real API-shape risk, same class as Task 2's model APIs and M1 Phase 1's `ts-morph` risk: the exact Octokit REST method names/response shapes below (`octokit.rest.git.getRef`, `createBlob`, `createTree`, `createCommit`, `updateRef`, `pulls.create`) are written from best understanding of the `@octokit/rest`/`octokit` package's documented API, not verified against a live install before this plan was written. Treat the RED→GREEN cycle as verification — see the note after Step 2.

- [ ] **Step 1: Write `services/github-app/package.json`**

```json
{
  "name": "@localize-infra/github-app",
  "version": "0.1.0",
  "private": true,
  "license": "UNLICENSED",
  "type": "module",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run"
  },
  "dependencies": {
    "octokit": "^4.0.2"
  },
  "devDependencies": {
    "@types/node": "^22.9.0",
    "typescript": "^5.6.3",
    "vitest": "^2.1.4"
  }
}
```

- [ ] **Step 2: Write `services/github-app/tsconfig.json`, `vitest.config.ts`**

`tsconfig.json`:
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

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { environment: 'node' },
})
```

- [ ] **Step 3: Install workspace dependencies**

```bash
npm install
```
Expected: `@localize-infra/github-app` linked, `octokit` installed. If `octokit@^4.0.2` fails to resolve, check what version npm reports as available and adjust the range, then re-run.

- [ ] **Step 4: Write `services/github-app/src/client.ts`**

```ts
import { App } from 'octokit'
import type { Octokit } from 'octokit'

export type { Octokit } from 'octokit'

export interface GitHubAppConfig {
  appId: string
  privateKey: string
  installationId: number
}

export async function createGitHubAppClient(config: GitHubAppConfig): Promise<Octokit> {
  const app = new App({ appId: config.appId, privateKey: config.privateKey })
  return app.getInstallationOctokit(config.installationId)
}
```

If `octokit`'s exported `App` class or its `getInstallationOctokit` method has a different name/shape than assumed, this is the expected place to discover it during the GREEN check for Step 6 below — inspect `node_modules/octokit/dist-types/index.d.ts` and adjust.

- [ ] **Step 5: Write the failing test `services/github-app/src/open-pr.test.ts`**

```ts
import { describe, expect, it, vi } from 'vitest'
import { openTranslationPr, type OpenPrRequest } from './open-pr.js'

function fakeOctokit(overrides: Record<string, unknown> = {}) {
  return {
    rest: {
      git: {
        getRef: vi.fn(async () => ({ data: { object: { sha: 'base-sha' } } })),
        createRef: vi.fn(async () => ({ data: {} })),
        createBlob: vi.fn(async ({ content }: { content: string }) => ({ data: { sha: `blob-${content.length}` } })),
        createTree: vi.fn(async () => ({ data: { sha: 'tree-sha' } })),
        createCommit: vi.fn(async () => ({ data: { sha: 'commit-sha' } })),
        updateRef: vi.fn(async () => ({ data: {} })),
      },
      pulls: {
        create: vi.fn(async () => ({ data: { html_url: 'https://github.com/o/r/pull/1', number: 1 } })),
      },
    },
    ...overrides,
  } as any
}

const request: OpenPrRequest = {
  owner: 'acme',
  repo: 'widgets',
  baseBranch: 'main',
  headBranch: 'localize-infra/add-translations',
  title: 'Add German translations',
  body: 'Automated translation PR',
  files: [{ path: 'locales/de.json', content: '{"a":"Hallo"}' }],
}

describe('openTranslationPr', () => {
  it('creates a branch from base, commits the given files, and opens a PR', async () => {
    const octokit = fakeOctokit()
    const result = await openTranslationPr(octokit, request)

    expect(octokit.rest.git.getRef).toHaveBeenCalledWith({ owner: 'acme', repo: 'widgets', ref: 'heads/main' })
    expect(octokit.rest.git.createRef).toHaveBeenCalledWith({
      owner: 'acme',
      repo: 'widgets',
      ref: 'refs/heads/localize-infra/add-translations',
      sha: 'base-sha',
    })
    expect(octokit.rest.git.createBlob).toHaveBeenCalledWith({
      owner: 'acme',
      repo: 'widgets',
      content: '{"a":"Hallo"}',
      encoding: 'utf-8',
    })
    expect(octokit.rest.pulls.create).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: 'acme',
        repo: 'widgets',
        title: 'Add German translations',
        head: 'localize-infra/add-translations',
        base: 'main',
      }),
    )
    expect(result).toEqual({ prUrl: 'https://github.com/o/r/pull/1', prNumber: 1 })
  })

  it('creates one blob per file and includes all of them in the tree', async () => {
    const octokit = fakeOctokit()
    const multiFileRequest: OpenPrRequest = {
      ...request,
      files: [
        { path: 'locales/de.json', content: '{"a":"Hallo"}' },
        { path: 'locales/ja.json', content: '{"a":"こんにちは"}' },
      ],
    }
    await openTranslationPr(octokit, multiFileRequest)
    expect(octokit.rest.git.createBlob).toHaveBeenCalledTimes(2)
    const treeCall = octokit.rest.git.createTree.mock.calls[0][0]
    expect(treeCall.tree).toHaveLength(2)
    expect(treeCall.tree.map((t: { path: string }) => t.path)).toEqual(['locales/de.json', 'locales/ja.json'])
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm exec -w @localize-infra/github-app -- vitest run src/open-pr`
Expected: FAIL — `Cannot find module './open-pr.js'`

- [ ] **Step 7: Write `services/github-app/src/open-pr.ts`**

```ts
import type { Octokit } from 'octokit'

export interface OpenPrRequest {
  owner: string
  repo: string
  baseBranch: string
  headBranch: string
  title: string
  body: string
  files: { path: string; content: string }[]
}

export interface OpenPrResult {
  prUrl: string
  prNumber: number
}

export async function openTranslationPr(octokit: Octokit, request: OpenPrRequest): Promise<OpenPrResult> {
  const { owner, repo, baseBranch, headBranch, title, body, files } = request

  const baseRef = await octokit.rest.git.getRef({ owner, repo, ref: `heads/${baseBranch}` })
  const baseSha = baseRef.data.object.sha

  await octokit.rest.git.createRef({ owner, repo, ref: `refs/heads/${headBranch}`, sha: baseSha })

  const blobs = await Promise.all(
    files.map(async (file) => {
      const blob = await octokit.rest.git.createBlob({ owner, repo, content: file.content, encoding: 'utf-8' })
      return { path: file.path, sha: blob.data.sha }
    }),
  )

  const tree = await octokit.rest.git.createTree({
    owner,
    repo,
    base_tree: baseSha,
    tree: blobs.map((blob) => ({ path: blob.path, mode: '100644' as const, type: 'blob' as const, sha: blob.sha })),
  })

  const commit = await octokit.rest.git.createCommit({
    owner,
    repo,
    message: title,
    tree: tree.data.sha,
    parents: [baseSha],
  })

  await octokit.rest.git.updateRef({ owner, repo, ref: `heads/${headBranch}`, sha: commit.data.sha })

  const pr = await octokit.rest.pulls.create({ owner, repo, title, body, head: headBranch, base: baseBranch })

  return { prUrl: pr.data.html_url, prNumber: pr.data.number }
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm exec -w @localize-infra/github-app -- vitest run src/open-pr`
Expected: PASS — 2 tests passing. If the real Octokit types reject a field name (e.g. `base_tree` vs `baseTree`, or `mode`/`type` needing to be more specifically typed), this is the expected place to adjust — check `node_modules/octokit/dist-types/**` for the real `createTree`/`createCommit` parameter shapes and fix the call sites, keeping `openTranslationPr`'s own exported signature unchanged.

- [ ] **Step 9: Write `services/github-app/src/index.ts`**

```ts
export * from './client.js'
export * from './open-pr.js'
```

- [ ] **Step 10: Run the full package test suite, typecheck, lint**

```bash
npm exec -w @localize-infra/github-app -- vitest run
npm exec -w @localize-infra/github-app -- tsc -p tsconfig.json --noEmit
npm run lint
```
Expected: all clean.

- [ ] **Step 11: Commit**

```bash
git add package-lock.json services/github-app
git commit -m "feat(github-app): add Octokit multi-file-commit PR-opening logic"
```

---

### Task 5: `apps/api`'s `/v1/open-pr` endpoint + `packages/cli` wiring

**Files:**
- Modify: `apps/api/package.json` (add `@localize-infra/github-app` dependency)
- Create: `packages/schemas/src/open-pr-api.ts`
- Modify: `packages/schemas/src/index.ts`
- Test: `packages/schemas/src/open-pr-api.test.ts`
- Create: `apps/api/src/open-pr/route.ts`
- Test: `apps/api/src/open-pr/route.test.ts`
- Modify: `apps/api/src/index.ts`
- Create: `packages/cli/src/open-pr-client.ts`
- Test: `packages/cli/src/open-pr-client.test.ts`
- Modify: `packages/cli/src/commands/init.ts`
- Modify: `packages/cli/src/commands/init.test.ts`
- Modify: `packages/cli/src/index.ts`

**Interfaces:**
- Consumes: `openTranslationPr`, `createGitHubAppClient`, `GitHubAppConfig` (Task 4, `apps/api` only — `packages/cli` never imports these directly, per this plan's architecture note).
- Produces: `OpenPrApiRequestSchema`/`OpenPrApiRequest`, `OpenPrApiResponseSchema`/`OpenPrApiResponse` (schemas), `openPrRouteHandler(body: unknown, config: GitHubAppConfig | null): Promise<{status: number; body: unknown}>`, `requestPr(apiUrl: string, request: OpenPrApiRequest): Promise<OpenPrApiResponse>` (CLI client) — completing `runInit`'s orchestration.

- [ ] **Step 1: Write the failing test `packages/schemas/src/open-pr-api.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { OpenPrApiRequestSchema, OpenPrApiResponseSchema } from './open-pr-api.js'

describe('OpenPrApiRequestSchema', () => {
  it('accepts a valid request', () => {
    const request = {
      owner: 'acme',
      repo: 'widgets',
      baseBranch: 'main',
      title: 'Add translations',
      body: 'Automated',
      files: [{ path: 'locales/de.json', content: '{}' }],
    }
    expect(OpenPrApiRequestSchema.parse(request)).toEqual(request)
  })

  it('requires at least one file', () => {
    expect(() =>
      OpenPrApiRequestSchema.parse({ owner: 'a', repo: 'b', baseBranch: 'main', title: 't', body: 'b', files: [] }),
    ).toThrow()
  })
})

describe('OpenPrApiResponseSchema', () => {
  it('accepts a valid response', () => {
    const response = { prUrl: 'https://github.com/a/b/pull/1', prNumber: 1 }
    expect(OpenPrApiResponseSchema.parse(response)).toEqual(response)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm exec -w @localize-infra/schemas -- vitest run src/open-pr-api`
Expected: FAIL — `Cannot find module './open-pr-api.js'`

- [ ] **Step 3: Write `packages/schemas/src/open-pr-api.ts`**

```ts
import { z } from 'zod'

export const OpenPrFileSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
})

export const OpenPrApiRequestSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  baseBranch: z.string().min(1),
  title: z.string().min(1),
  body: z.string(),
  files: z.array(OpenPrFileSchema).min(1),
})
export type OpenPrApiRequest = z.infer<typeof OpenPrApiRequestSchema>

export const OpenPrApiResponseSchema = z.object({
  prUrl: z.string().url(),
  prNumber: z.number().int().positive(),
})
export type OpenPrApiResponse = z.infer<typeof OpenPrApiResponseSchema>
```

- [ ] **Step 4: Update `packages/schemas/src/index.ts`**

```ts
export * from './eval.js'
export * from './open-pr-api.js'
export * from './translate-api.js'
```

- [ ] **Step 5: Run test to verify it passes, rebuild**

```bash
npm exec -w @localize-infra/schemas -- vitest run src/open-pr-api
npm run build -w @localize-infra/schemas
```
Expected: 3 tests pass; build succeeds.

- [ ] **Step 6: Add `@localize-infra/github-app` to `apps/api/package.json`'s dependencies**

```json
"dependencies": {
  "@hono/node-server": "^1.13.0",
  "@localize-infra/github-app": "*",
  "@localize-infra/schemas": "*",
  "hono": "^4.6.0"
},
```

- [ ] **Step 7: Write the failing test `apps/api/src/open-pr/route.test.ts`**

Dependency-injection, matching `translateRouteHandler`'s `providers` parameter pattern from Task 2 — not `vi.spyOn` on the real ESM module, which is a less consistent and less reliable way to fake this dependency:

```ts
import { describe, expect, it, vi } from 'vitest'
import type { GitHubAppOperations } from './route.js'
import { openPrRouteHandler } from './route.js'

const validBody = {
  owner: 'acme',
  repo: 'widgets',
  baseBranch: 'main',
  title: 'Add translations',
  body: 'Automated',
  files: [{ path: 'locales/de.json', content: '{}' }],
}

const config = { appId: '123', privateKey: 'fake-key', installationId: 456 }

function fakeOps(overrides: Partial<GitHubAppOperations> = {}): GitHubAppOperations {
  return {
    createClient: vi.fn(async () => ({}) as never),
    openPr: vi.fn(async () => ({ prUrl: 'https://github.com/acme/widgets/pull/1', prNumber: 1 })),
    ...overrides,
  }
}

describe('openPrRouteHandler', () => {
  it('returns 501 when no GitHub App config is available', async () => {
    const result = await openPrRouteHandler(validBody, null, fakeOps())
    expect(result.status).toBe(501)
  })

  it('returns 400 for a request body that fails schema validation', async () => {
    const result = await openPrRouteHandler({ owner: 'a' }, config, fakeOps())
    expect(result.status).toBe(400)
  })

  it('returns 200 with the PR result when github-app succeeds', async () => {
    const result = await openPrRouteHandler(validBody, config, fakeOps())
    expect(result.status).toBe(200)
    expect(result.body).toEqual({ prUrl: 'https://github.com/acme/widgets/pull/1', prNumber: 1 })
  })

  it('returns 502 when github-app throws', async () => {
    const ops = fakeOps({
      openPr: vi.fn(async () => {
        throw new Error('branch already exists')
      }),
    })
    const result = await openPrRouteHandler(validBody, config, ops)
    expect(result.status).toBe(502)
  })
})
```

- [ ] **Step 8: Run test to verify it fails**

Run: `npm install && npm exec -w @localize-infra/api -- vitest run src/open-pr`
Expected: install links `@localize-infra/github-app` into `apps/api`; test FAILS with `Cannot find module './route.js'`.

- [ ] **Step 9: Write `apps/api/src/open-pr/route.ts`**

```ts
import type { GitHubAppConfig, Octokit, OpenPrResult, OpenPrRequest } from '@localize-infra/github-app'
import { OpenPrApiRequestSchema, OpenPrApiResponseSchema } from '@localize-infra/schemas'

const HEAD_BRANCH_PREFIX = 'localize-infra/add-translations'

export interface GitHubAppOperations {
  createClient: (config: GitHubAppConfig) => Promise<Octokit>
  openPr: (octokit: Octokit, request: OpenPrRequest) => Promise<OpenPrResult>
}

export async function openPrRouteHandler(
  body: unknown,
  config: GitHubAppConfig | null,
  ops: GitHubAppOperations,
): Promise<{ status: number; body: unknown }> {
  if (!config) {
    return {
      status: 501,
      body: { error: 'GitHub App is not configured (GITHUB_APP_ID/GITHUB_APP_PRIVATE_KEY/GITHUB_APP_INSTALLATION_ID missing)' },
    }
  }

  const parsed = OpenPrApiRequestSchema.safeParse(body)
  if (!parsed.success) {
    return { status: 400, body: { error: 'Invalid request body', details: parsed.error.flatten() } }
  }

  try {
    const octokit = await ops.createClient(config)
    const result = await ops.openPr(octokit, {
      owner: parsed.data.owner,
      repo: parsed.data.repo,
      baseBranch: parsed.data.baseBranch,
      headBranch: `${HEAD_BRANCH_PREFIX}-${Date.now()}`,
      title: parsed.data.title,
      body: parsed.data.body,
      files: parsed.data.files,
    })
    return { status: 200, body: OpenPrApiResponseSchema.parse(result) }
  } catch (err) {
    return { status: 502, body: { error: err instanceof Error ? err.message : String(err) } }
  }
}
```

Note: this imports only TYPES (`import type`) from `@localize-infra/github-app` — no runtime import, so `apps/api`'s only actual dependency edge on `services/github-app` is satisfied entirely through the `ops` parameter supplied by `index.ts` (Step 11). This keeps the route handler itself fully decoupled from the real Octokit implementation, same as `translateRouteHandler`'s relationship to the real provider implementations in Task 2.

- [ ] **Step 10: Run test to verify it passes**

Run: `npm exec -w @localize-infra/api -- vitest run src/open-pr`
Expected: PASS — 4 tests passing

- [ ] **Step 11: Wire the route into `apps/api/src/index.ts`**

Read the current file first. Add:
```ts
import { createGitHubAppClient, openTranslationPr } from '@localize-infra/github-app'
import { openPrRouteHandler, type GitHubAppOperations } from './open-pr/route.js'
```
a config-reading helper:
```ts
function readGitHubAppConfig(): { appId: string; privateKey: string; installationId: number } | null {
  const appId = process.env.GITHUB_APP_ID
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY
  const installationId = process.env.GITHUB_APP_INSTALLATION_ID
  if (!appId || !privateKey || !installationId) return null
  return { appId, privateKey, installationId: Number(installationId) }
}
```
the real operations object (this is the ONLY place in `apps/api` that touches the real `@localize-infra/github-app` implementation — `route.ts` itself only sees the `GitHubAppOperations` interface):
```ts
const githubAppOperations: GitHubAppOperations = {
  createClient: createGitHubAppClient,
  openPr: openTranslationPr,
}
```
and a new route:
```ts
app.post('/v1/open-pr', async (c) => {
  const body = await c.req.json().catch(() => null)
  const { status, body: responseBody } = await openPrRouteHandler(body, readGitHubAppConfig(), githubAppOperations)
  return c.json(responseBody as Record<string, unknown>, status as 200 | 400 | 501 | 502)
})
```

- [ ] **Step 12: Run the full `apps/api` suite, typecheck, lint**

```bash
npm exec -w @localize-infra/api -- vitest run
npm exec -w @localize-infra/api -- tsc -p tsconfig.json --noEmit
npm run lint
```
Expected: all clean.

- [ ] **Step 13: Commit the API side**

```bash
git add packages/schemas/src/open-pr-api.ts packages/schemas/src/open-pr-api.test.ts packages/schemas/src/index.ts apps/api
git commit -m "feat(schemas,api): add POST /v1/open-pr endpoint (returns 501 until a GitHub App is configured)"
```

- [ ] **Step 14: Write the failing test `packages/cli/src/open-pr-client.test.ts`**

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { requestPr } from './open-pr-client.js'

afterEach(() => {
  vi.unstubAllGlobals()
})

const request = {
  owner: 'acme',
  repo: 'widgets',
  baseBranch: 'main',
  title: 'Add translations',
  body: 'Automated',
  files: [{ path: 'locales/de.json', content: '{}' }],
}

describe('requestPr', () => {
  it('POSTs to <apiUrl>/v1/open-pr and returns the PR result', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ prUrl: 'https://github.com/acme/widgets/pull/1', prNumber: 1 }),
      })),
    )
    const result = await requestPr('http://localhost:8787', request)
    expect(result).toEqual({ prUrl: 'https://github.com/acme/widgets/pull/1', prNumber: 1 })
  })

  it('throws a clear error (including a hint about GITHUB_APP_* env vars) on a 501 response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 501, text: async () => 'GitHub App is not configured' })),
    )
    await expect(requestPr('http://localhost:8787', request)).rejects.toThrow('GitHub App is not configured')
  })
})
```

- [ ] **Step 15: Run test to verify it fails**

Run: `npm exec -w @localize-infra/cli -- vitest run src/open-pr-client`
Expected: FAIL — `Cannot find module './open-pr-client.js'`

- [ ] **Step 16: Write `packages/cli/src/open-pr-client.ts`**

```ts
import { OpenPrApiRequestSchema, OpenPrApiResponseSchema, type OpenPrApiRequest, type OpenPrApiResponse } from '@localize-infra/schemas'

export async function requestPr(apiUrl: string, request: OpenPrApiRequest): Promise<OpenPrApiResponse> {
  const body = OpenPrApiRequestSchema.parse(request)
  const response = await fetch(`${apiUrl}/v1/open-pr`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Open-PR API request failed (${response.status}): ${errorBody}`)
  }
  const json: unknown = await response.json()
  return OpenPrApiResponseSchema.parse(json)
}
```

- [ ] **Step 17: Run test to verify it passes**

Run: `npm exec -w @localize-infra/cli -- vitest run src/open-pr-client`
Expected: PASS — 2 tests passing

- [ ] **Step 18: Wire `requestPr` into `runInit`'s orchestration**

Read the current `packages/cli/src/commands/init.ts` in full (it now has the Task 3 translation loop). After the locale-translation loop, append PR-opening — but only if there's anything to commit (at least one locale actually wrote a file) and only if the target directory has git remote info to determine `owner`/`repo`. Add a `openPr?: boolean` field to `InitOptions` (default `false` for this task — actually opening a PR against a random directory is exactly the M1 exit-criterion behavior, but it must be opt-in until Task 6 unblocks real credentials; default `false` keeps `init`'s existing local-only tests passing unchanged and makes PR-opening an explicit, deliberate action).

```ts
if (options?.openPr) {
  const prResult = await requestPr(apiUrl, {
    owner: options.owner ?? '',
    repo: options.repo ?? '',
    baseBranch: options.baseBranch ?? 'main',
    title: `Add translations (${targetLocales.join(', ')})`,
    body: `Automated by \`localize-infra init\`. ${localeResults.map((r) => `${r.locale}: ${r.keysWritten} key(s)${r.missingKeys.length > 0 ? ` (${r.missingKeys.length} untranslated)` : ''}`).join('; ')}`,
    files: targetLocales.map((locale) => ({
      path: `${framework.localesDir}/${locale}.json`,
      // Read back what was just written, rather than recomputing a merge: mergeLocaleFile's
      // loop only walks the KEYS OF ITS `fresh` ARGUMENT, so calling it with an empty catalog
      // here would silently return `{}`, not the file's real contents. readLocaleFile reads
      // the actual bytes on disk that writeLocaleFile produced a few lines above.
      content: JSON.stringify(readLocaleFile(localesDir, locale), null, 2),
    })),
  })
  return { ok: true, framework: framework.name, keysWritten, locales: localeResults, pr: prResult }
}
```

(Add `owner?: string`, `repo?: string`, `baseBranch?: string` to `InitOptions`, and an optional `pr?: { prUrl: string; prNumber: number }` to `InitResult`'s success variant. Import `requestPr` from `../open-pr-client.js` at the top of the file, and add `readLocaleFile` to the existing `@localize-infra/core` import line alongside `buildKeyCatalog`/`detectFramework`/`extractFromProject`/`mergeLocaleFile`/`writeLocaleFile`.)

Add one test to `packages/cli/src/commands/init.test.ts` covering `openPr: true`: mock `fetch` to handle both the `/v1/translate` and `/v1/open-pr` calls (branch on the URL passed to the mock), assert `result.pr` is populated correctly, and assert `runInit` called without `openPr` (the existing tests) never hits the `/v1/open-pr` endpoint at all.

- [ ] **Step 19: Add `--open-pr`, `--owner`, `--repo`, `--base-branch` flags to `packages/cli/src/index.ts`**

Read the current file first. Parse these from argv the same way `--force`/`--api-url`/`--locales` were parsed in Task 3, thread them into the `runInit` options object, and print the PR URL on success if `result.pr` is present.

- [ ] **Step 20: Run the full `packages/cli` suite, typecheck, lint**

```bash
npm exec -w @localize-infra/cli -- vitest run
npm exec -w @localize-infra/cli -- tsc -p tsconfig.json --noEmit
npm run lint
```
Expected: all clean.

- [ ] **Step 21: Commit the CLI side**

```bash
git add packages/cli
git commit -m "feat(cli): wire --open-pr through to the open-pr API, completing the init orchestration"
```

---

### Task 6: STOP — real GitHub App required (human action)

**This task cannot be executed by an agent.** Per `docs/superpowers/specs/2026-08-02-m1-npx-to-pr-design.md` §2.3, creating a GitHub App requires a human to authenticate in a browser at `github.com/settings/apps/new` (or approve the manifest flow) — no API or CLI command can do this step.

**What the human partner needs to do:**
1. Create a GitHub App (any account is fine — a personal account is enough for this milestone's validation) with permissions: Repository contents (read & write), Pull requests (read & write).
2. Generate a private key for the app, download the `.pem` file.
3. Install the app on 3 throwaway fixture repos created under their own account (per spec §2.4 — never a real third-party repo without explicit consent), one per supported framework (Next.js, Vite+React, React Native), each seeded with a few hardcoded strings.
4. Provide: `GITHUB_APP_ID`, the private key content (for `GITHUB_APP_PRIVATE_KEY`), and the installation ID for each fixture repo.

**Once unblocked, the remaining validation work is:**
- Add the 3 credentials to the gitignored `.env` (same pattern established for `ANTHROPIC_API_KEY` since Sprint 0).
- Run `apps/api` locally with the real GitHub App config loaded.
- Run `npx @localize-infra/cli init --open-pr --owner <account> --repo <fixture-repo> --base-branch main` against each of the 3 fixture repos.
- Confirm each produces a real, mergeable PR in under 3 minutes (M1's actual exit criterion, spec §5) — check the PR diff is sane (correct locale files, no stray changes), and that CI (if the fixture repos have any) doesn't break.
- Write up the result (pass/fail per repo, timing) as a short completion note, mirroring how Sprint 0's exit criteria were reported.

This task has no TDD steps of its own — it's a validation checklist against infrastructure that doesn't exist until the human partner creates it.
