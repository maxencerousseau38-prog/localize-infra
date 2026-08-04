# @localize-infra/cli

The `localize-infra` command-line tool. It ships a single command, `init`,
which runs the full pipeline end-to-end:

1. **Detect** your project's framework.
2. **Extract** hardcoded UI strings from your source files.
3. **Write** `locales/en.json` (the source-of-truth catalog).
4. **Translate** each extracted string into every requested target locale,
   by calling `apps/api`'s `/v1/translate` endpoint, and write
   `locales/<locale>.json` for each one.
5. **Optionally open a pull request** (`--open-pr`) containing the updated
   locale files, by calling `apps/api`'s `/v1/open-pr` endpoint, which in
   turn uses `services/github-app` to create the PR via a GitHub App
   installation.

Steps 4 and 5 talk to a running `apps/api` instance (see
`apps/api/README.md` for how to run it) — `init` does not call any LLM or
GitHub API directly itself.

## Data sent to `apps/api` during translation — please read

When the translation step runs, for every extracted string `init` sends its
**file path, its detected component name, and a snippet of the surrounding
source code** (in addition to the string's text) to `apps/api`.
`apps/api` forwards this to a **third-party LLM provider — Anthropic or
OpenAI — to produce the translation**. This is deliberate: the surrounding
code and file/component context measurably improve translation quality
(e.g. disambiguating a short string like "Close" as a button vs. a modal
title). It also means that context leaves your machine and is sent to a
non-EU-hosted third party. This is a known, deliberate limitation of this
pre-alpha milestone (see `CLAUDE.md`'s "État actuel" section) — full EU data
residency is not yet implemented. Do not run `init` with `--open-pr` or
without `--api-url` pointed at a trusted `apps/api` instance on source trees
containing text you don't want sent to Anthropic/OpenAI.

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

You'll also need a running `apps/api` instance to translate against (see
`apps/api/README.md`). Extraction-only usage is not a supported mode of
`init` — an API token is required even just to write `locales/en.json`,
since `init` always attempts the translation step afterward.

## Usage

```bash
localize-infra init [directory] [--force] [--api-url <url>] [--api-token <token>] [--locales <list>] [--open-pr] [--owner <owner>] [--repo <repo>] [--base-branch <branch>]
```

- `directory` — defaults to the current working directory.
- `--force` — by default, `init` refuses to overwrite an existing
  `locales/en.json` if doing so would drop keys that are no longer produced
  by the current extraction (e.g. a hand-maintained catalog, or source text
  that changed since the last run). Pass `--force` to proceed anyway and
  let those keys be removed.
- `--api-url <url>` — base URL of the `apps/api` instance to translate
  against and (if `--open-pr` is set) open a PR through. Defaults to
  `http://localhost:8787`. There is currently no environment-variable
  equivalent for this flag (only the API token has one — see below); it
  must be passed explicitly if `apps/api` isn't running on the default
  local port.
- `--api-token <token>` — bearer token sent as `Authorization: Bearer
  <token>` to `apps/api`. **Prefer the `LOCALIZE_API_TOKEN` environment
  variable instead**: passing the token on the command line leaks it into
  shell history and process listings (e.g. `ps`). If both are set,
  `--api-token` takes precedence. One of the two is required — `init` fails
  fast, before writing anything, if no token is configured.
- `--locales <list>` — comma-separated list of target locales to translate
  into (e.g. `de,ja,es`). Defaults to `de,ja,es,ar,pt-BR`.
- `--open-pr` — after translation, open a pull request containing the
  updated locale files via `apps/api`'s `/v1/open-pr` endpoint. Requires
  `--owner` and `--repo` (see below); `init` validates both are present and
  well-formed *before* running the (billed) translation step, so a missing
  or malformed `--owner`/`--repo` fails immediately rather than after every
  locale has already been translated.
- `--owner <owner>` — GitHub repository owner (user or org) to open the PR
  against. Required when `--open-pr` is set.
- `--repo <repo>` — GitHub repository name to open the PR against. Required
  when `--open-pr` is set.
- `--base-branch <branch>` — base branch for the PR. Defaults to `main`.

### Environment variables

| Variable              | Purpose                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------- |
| `LOCALIZE_API_TOKEN`   | Bearer token for `apps/api`. Preferred over `--api-token` (see above). |

`--api-url` has no environment-variable equivalent today — pass it
explicitly, or rely on the `http://localhost:8787` default.

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
  ICU-aware string, and is deferred — it is not addressed in this phase.
- Test, spec, and story files (`*.test.tsx`, `*.spec.tsx`, `*.stories.tsx`)
  are skipped so fixture/story text never pollutes the real catalog.
- Purely numeric/punctuation/currency strings (e.g. `42`, `$9.99`) and bare
  HTML entities (e.g. `&nbsp;`) are filtered out as noise, not real UI text.
