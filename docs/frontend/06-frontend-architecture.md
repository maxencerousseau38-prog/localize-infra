# Frontend Architecture

Date: 2026-08-06
Depends on: `05-design-system.md`, and the existing monorepo (`packages/schemas`, `apps/api`)

---

## 1. The constraint that dominates every decision

**There is no backend for the application.** Verified 2026-08-06:

| Needed by the web app | Exists today |
|---|---|
| User identity, sessions | ❌ single shared static bearer token |
| Multi-tenancy (org → project scoping) | ❌ none |
| Persistence (projects, runs, ambiguity, decisions) | ❌ **no database at all** |
| Per-user GitHub App installation | ❌ one global env-var installation |
| Billing | ❌ none |
| Translate / open-PR endpoints | ✅ built, live-validated |

So the honest sequencing is: **two of roughly twenty-five screens can be built against today's backend.** The marketing site and the benchmarks page need no backend at all and should ship first; everything authenticated is gated behind a substantial backend project (§6, Track B).

Pretending otherwise would produce a beautiful, unbuildable plan.

---

## 2. Applications

Two separate Next.js apps, deliberately not one:

| App | Path | Rendering | Why separate |
|---|---|---|---|
| **`apps/site`** | `/`, `/pricing`, `/benchmarks`, `/security`, `/docs` | Static / ISR | Public, indexable, must be fast on first paint. Ships **now**, no backend. Carries Lenis + marketing motion, which must never enter the app bundle. |
| **`apps/web`** | `/~`, `/{org}/…` | Client-heavy, authenticated | No SEO requirement, different perf profile, different dependency set. |

Merging them would force the dashboard's auth and the marketing site's animation libraries into one bundle — the worst of both.

Docs use **Fumadocs** (per the original stack decision) inside `apps/site`. Technical SEO is an acquisition channel, not an afterthought.

---

## 3. The monorepo advantage we should exploit

`packages/schemas` already contains the Zod contracts the API validates against (`TranslateBatchRequestSchema`, `OpenPrApiRequestSchema`, and so on). **The frontend imports the same package.** One definition of the contract, shared by CLI, API, and web — validated identically at every boundary, with types inferred rather than re-declared.

This is unusual and worth protecting: most teams re-type their API contract in the frontend and drift within a quarter.

**Open-core boundary (from `CLAUDE.md`).** Open: `cli`, `core`, `adapters`, `sdk-*`, `schemas`, `eval`. Proprietary: `context`, `agents`, `api`, `web`. `apps/web` is proprietary and may consume the open `schemas`; the reverse would be a violation. New shared UI lives in a **proprietary** `packages/ui`, because the design system is not something we open-source in v1.

```
packages/schemas ──┬──> packages/cli    (open)
                   ├──> apps/api        (proprietary)
                   └──> apps/web        (proprietary)   ← new
packages/ui  ──────┴──> apps/web, apps/site             ← new, proprietary
```

---

## 4. Stack

| Concern | Choice | Rationale |
|---|---|---|
| Framework | **Next.js (App Router)** | Already the house choice; RSC for the shell, client islands for interactive surfaces |
| Styling | **Tailwind** + CSS custom properties | Tokens as CSS vars (design system §6) so theming is not a rebuild |
| Primitives | **Radix** via **shadcn/ui** | Focus traps, roving tabindex, ARIA — required for WCAG 2.2 AA. We own the source, so the "chrome is neutral" restyle is possible |
| Server state | **TanStack Query** | Caching, background refresh, optimistic mutations — the ambiguity queue depends on optimistic updates |
| Client state | **Zustand**, sparingly | Only genuinely global UI state (palette open, theme). Most state is server state or URL state |
| **URL state** | `nuqs` or hand-rolled | Filters live in the URL (IA §6) so views are shareable and back-button-correct |
| Forms | **React Hook Form** + `zodResolver` | Same Zod schemas as the API — one source of validation truth |
| Validation | **`packages/schemas`** | See §3 |
| Motion | **Framer Motion** (app), **Lenis** (site only) | Scoped per design system §3.3 |
| Tables | **TanStack Table** headless | Virtualization for audit logs and 1k+ rows |
| Tests | **Vitest** + **Testing Library** + **Playwright** | Vitest matches the existing repo convention |
| a11y CI | **axe-core** + **Lighthouse CI** | Contrast and violations fail the build |
| Analytics | privacy-first, self-hostable | We sell data ownership; shipping invasive analytics would be hypocritical |

**Rejected:** Redux (overkill), tRPC (would fight the shared-Zod-over-REST contract the CLI already uses), a component library we cannot restyle, GSAP in-app (§3.3).

---

## 5. Structure

```
apps/web/src/
  app/
    (auth)/login, auth/device, auth/callback
    (app)/~/…                      personal scope
    (app)/[org]/[project]/…        ambiguity · review · runs · settings
    api/                           BFF: session, token exchange, webhooks
  components/{ambiguity,review,shell,…}
  lib/{api-client,auth,query,keyboard}
  hooks/
packages/ui/src/{primitives,patterns,tokens}   ← proprietary design system
```

**Route groups** separate the auth shell from the app shell. **Server Components by default**, client only where interaction demands it — the ambiguity queue is a client island; the shell around it is not.

### Rendering strategy per surface

| Surface | Strategy | Why |
|---|---|---|
| Marketing, docs, benchmarks | Static / ISR | SEO + speed; no user data |
| App shell, nav | RSC | No client JS for chrome |
| Lists (runs, members, audit) | RSC + client pagination | First paint from the server |
| **Ambiguity queue** | **Client, prefetched** | Sub-100ms keystrokes are impossible over a round trip per item |
| Review (Inès) | Client | Mobile-first, offline-tolerant |
| Settings forms | Client + server actions | Validation shared with the API |

### The ambiguity queue is the architecturally special case

It has a latency budget (keystroke → next item **<100ms**) that ordinary request/response cannot meet. Therefore:

- **Prefetch a window** of the next N items so the next item is always already local.
- **Optimistic decisions**: apply locally, reconcile in the background, roll back visibly on failure.
- **Queue writes when offline** and replay on reconnect (UX §11).
- **Keyboard handling in a dedicated layer**, not scattered `onKeyDown` — a single scoped handler with an explicit shortcut registry, so shortcuts are discoverable (`?`) and cannot silently collide.

Building this like a normal CRUD list is the most likely way to ruin the product's best screen.

---

## 6. Backend requirements this design creates

Frontend work is blocked on these. Listed so they are planned, not discovered.

**Track B — backend foundation (large, not frontend work):**
1. **Identity**: GitHub OAuth, magic link (for P3/P4 who have no GitHub account), sessions, device-code grant for the CLI.
2. **Tenancy**: org → project → member → role, enforced **server-side per request**; UI hiding is never the control (IA §5).
3. **Persistence**: Postgres for projects, members, active locales, runs, ambiguity items, decisions, audit, cache — and **never the translations themselves** (invariant #1, testable by dropping the database).
4. **GitHub App per-user install**: OAuth callback, multiple installations, and explicit handling of the *installed-but-repo-not-authorized* state that broke live validation.
5. **Ambiguity API**: produce items, persist decisions, guarantee a decision is never re-asked (M4 exit criterion).
6. **Suggestions API**: non-dev edits batched into PRs, never direct writes.
7. **Billing**: Stripe, flat recurring prices only — **a `metered` price is an invariant violation**.
8. **Rate limits** on runs/day as a compute guard — never a value meter.

**Also blocking (from the PRD's risk register):** R4, the EU-residency gap. We currently send customer source-code context to US LLM providers, contradicting invariant #5 and blocking enterprise sales.

---

## 7. Performance budgets

| Metric | Budget |
|---|---|
| Landing LCP | < 1.2s (p75, 4G) |
| App TTI | < 1.5s |
| App shell JS | < 120kb gzipped |
| Route chunk | < 60kb gzipped |
| **Ambiguity keystroke → next item** | **< 100ms** |
| ⌘K open | < 50ms |
| CLS | < 0.02 |

Enforced in CI via Lighthouse CI and a bundle-size check that fails the build — the same posture as the existing 99.5% placeholder/ICU gate. A budget without a failing build is a wish.

---

## 8. Testing

| Layer | Tool | Scope |
|---|---|---|
| Unit | Vitest | logic, hooks, formatters, permission helpers |
| Component | Testing Library | behaviour and roles, **never implementation details** |
| a11y | axe-core (per component + per route) | zero violations gates merge |
| E2E | Playwright | the four flows that matter: first run, ambiguity resolution, non-dev suggestion → PR, billing change |
| Visual | Playwright screenshots | design-system components, light + dark + RTL |
| Contract | shared Zod | frontend and API validate identically by construction |

**Keyboard-only E2E is mandatory** for the ambiguity queue — it is the primary input method, so a mouse-only test proves nothing.

**RTL and CJK rendering are visual-regression cases, not manual checks.** We render Arabic and Japanese as our core product surface; a layout that breaks in RTL must fail CI.

---

## 9. Security

- Session cookies `httpOnly`, `secure`, `sameSite=lax`; short access + rotating refresh.
- Every permission check server-side (IA §5). Client-side gating is presentation only.
- API tokens shown once, hashed at rest, scoped, revocable, last-used tracked.
- **Strict CSP, with exactly one documented inline-script exception.** No third-party tag manager.

  *Revised 2026-08-06 during FE-0.* The original rule ("no inline scripts") proved unimplementable: preventing a flash of the wrong colour scheme requires a script that runs **before first paint**, and every alternative — a React effect, a deferred script, an external file — paints once with the wrong theme first. That flash is the most common "this feels cheap" tell on an otherwise polished site.

  **Resolution: hash-based allowlisting.** The theme script is a static build-time constant (`apps/site/src/lib/theme-script.ts`) with no user input or interpolation. `next.config.ts` imports that exact string, computes its SHA-256, and adds it to `script-src`. Deriving the hash from the source means the two cannot drift — a changed script with a stale hash is blocked by the browser, which surfaces as a visible theme flash rather than a silent policy hole.

  A nonce would also satisfy a strict CSP but forces dynamic rendering on every route, costing the static-generation and LCP budget on a marketing site. Hashing a constant keeps pages static *and* the policy strict.

  `style-src` retains `'unsafe-inline'` because Tailwind and `next/font` emit inline `<style>`; style injection is not a script-execution vector, so this is a materially smaller concession than the equivalent on `script-src`.

  **Rule going forward:** any new inline script requires either a hash entry or a nonce. `'unsafe-inline'` on `script-src` is never acceptable.
- **No customer source code in client-side telemetry or error reporting.** Given the product transmits `surroundingCode` to LLM providers already (R4), leaking it a second way into an analytics vendor would be inexcusable.
- Bearer tokens never in URLs or `localStorage`.
