# @localize-infra/cli

The `localize-infra` command-line tool. In this phase (M1 Phase 1) it ships a
single command, `init`, which detects your project's framework, scans your
source files for hardcoded UI strings, and writes/updates
`locales/en.json`. This is a **local, dry-run extraction tool only** — there
is no translation step and no pull-request creation yet. That lands in a
future M1 Phase 2, which will also define how to send extracted strings
through a translation API.

## Building and running locally

This package depends on `@localize-infra/core`'s build output
(`packages/core/dist/`, which is gitignored and not checked in). Build core
first, then run the CLI directly with `tsx`:

```bash
npm run build -w @localize-infra/core
npm exec -w @localize-infra/cli -- tsx src/index.ts init <directory>
```

If you skip the core build step on a fresh clone, `@localize-infra/core`
will fail to resolve (`main` points at `./dist/index.js`) and both the CLI's
dev script and its tests will fail. CI doesn't hit this because
`turbo run test` has `dependsOn: ["^build"]`, which builds `core` before
`cli` automatically — but it isn't automatic when running things locally
package-by-package.

## Usage

```bash
localize-infra init [directory] [--force]
```

- `directory` — defaults to the current working directory.
- `--force` — by default, `init` refuses to overwrite an existing
  `locales/en.json` if doing so would drop keys that are no longer produced
  by the current extraction (e.g. a hand-maintained catalog, or source text
  that changed since the last run). Pass `--force` to proceed anyway and
  let those keys be removed.

## Supported frameworks

Framework detection lives in `packages/core`'s `detectFramework`. Currently
supported:

- Next.js
- Vite + React
- React Native

See `packages/core/src/detect/index.ts` for the exact detection signals and
source globs used per framework.

## Known extraction limits (v1)

These are honest boundaries of the current extractor, not a TODO list:

- Only JSX text content and a small attribute whitelist
  (`placeholder`, `alt`, `title`, `aria-label`) are scanned. Most other
  common attributes (`label`, `description`, etc.) aren't picked up yet.
- Strings inside JSX expressions — ternaries, template literals, `{someVar}`
  — are not extracted.
- **Known gap, not yet resolved:** a JSX element with embedded expressions,
  e.g. `<p>You have {count} messages</p>`, gets extracted as separate text
  fragments around the expression rather than as one placeholder-aware
  string. Translating those fragments independently would produce broken
  word order in some target languages. Fixing this requires redesigning the
  extraction data model to group a JSX element's full children into one
  ICU-aware string, and is deferred to when M1 Phase 2 designs the
  translation API payload contract — it is not addressed in this phase.
- Test, spec, and story files (`*.test.tsx`, `*.spec.tsx`, `*.stories.tsx`)
  are skipped so fixture/story text never pollutes the real catalog.
- Purely numeric/punctuation/currency strings (e.g. `42`, `$9.99`) and bare
  HTML entities (e.g. `&nbsp;`) are filtered out as noise, not real UI text.
