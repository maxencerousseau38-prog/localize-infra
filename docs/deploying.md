# Deploying

Nothing in this repository is deployed today. This is the configuration a
deployment needs, and the failure it will hit if one setting is wrong.

## What is deployable

| App | Shape | Notes |
| --- | --- | --- |
| `apps/site` | **Fully static** — every route prerenders | The marketing surface. No environment variables, no serverless functions. |
| `apps/web` | **Fully dynamic** — every route plus a proxy | Runs as functions. See the section below before deploying it. |
| `apps/api` | Long-running server | **Not serverless-safe as written.** See the warning below. |

## apps/site on Vercel

Connect the GitHub repository (Add New → Project → import `localize-infra`)
and set:

| Setting | Value |
| --- | --- |
| Root Directory | `apps/site` |
| Framework Preset | Next.js (auto-detected) |
| Build Command | default |
| Install Command | default — Vercel detects npm workspaces |
| **Include source files outside of the Root Directory in the Build Step** | **ON — required, see below** |

No environment variables are needed. `apps/site` reads `process.env` nowhere.

Prefer the git connection over a direct file upload. The upload path produces a
deployment with no auto-deploy on push, so every change has to be re-uploaded
by hand.

## The setting that silently breaks the site

**"Include source files outside of the Root Directory" is not optional.**

`apps/site` reaches outside its own directory in three ways, and every one of
them breaks quietly rather than loudly:

1. **Tailwind class discovery.** `src/app/globals.css` contains:

   ```css
   @source '../../../../packages/ui/src';
   ```

   Tailwind v4 finds classes by scanning source files. If `packages/ui/src` is
   absent at build time, that directive matches nothing and every utility class
   used *only* inside a `packages/ui` component is tree-shaken away.

2. **`transpilePackages: ['@localize-infra/ui']`** — the UI package ships
   source, not a build artifact, so its `.tsx` files must be present to compile.

3. **`@localize-infra/eval/benchmarks.json`** — the published benchmark numbers
   are imported from that package at build time.

With the setting off, the first of these does not error. No warning is emitted:
a Tailwind `@source` path matching nothing is indistinguishable from a
directory containing no classes.

Measured on this repository by deleting the `@source` line and rebuilding:

| | Stylesheet | `animate-shimmer` |
| --- | --- | --- |
| With `@source` | **44,377 B** | present |
| Without | **30,882 B** | **absent** |

13.5 kB — about 30% of the stylesheet — disappears. `animate-shimmer` is the
proof case: it is used only by the `Skeleton` component inside `packages/ui`,
so nothing in `apps/site` keeps it alive.

The result is not a blank page, which is what makes it easy to miss. The design
tokens survive (`tokens.css` is `@import`ed, not scanned) and `apps/site`'s own
page-level classes survive, so layout still looks broadly right. What breaks is
every shared component — buttons, badges, cards, the State Rule, the theme
toggle — silently losing the utilities that style them.

That is the third time this shape of bug has appeared in this repository: a
Content-Security-Policy that blocked every script while the build stayed green
and the accessibility audit passed, and a stale `dist/` that served an
unpatched security fix while every test resolved against source. Green build,
broken runtime, silent.

## Verifying a deployment

A `READY` state means the build finished. It does not mean the site works.
Check the three things a build cannot:

```bash
# 1. Does it serve at all?
curl -sS -o /dev/null -w '%{http_code}\n' https://<deployment-url>/

# 2. Did the CSS survive? Fetch the stylesheet and look for a utility that
#    exists ONLY inside packages/ui. Expect ~44 kB and a hit; a ~31 kB file
#    with no hit means the @source path was dropped.
CSS=$(curl -sS https://<deployment-url>/ | grep -o '/_next/static/chunks/[^"]*\.css' | head -1)
curl -sS "https://<deployment-url>${CSS}" | tee /dev/null | wc -c
curl -sS "https://<deployment-url>${CSS}" | grep -c 'animate-shimmer'   # must be >= 1

# 3. Are the published benchmark numbers on the page?
curl -sS https://<deployment-url>/benchmarks | grep -c '413/413'
```

The repository's own E2E suite covers the equivalent checks locally
(`npm run test:e2e`): zero console errors per route, axe on both colour
schemes, and the assertion that published figures match the generated
artifact.

## apps/web, if it is deployed later

Every route is dynamic and there is a proxy, so it runs as serverless
functions rather than static files. This is deliberate: `src/proxy.ts` issues a
per-request CSP nonce, which rules out static generation. Expect worse
first-paint numbers than `apps/site` and do not apply that app's LCP budget to
it.

It needs no environment variables and uses only Web APIs in the proxy
(`crypto.randomUUID`, `Headers`, `NextResponse`), so it has none of the usual
cold-start crash triggers.

Root Directory would be `apps/web`, with the same outside-root setting ON for
the same `transpilePackages` reason.

## apps/api is not serverless-safe as written

`apps/api/src/index.ts` reads its configuration at **module scope** and throws:

```ts
const API_AUTH_TOKEN = process.env.API_AUTH_TOKEN;
if (!API_AUTH_TOKEN) throw new Error('API_AUTH_TOKEN is not set');
```

That is correct for a long-running server — it fails closed rather than serving
`/v1/*` unauthenticated — but on a serverless platform it runs during function
initialisation. A missing variable becomes `500: FUNCTION_INVOCATION_FAILED`
with **no application log line at all**, because the crash happens before any
handler can log. That silence is the diagnostic signature: an invocation
failure with an empty runtime log usually means a module-scope throw, not a
request-handling bug.

Before putting this app on a serverless platform, move the check inside a
handler or a lazily-initialised accessor — and keep it failing closed.
