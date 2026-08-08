# Releasing the open-source packages

Three packages are publishable: `@localize-infra/schemas`, `@localize-infra/core`
and `@localize-infra/cli`. They are prepared for publication but **have not been
published**. This document is the sequence, and the reasons it is not a single
command.

## Before anything

1. **Authenticate.** `npm login`. Publishing fails with `ENEEDAUTH` otherwise.
2. **Own the scope.** `@localize-infra` is unclaimed on the public registry
   (`npm view @localize-infra/core` → 404). Create an npm organisation named
   `localize-infra`, or the scoped publish is rejected.
3. **Understand that it is permanent.** A published name cannot be reused.
   `npm unpublish` is restricted to a 72-hour window and is a last resort.

## Order matters

`cli` depends on `core` and `schemas` at `^0.1.0`, resolved from the registry —
not from this workspace. Publishing `cli` first produces a package that fails to
install for everyone with `E404` on its dependencies.

```bash
npm publish -w @localize-infra/schemas --access public
npm publish -w @localize-infra/core    --access public
npm publish -w @localize-infra/cli     --access public
```

`--access public` is required: scoped packages default to restricted, and a
restricted publish on a free account fails.

Each package runs `prepublishOnly`, which rebuilds `dist/`. That directory is
gitignored, so a publish from a clean clone would otherwise ship an empty
package — this is not a theoretical failure, it is the default one.

## Verifying before you publish

Publishing is irreversible, so verify against the packed tarballs rather than
against the workspace, where everything resolves regardless of whether the
`files` list is correct:

```bash
npm run build -w @localize-infra/schemas -w @localize-infra/core -w @localize-infra/cli
mkdir -p /tmp/pack
for p in schemas core cli; do (cd packages/$p && npm pack --pack-destination /tmp/pack); done

mkdir -p /tmp/consumer && cd /tmp/consumer && npm init -y
npm install /tmp/pack/localize-infra-{schemas,core,cli}-0.1.0.tgz
npx localize-infra            # prints usage
```

This has been run. The tarballs contain `dist/`, `README.md` and `LICENSE` and
nothing else — no `src/`, no compiled tests, no `.tsbuildinfo`. The binary links,
the shebang survives, and framework detection and string extraction work from
the installed package.

## What publishing does not achieve

`npx @localize-infra/cli init` will install and run, but it will not translate
anything. With `LOCALIZE_API_TOKEN` set and no API reachable, the observed
behaviour on a Vite + React project is:

```
Detected framework: Vite + React
Wrote 2 key(s) to locales/en.json
  de: FAILED - fetch failed
  ...
```

Detection, extraction and `locales/en.json` work locally. Every translation
fails, because `--api-url` defaults to `http://localhost:8787` and **there is no
hosted API**. Each user must run `apps/api` themselves with their own provider
key.

So publishing makes the package *installable*, not the command *useful*. A
one-line `npx` that actually translates requires a hosted API, which is Track B.
Until that exists, the landing page and `/docs` must keep saying so — publishing
changes the wording, not the disclosure.

## Unresolved: repository licensing

The root `LICENSE` is unscoped MIT, while `packages/ui` and every app are
`UNLICENSED` and proprietary. A root MIT licence arguably grants MIT rights over
the entire repository, including the proprietary parts. The three packages above
are genuinely MIT and now carry their own copy, but the root file's scope is a
legal question, not an engineering one, and has been left alone deliberately.
