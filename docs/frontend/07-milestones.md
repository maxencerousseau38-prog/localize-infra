# Frontend Milestone Roadmap

Date: 2026-08-06
Depends on: `06-frontend-architecture.md`

---

## 0. Critical path

Two tracks. **Track A ships without any new backend. Track B is a large backend project that gates everything else.**

```
FE-0 ──► FE-1 ─────────────────────────────────► ship publicly (no backend)
 design    marketing · docs · benchmarks
 system
   │
   └──────► [ BLOCKED ON TRACK B ] ──► FE-2 ──► FE-3 ──► FE-4 ──► FE-5 ──► FE-6
              auth · tenancy · DB       shell   projects  ambiguity  review  org/billing
```

**The single most important sequencing decision: ship FE-1 before Track B exists.** It requires no backend, it is the entire acquisition channel, and the market window created by the Phrase/Lokalise repricing is open *now*. Building the dashboard first would spend months before a single prospect can evaluate us.

**The second: FE-4 (ambiguity) before FE-5/FE-6.** It is the only screen competitors have no incentive to copy. Members-and-billing screens are commodity work that any team can do later; they should not precede the differentiator.

---

## FE-0 — Design system foundation

**Objective.** Turn `05-design-system.md` into a working token layer and primitive set in a new proprietary `packages/ui`.

**Dependencies.** None. Start immediately.

**Files.** `packages/ui/` (package.json, tsconfig, tailwind preset), `src/tokens/{colors,spacing,typography,motion}.css`, `src/primitives/*`, `.storybook/`.

**Components.** Button · Input · Select · Checkbox · Radio · Textarea · Badge · Card · Table · Dialog · Drawer · Dropdown · Popover · Tooltip · Toast · Skeleton · Tabs · Avatar · **StateRule** · **StringCard**.

**Pages.** None (Storybook only).

**Complexity: M.** Mostly configuration and restyling of shadcn/Radix. The two novel pieces are `StateRule` and `StringCard` (design system §1.6, §4.2).

**Testing.** Storybook per variant; axe on every story; visual regression in light + dark + **RTL**; a CI job asserting every semantic token pair meets contrast thresholds.

**Review.** Design review against §1 (does chrome stay neutral?); a11y review; a token-indirection audit — any component referencing `--iris-9` instead of `--state-ambiguous` is rejected.

**Risks.** *Building components nothing consumes yet.* Mitigate by building only what FE-1 needs now and deferring the rest until a screen demands it. Speculative component libraries rot.

---

## FE-1 — Marketing site, docs, benchmarks · **ships publicly**

**Objective.** A public surface that converts a repriced Phrase/Lokalise customer into an `npx` run, and that answers P5's security questions without a call.

**Dependencies.** FE-0. **No backend.** Benchmark data comes from the existing Sprint 0 eval harness output, committed in the repo.

**Files.** `apps/site/` — App Router, Fumadocs, MDX content, static/ISR.

**Pages.** `/` · `/pricing` · `/benchmarks` · `/security` · `/docs/*` · `/changelog` · `/status`.

**Components.** Hero with copy-command · real PR diff embed · ambiguity example card · pricing table with the no-metering pledge · benchmark bar chart · sub-processor table · docs shell (nav / prose / TOC).

**Complexity: M.**

**Testing.** Lighthouse CI (LCP < 1.2s p75) gating merge; axe on every route; link checker; **the copy-command button tested on touch** (it is the primary conversion action); OG/meta snapshots.

**Review.** Copy review against PRD §6 positioning; a founder-level read of whether the page beats the incumbents' pricing pages for an actively-shopping buyer; legal review of the sub-processor list.

**Risks.**
- **The benchmark page publishes languages where we lose (invariant #7).** That is deliberate and should not be softened during review. Guard against a well-meaning edit that buries the losing rows.
- Marketing motion (Lenis/GSAP/React Bits) leaking into `apps/web`. Prevented structurally by the two-app split.
- Claiming capabilities that only exist in the roadmap. **Every claim on this site must be true today** — the ambiguity queue is not shipped, so the page must show it as the product's principle, demonstrated by the CLI's real escalation behaviour, not as a screenshot of a UI that does not exist.

---

## ⛔ TRACK B — Backend foundation (**not frontend work; blocks FE-2 onward**)

Called out explicitly because it is invisible in a frontend plan and is the real schedule risk.

| # | Item | Complexity |
|---|---|---|
| B1 | Identity: GitHub OAuth + magic link + sessions + CLI device-code grant | L |
| B2 | Tenancy: org/project/member/role, enforced server-side per request | L |
| B3 | Persistence: Postgres — projects, members, locales, runs, ambiguity, decisions, audit, cache. **Never translations** (invariant #1) | L |
| B4 | Per-user GitHub App install + the *installed-but-repo-unauthorized* state | M |
| B5 | Ambiguity API: produce items, persist decisions, **never re-ask** | L |
| B6 | Suggestions API: batch non-dev edits into PRs | M |
| B7 | Billing: Stripe, flat recurring prices only. A `metered` price violates invariant #3 | M |
| B8 | Rate limits on runs/day (compute guard, never a value meter) | S |
| — | **R4: EU residency / BYOK / sub-processor disclosure** — blocks enterprise, already a known gap | L |

**Estimate: a full milestone of backend work on its own.** Any frontend plan that omits it is fiction.

---

## FE-2 — App shell & authentication

**Objective.** A user can sign in three ways, land in a scoped shell, and navigate entirely by keyboard.

**Dependencies.** B1, B2.

**Files.** `apps/web/src/app/(auth)/*`, `(app)/layout.tsx`, `lib/{auth,api-client,query,keyboard}`, `components/shell/*`.

**Components.** AppShell · Sidebar · TopBar · Breadcrumb · OrgSwitcher · **CommandPalette** · UserMenu · ThemeToggle · SessionList.

**Pages.** `/login` · `/auth/device` · `/auth/callback` · `/~` · `/~/settings/{profile,sessions,notifications}`.

**Complexity: L.** Auth is where security bugs live; the device-code flow and magic-link second-class accounts both need care.

**Testing.** E2E for all three sign-in paths; device-code E2E (terminal → browser → terminal); session revocation; **keyboard-only navigation E2E**; ⌘K opens < 50ms.

**Review.** Security review of session handling and token storage; a11y review of focus management across route changes.

**Risks.** Magic-link accounts must be genuinely second-class (review-only) or they become a privilege-escalation path. Device-code grants must be individually revocable and visible.

---

## FE-3 — Projects, connection, and history

**Objective.** Connect a repo from the web (secondary to the CLI), and answer "what happened in that run?"

**Dependencies.** B3, B4.

**Pages.** `/~/new` · `/{org}` · `/{org}/{project}` · `/{org}/{project}/runs` · `/runs/{id}` · `/{org}/{project}/locales` · `/{org}/{project}/settings/*`.

**Components.** ProjectCard · RepoPicker · **InstallationStateCard** · LocaleTable · RunList · RunDetail · LocaleOutcomeRow · SettingsForm · DangerZone.

**Complexity: M.**

**Testing.** E2E connect-repo; **explicit test for the installed-but-unauthorized state** (this broke live validation and will hit real users); run-detail rendering for partial failure; pagination with 1k+ runs.

**Review.** Confirm the CLI stays visually primary on `/~/new`. Confirm key counts are never rendered near price (they are health indicators, not meters).

**Risks.** Re-creating GitHub's diff viewer. Forbidden — link out (UX §0).

---

## FE-4 — Ambiguity queue · **the differentiator**

**Objective.** Resolve ambiguity at keyboard speed, with full context, and never be asked the same thing twice.

**Dependencies.** B5. Visual context quality depends on M3 (Playwright capture) but the screen must degrade gracefully without screenshots.

**Pages.** `/{org}/{project}/ambiguity`.

**Components.** AmbiguityQueue · AmbiguityItem · **DecisionRail** · ContextPanel · ScreenshotViewer · OptionList · CustomAnswerInput · ContextNoteInput · UndoToast · ProgressHeader · **ShortcutRegistry**.

**Complexity: L.** The hardest screen in the product, and the one where ordinary CRUD patterns fail. Requires prefetch windowing, optimistic mutation with visible rollback, offline queueing, and a centralized keyboard layer.

**Testing.**
- **Keyboard-only E2E covering the full decision loop** — mouse-only tests prove nothing here.
- Performance test asserting keystroke → next item **< 100ms**.
- **A decision, once made, is never re-presented** — the roadmap's own M4 exit criterion, tested directly.
- Undo correctness; offline decisions replay on reconnect; rollback is visible when the server rejects.
- Reduced-motion: instant advance must remain instant.

**Review.** Product review against the anti-goal: *this must not become a CAT editor*. A reviewer should try to clear 50 items and report where throughput breaks.

**Risks.**
- **Escalating too often makes it noise; too rarely means we are secretly guessing.** Instrument resolved/raised and items-per-100-strings from day one (PRD §11 counter-metrics).
- Empty state read as failure rather than success — must be celebratory (design system §4.10).
- Latency budget missed → the screen's entire value collapses. Treat the budget as a functional requirement, not a nice-to-have.

---

## FE-5 — Non-developer review

**Objective.** Inès fixes a word, on a phone, with no GitHub account and no jargon, and it becomes a PR.

**Dependencies.** B6, plus magic-link accounts from B1.

**Pages.** `/{org}/{project}/review` · a tokenized deep link for direct sharing.

**Components.** ReviewCard · VisualContext · SuggestionInput · SuggestionStatus · LocaleSelector (full names, never bare codes).

**Complexity: M.**

**Testing.** **Mobile-first E2E** (this is the one surface designed phone-first). A copy audit asserting the banned vocabulary — key, path, JSON, branch, commit, merge, pull request — appears nowhere in the rendered DOM. Suggestion → batched PR E2E.

**Review.** Hand it to a non-developer and watch silently. If they ask what any word means, the screen fails.

**Risks.** Jargon leaking in through error messages and empty states — the places copy review usually forgets. Suggestions must never write directly to the repo (invariant #1).

---

## FE-6 — Organization, members, billing

**Objective.** Administrative truth (J3), and a billing page that sells the pricing promise.

**Dependencies.** B7.

**Pages.** `/{org}/settings/{general,members,installations,api-keys,audit,billing}`.

**Components.** MemberTable · RoleSelect · InviteDialog · ApiKeyTable · CreateKeyDialog (show-once) · AuditTable (virtualized) · PlanCard · PlanComparisonTable · InvoiceList · **NoMeteringPledge**.

**Complexity: M** (audit virtualization and Stripe edge cases carry most of it).

**Testing.** Permission matrix tested per role, **server-side** — a Reviewer hitting an admin route must be rejected by the API, not merely hidden in the UI. Show-once key never re-retrievable. Audit export. Stripe webhook reconciliation. Downgrade paths when over plan limits.

**Review.** **A specific check: no usage meter, gauge, or "X of Y words" indicator anywhere.** Confirm the "seats are unlimited and free" note appears on the members page (it removes the hesitation that blocks the P3 growth motion).

**Risks.** The billing page is where a well-intentioned "usage transparency" widget gets proposed. It must be rejected — a displayed counter becomes a billed counter under the first revenue pressure (PRD §10).

---

## Delivered so far — and where it diverged from this plan

Recorded here rather than by renumbering the milestones below, because the
sequencing argument in this document is still the one being followed and
rewriting it would erase the reasoning that produced it.

| Shipped | Corresponds to | Notes |
|---|---|---|
| `packages/ui` tokens + first primitives | FE-0 | As planned. |
| `apps/site` — 7 static pages | **FE-1, complete** | Marketing, docs and benchmarks. Every published figure is generated from the corpus, not written by hand. |
| `packages/ui` full component library | FE-0, completed | Forms, overlays, tables, feedback, patterns, command palette. |
| `apps/web` — shell, routing, `/design` gallery | **FE-2, shell only** | Taken out of order, deliberately: the shell needs no backend. Auth does, so it is absent. |

**FE-1 is now complete.** `/docs` documents the CLI that exists — one command,
eight flags, the extraction limits it has not solved — and states that the
package is not published to npm, which is why the landing page no longer
presents `npx` as something a visitor can run today. `/benchmarks` publishes
the one comparison the committed data supports: the same model with and
without source-code context, scored deterministically. Building it surfaced
that `/quality` had been reporting "Pass" for two checks the corpus never
exercised; those now read "No data".

Still not built from the original FE-1 scope: nothing. Fumadocs and MDX were
named in the plan as the docs stack and were not used — the documentation is
one page of static JSX, which is the right size for a CLI with one command,
and adding a docs framework for it would have been the larger mistake.

**`apps/web` ships with six of its seven routes stating they are not built.**
That is the honest consequence of building the shell before Track B: there is
no database, no account, and no persisted project for those screens to read.
An e2e test asserts each one says so, so the gap cannot quietly become a
mock. The remaining route, `/design`, renders the component library itself and
needs no backend.

This does not unblock FE-2 onward. Everything those milestones actually
deliver — tenancy, real projects, the ambiguity queue — still waits on
Track B.

---

## Complexity & sequencing summary

| Milestone | Complexity | Blocked by | Ships value to |
|---|---|---|---|
| FE-0 design system | M | — | internal |
| **FE-1 marketing/docs/benchmarks** | **M** | **FE-0 only** | **prospects — ship first** |
| Track B backend | **XL** | — | nothing directly |
| FE-2 shell & auth | L | B1, B2 | all personas |
| FE-3 projects & history | M | B3, B4 | Maya, Tomás |
| **FE-4 ambiguity** | **L** | B5 | **Maya, Wolfgang — the differentiator** |
| FE-5 non-dev review | M | B6 | Inès |
| FE-6 org & billing | M | B7 | Tomás, Priya |

---

## Cross-cutting definition of done

Every milestone must satisfy all of these before it is called complete:

1. axe: zero violations on every route.
2. Keyboard-complete; visible focus everywhere.
3. Light, dark, **and RTL** visual regression passing.
4. Reduced-motion verified.
5. Performance budget met and enforced in CI (§7 of the architecture doc).
6. Empty, loading, error, and offline states implemented — not deferred as polish.
7. Server-side permission enforcement for every action.
8. No usage meter introduced anywhere.
9. No translation stored as the source of truth.
10. Copy reviewed against the vocabulary rules for the relevant persona.
