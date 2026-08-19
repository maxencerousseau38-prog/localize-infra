# Deploying apps/api

Vercel project `localize-infra-api`, Root Directory `apps/api`, functions in
**cdg1 (Paris)**. Live at https://localize-infra-api.vercel.app.

This service exists as a deployed HTTP endpoint rather than an in-process module
because `packages/cli` calls it over the network — `translate-client.ts` and
`open-pr-client.ts` both POST to `${apiUrl}/v1/…`. The `npx → PR` story a
developer is sold depends on this URL being reachable.

## Two things that made it fail, both fixed

**1. `export default` silently times out.** Vercel's Node runtime reads a
default export as the legacy `(req, res) => void` signature and *ignores the
returned value*. `hono/vercel`'s `handle()` returns a `Response`, so every
request was accepted, its response discarded, nothing written, and the
invocation ran to the 300-second ceiling. No error — just timeouts. The fix is
`export function fetch(request)`, the Web-standard form, in `api/index.ts`.

**2. Providers were built eagerly, both of them.** `/v1/translate` called
`getProvider('openai')` on every request, which throws when `OPENAI_API_KEY` is
unset. A deployment configured with a perfectly good Anthropic key answered 500
in 0.27s without reaching any model. Providers are now built only for the keys
that exist (`getConfiguredProviders()`), and `pickProvider(seed, available)`
spreads across the configured set — one provider means every locale lands on it,
two means the original A/B split. With none configured the route answers **503**,
not 502: nothing upstream failed, this deployment has nothing to ask.

## Environment

All five are required. The service refuses to start without the first one.

| Variable | Purpose |
|---|---|
| `API_AUTH_TOKEN` | Bearer for every `/v1/*` route. `src/index.ts` throws at import without it |
| `ANTHROPIC_API_KEY` | Translation. At least one provider key must be present |
| `GITHUB_APP_ID` | Pull-request creation |
| `GITHUB_APP_INSTALLATION_ID` | Pull-request creation |
| `GITHUB_APP_PRIVATE_KEY` | The PEM **inline** — `GITHUB_APP_PRIVATE_KEY_PATH` is a local-only convenience with no file to point at on Vercel |

`OPENAI_API_KEY` is deliberately unset. Adding it re-enables the two-provider
split with no other change.

## Deploying

From the **repository root**, not from `apps/api`, so workspace dependencies
resolve:

```sh
VERCEL_ORG_ID=team_jkFQHiZ8OitJujErZvg9oJFb \
VERCEL_PROJECT_ID=prj_fFCT4LNM1gK5S6uelPaceSvLahJS \
npx vercel deploy --prod --archive=tgz
```

`outputDirectory: public` exists because Vercel refuses to finish a build with a
`buildCommand` and no static output. The page it serves is real — it states what
the service is and that source-derived context leaves the EU — but the catch-all
rewrite means `/` reaches the function, so the page is a build requirement more
than a destination.

## Verified in production

```
GET  /health                        200 {"ok":true}       (0.35s)
POST /v1/translate  no token        401
POST /v1/translate  wrong token     401
POST /v1/translate  valid token     200 (3.31s)
     cart.checkout -> Procéder au paiement
     cart.empty    -> Votre panier est vide
X-Vercel-Id: cdg1::cdg1
```

## Data residency

Source-derived context — file paths, component names, surrounding code — is sent
to Anthropic, which is not hosted in the EU. Functions run in `cdg1` and the
database is `eu-west-3`, which settles the journey to the model but not the model
itself. This is the known gap against invariant 5, recorded in CLAUDE.md, and it
is now on a public URL rather than one developer's machine. That was a deliberate
decision taken on 2026-08-19, not a drift.
