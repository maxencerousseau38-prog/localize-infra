# @localize-infra/core

The local half of `localize-infra`: framework detection, hardcoded-string
extraction, and locale-file merging. Everything in this package runs on your
machine and touches only the filesystem — no network calls, no provider keys.

```ts
import { detectFramework, extractFromProject, mergeLocaleFile } from '@localize-infra/core';

const framework = detectFramework(projectDir);        // Next.js | Vite + React | React Native | null
const strings = extractFromProject(projectDir, framework.sourceGlobs);
```

## What it detects

| Framework | Signal |
| --- | --- |
| Next.js | a `next` dependency, or a `next.config.{js,mjs,ts}` |
| Vite + React | a `react` dependency **and** either `vite` or a `vite.config.*` |
| React Native | a `react-native` dependency |

No match returns `null` rather than guessing.

## Extraction limits

These are current boundaries, not a roadmap. JSX text content and four
attributes (`placeholder`, `alt`, `title`, `aria-label`) are extracted; strings
already inside a `t()` / `translate()` / `i18n()` call are left alone.

**Known gap:** an element containing an expression —
`<p>You have {count} messages</p>` — is extracted as separate fragments around
the expression rather than one placeholder-aware string. Translating those
fragments independently produces wrong word order in languages that reorder the
sentence. Fixing it requires grouping an element's children into a single
ICU-aware string, which is a redesign of the extraction model and is not done.

Full documentation: https://github.com/maxencerousseau38-prog/localize-infra

MIT.
