# @localize-infra/github-app

**Proprietary** (see the repo root `CLAUDE.md`, "Open source" section) —
Octokit-based logic for authenticating as a GitHub App and opening a pull
request that adds/updates locale files (`src/client.ts`,
`src/open-pr.ts`). It is consumed only by `@localize-infra/api`
(`apps/api/src/index.ts` is the sole caller of
`createGitHubAppClient`/`openTranslationPr`); nothing here is called
directly by the CLI or by end users.

## Environment variables

None. This package has no environment-variable reads of its own — all
configuration (`appId`, `privateKey`, `installationId`) is passed in by its
caller (`apps/api`, which reads `GITHUB_APP_ID` / `GITHUB_APP_PRIVATE_KEY` /
`GITHUB_APP_INSTALLATION_ID` — see `apps/api/README.md`).
