# @localize-infra/api

A **proprietary** (not open-source — see the repo root `CLAUDE.md`, "Open
source" section) local HTTP service that exposes two endpoints:

- `POST /v1/translate` — translates a batch of extracted UI strings into a
  target locale, via Anthropic or OpenAI (see `src/router/index.ts` for
  provider selection).
- `POST /v1/open-pr` — opens a pull request containing updated locale
  files, via `@localize-infra/github-app` and a GitHub App installation.
- `GET /health` — unauthenticated liveness check.

`/v1/*` routes require an `Authorization: Bearer <API_AUTH_TOKEN>` header
(see `src/auth.ts`); `/health` is intentionally excluded.

It's consumed by `@localize-infra/cli`'s `init` command (see
`packages/cli/README.md`), and is not meant to be exposed publicly — it has
no rate limiting, multi-tenant auth, or usage metering, only a single
shared bearer token.

## Running locally

```bash
npm run dev -w @localize-infra/api
```

This starts the server with `tsx watch src/index.ts` on `PORT` (default
`8787`).

`predev` (and `pretest`, for `npm run test -w @localize-infra/api`) first
rebuild this service's workspace dependencies —
`@localize-infra/schemas` and `@localize-infra/github-app` — from source.
This matters because `apps/api` resolves those packages through their
published `main`/`dist` entry points (real npm/node package resolution),
**not** through a relative source import, so an edit to `packages/schemas`
or `services/github-app` won't be picked up here until they're rebuilt.
`predev`/`pretest` do this automatically; if you build those packages
manually instead, rebuild them before starting `apps/api` or its tests, or
you'll be running against stale `dist/` output.

The server needs `API_AUTH_TOKEN` set or it refuses to start (see
"Environment variables" below), and needs at least one of
`ANTHROPIC_API_KEY` / `OPENAI_API_KEY` set for `/v1/translate` to actually
succeed (see `src/router/index.ts`).

## Environment variables

All variables `apps/api` reads directly (grepped from `src/**/*.ts`,
excluding tests):

| Variable                      | Required?                          | Purpose                                                                                                                                          |
| ------------------------------ | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `API_AUTH_TOKEN`               | Yes — the process throws and refuses to start without it | Shared bearer token that `/v1/*` routes require in the `Authorization` header. |
| `ANTHROPIC_API_KEY`            | Yes, if any request routes to Anthropic | API key for the Anthropic provider. `/v1/translate` throws per-request if the request routes to Anthropic and this is unset. |
| `OPENAI_API_KEY`               | Yes, if any request routes to OpenAI | API key for the OpenAI provider. `/v1/translate` throws per-request if the request routes to OpenAI and this is unset. |
| `OPENAI_BASE_URL`              | No                                  | Overrides the OpenAI API base URL (e.g. for an OpenAI-compatible proxy). |
| `API_ANTHROPIC_MODEL`          | No — defaults to `claude-sonnet-5`  | Anthropic model ID used for translation requests. |
| `API_OPENAI_MODEL`             | No — defaults to `gpt-4o`           | OpenAI model ID used for translation requests. |
| `PORT`                         | No — defaults to `8787`             | Port the HTTP server listens on. |
| `GITHUB_APP_ID`                | Yes, for `/v1/open-pr` to work      | GitHub App ID used to authenticate as the App. |
| `GITHUB_APP_PRIVATE_KEY_PATH`  | Recommended way to supply the key   | Path to the App's private key `.pem` file, exactly as downloaded from GitHub's App-creation flow (`<app-slug>.<date>.private-key.pem`). Read at request time. See "Standard GitHub App configuration" below. |
| `GITHUB_APP_PRIVATE_KEY`       | Alternative to `GITHUB_APP_PRIVATE_KEY_PATH` | The App's private key as raw PEM content, inline. Takes precedence if both this and `_PATH` are set. See the gotcha below if you use this form. |
| `GITHUB_APP_INSTALLATION_ID`   | Yes, for `/v1/open-pr` to work      | The App installation ID for the target GitHub account/org. Must parse as a number — a non-numeric value is treated the same as if it were unset. |

If `GITHUB_APP_ID` / `GITHUB_APP_INSTALLATION_ID` is missing, or neither
`GITHUB_APP_PRIVATE_KEY_PATH` nor `GITHUB_APP_PRIVATE_KEY` resolves to a
readable key (or `GITHUB_APP_INSTALLATION_ID` isn't numeric), `/v1/open-pr`
responds `501 Not Implemented` rather than crashing — `/v1/translate` is
unaffected either way.

### Standard GitHub App configuration

GitHub's App-creation flow gives you an App ID, an Installation ID (once
you install the App on an account/org), and a private key **downloaded as a
`.pem` file** — not a value you paste. `GITHUB_APP_PRIVATE_KEY_PATH` matches
that flow directly: point it at wherever you saved the downloaded file (an
absolute path is safest) and `apps/api` reads the file itself at request
time. This is the recommended approach — it sidesteps the multi-line-PEM
shell-quoting problem entirely, and it means the key file itself never has
to be pasted into `.env` (or into a chat, or a shell command) at all.

```bash
# .env
GITHUB_APP_ID=123456
GITHUB_APP_PRIVATE_KEY_PATH=/c/Users/you/Downloads/your-app.2026-08-05.private-key.pem
GITHUB_APP_INSTALLATION_ID=789012
```

### `GITHUB_APP_PRIVATE_KEY` (inline) gotcha: it must be the full multi-line PEM

If you use the inline form instead of `_PATH`, be aware this repo's
convention (established since Sprint 0, for `ANTHROPIC_API_KEY` etc.) is a
plain shell-style `.env` file at the repo root, loaded with:

```bash
set -a && source .env && set +a
```

That's a real `bash` `source`, not a JS `dotenv`-style parser — so it does
**not** do any `\n` → newline unescaping for you. `apps/api` passes
`GITHUB_APP_PRIVATE_KEY` straight through to Octokit's `App` constructor
(`services/github-app/src/client.ts`) with no unescaping either. The
practical way to get a real multi-line PEM into this `.env` file so `source`
loads it as one shell variable with literal embedded newlines is a
double-quoted, multi-line value:

```bash
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
MIIEow...
...
-----END RSA PRIVATE KEY-----"
```

(`bash` allows a double-quoted string to span multiple lines; `source`
assigns the whole thing, newlines included, to the variable.) Do **not**
use a `\n`-escaped single-line form — nothing in this codebase unescapes
`\n` sequences in `GITHUB_APP_PRIVATE_KEY`, so Octokit would receive the
literal two-character sequence `\n` instead of a newline and fail to parse
the key. `GITHUB_APP_PRIVATE_KEY_PATH` avoids this problem entirely, which
is why it's the recommended default.
