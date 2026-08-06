# Wireframes (low fidelity)

Date: 2026-08-06
Depends on: `02-ux-and-flows.md`, `03-information-architecture.md`
**No implementation. No component code.** These are layout contracts the design system must satisfy.

---

## 0. Layout contract

All measurements are on an **8px base**; 4px is permitted only for optical alignment inside a control.

| Token | Value | Applies to |
|---|---|---|
| Sidebar | 240px (64px collapsed) | ≥1024 |
| Top bar | 48px | all |
| Page gutter | 24px (16px <768) | all |
| Content max-width | 1200px (prose 720px, forms 560px) | all |
| Section gap | 32px | between page sections |
| Card padding | 20px | cards, panels |
| Row height | 44px (table), 36px (dense list) | meets 24×24 target min with padding |
| Field gap | 16px label→control, 24px between fields | forms |

**Density decision:** two densities only — *comfortable* (default) and *dense* (tables, ambiguity queue, audit). Wolfgang (P4) reviews in volume and needs dense; Inès (P3) needs comfortable. A third density is scope creep.

**Notation:** `▢` container · `▭` input · `▬` button · `◈` icon · `···` truncation · `[N]` badge · `⌨` keyboard-primary.

---

## 1. Application shell

```
┌────────────┬───────────────────────────────────────────────────────────┐
│            │ ◈ org / project / Ambiguity      ▭ Search ⌘K    ◈ ⚑  ◯   │ 48px
│  SIDEBAR   ├───────────────────────────────────────────────────────────┤
│  240px     │                                                           │
│            │   ← 24px gutter · content max 1200px · centered           │
│            │                                                           │
└────────────┴───────────────────────────────────────────────────────────┘
```

Sidebar per IA §3: switcher, Home, Ambiguity `[12]`, Review `[3]`, project list (≤5 + "All"), Settings. Two nesting levels maximum. Top bar: breadcrumb / search / notifications / avatar. No global "New" button — creation lives in the terminal.

---

## 2. Landing (public) — `/`

Success metric is `npx` runs, not signups.

```
┌───────────────────────────────────────────────────────────────┐
│ ◈ logo          Docs  Pricing  Benchmarks  Security   [Sign in]│
├───────────────────────────────────────────────────────────────┤
│                                                               │
│        Your copy is a build artifact, not a project.          │  h1, 56/60, max 16ch/line
│        Translations that live in Git, open pull requests,     │  sub, 20px, muted
│        and never bill you by the word.                        │
│                                                               │
│        ┌─────────────────────────────────────────┬────────┐   │
│        │ $ npx @localize-infra/cli init          │ ◈ Copy │   │  ← THE primary action
│        └─────────────────────────────────────────┴────────┘   │
│                                                               │
│        → See a real pull request                              │  ← links to live merged PR
│                                                               │
├───────────────────────────────────────────────────────────────┤
│  §1  THE PULL REQUEST — real rendered diff, locales/de.json   │  proof, not claim
├───────────────────────────────────────────────────────────────┤
│  §2  CANCEL AND KEEP EVERYTHING                               │
│      split: [ terminal: git pull ] [ prose: Git is master ]   │
├───────────────────────────────────────────────────────────────┤
│  §3  IT TELLS YOU WHEN IT DOESN'T KNOW      ← uncopyable      │
│      verbatim ambiguity card, real escalation reason          │
├───────────────────────────────────────────────────────────────┤
│  §4  PRICING, IN FULL — 4 cards + the pledge:                 │
│      "We never count words, characters, keys, or seats."      │
├───────────────────────────────────────────────────────────────┤
│  §5  BENCHMARKS INCLUDING WHERE WE LOSE  →                    │
├───────────────────────────────────────────────────────────────┤
│  §6  SUB-PROCESSORS & RESIDENCY  →        ← removes a call    │
└───────────────────────────────────────────────────────────────┘
```

**Hierarchy:** command > proof > pricing > trust. **Primary action:** copy the command. **Secondary:** see a real PR. **Banned:** carousel, unearned logo wall, self-opening chat, animation that delays the copy button.

**Responsive:** <768 → single column, command block full-width and still one-tap copyable, nav → sheet. The command must never require horizontal scroll.

---

## 3. Home — `/~/` and `/{org}`

Answers exactly one question: *is anything waiting for me?*

```
┌─────────────────────────────────────────────────────────┐
│  Good morning, Maya                                     │  32px
│                                                         │
│  ┌───────────────────────┐ ┌───────────────────────┐   │
│  │ ⚠  12 need a decision │ │ ⤴  3 suggestions      │   │  ← only actionable cards
│  │    web-app · 8        │ │    from Inès          │   │
│  │    mobile  · 4        │ │                       │   │
│  │           [Resolve →] │ │           [Review →]  │   │
│  └───────────────────────┘ └───────────────────────┘   │
│                                                         │
│  RECENT RUNS                                            │
│  ┌─────────────────────────────────────────────────┐   │
│  │ ✓ web-app   5 locales   PR #142 merged   2h ago │   │  44px rows
│  │ ⚠ mobile    4/5 ok · ja failed           1d ago │   │  ← icon + text, not color alone
│  │ ✓ web-app   5 locales   PR #141 merged   2d ago │   │
│  └─────────────────────────────────────────────────┘   │
│  All runs →                                             │
└─────────────────────────────────────────────────────────┘
```

**Deliberately absent:** words-translated counters, activity graphs, streaks, "team velocity." Those lead to a usage meter (invariant #3) and to optimizing for logins rather than merged PRs.

**Empty state:** the `npx` command, not a "Create project" button — the CLI is the real entry point.

---

## 4. Ambiguity queue — `/{org}/{project}/ambiguity` ⌨

**The differentiating screen.** A throughput instrument. Optimized for keystroke latency, not beauty.

```
┌─────────────────────────────────────────────────────────────────────┐
│  Ambiguity · web-app                              12 remaining      │
│  ▓▓▓▓▓▓░░░░░░░░░░  6 of 18 resolved today                           │
├──────────────────────────────┬──────────────────────────────────────┤
│                              │                                      │
│  "Close"                     │   ┌────────────────────────────┐    │
│  src/components/Modal.tsx    │   │                            │    │
│                              │   │   [component screenshot]   │    │  ← M3 context
│  ⚠ Why we stopped:           │   │                            │    │
│  This can be a verb (dismiss)│   │   ┌──────────────┐         │    │
│  or an adjective (nearby).   │   │   │  Settings  ✕ │         │    │
│  German requires different   │   │   │              │         │    │
│  words: Schließen vs. Nah.   │   │   │    [Close]   │  ←here  │    │
│                              │   │   └──────────────┘         │    │
│  ─────────────────────────   │   └────────────────────────────┘    │
│                              │                                      │
│  1  Schließen   (dismiss)    │   Surrounding code:                  │
│  2  Nah         (nearby)     │   <Button onClick={onDismiss}>       │
│  3  Beenden     (end/finish) │     Close                            │
│                              │   </Button>                          │
│  E  Write your own           │                                      │
│  C  Add context (don't ask   │                                      │
│     me this again)           │                                      │
│  S  Skip                     │                                      │
│                              │                                      │
├──────────────────────────────┴──────────────────────────────────────┤
│  1–9 choose · E edit · C context · S skip · ⌘Z undo · J/K move       │  persistent hint bar
└─────────────────────────────────────────────────────────────────────┘
```

**Layout:** 40/60 split ≥1280. Decision column left (where the eye starts, where the keys act), context right. **Zero mouse required.**

**Behavioral contract:** keystroke → next item < 100ms, optimistic and local-first. **A resolved item is never asked again** (roadmap M4 exit criterion). `⌘Z` must exist — throughput without forgiveness is hostile.

**Empty state is the goal state and reads as success:**
```
        ✓  Nothing ambiguous.
           1,204 strings translated with confidence.
           See per-language quality →
```

**Responsive:** <1024 context stacks above options; keyboard hints become a collapsible sheet. **Never** shown on <768 in decision mode — a mis-keyed decision on a phone is worse than no decision.

---

## 5. Non-developer review — `/{org}/{project}/review`

Inès. Zero jargon. Vocabulary rules from UX §6 are enforced here.

```
┌───────────────────────────────────────────────────────────┐
│  Review German                          3 of 12           │
├───────────────────────────────────────────────────────────┤
│                                                           │
│   Appears on:  Checkout · confirmation button             │  ← screen, not file path
│                                                           │
│   ┌─────────────────────────────────────────────────┐    │
│   │              [ screenshot with the ]            │    │
│   │              [ string highlighted  ]            │    │
│   └─────────────────────────────────────────────────┘    │
│                                                           │
│   English    Complete your order                          │
│                                                           │
│   German     ▭ Schließen Sie Ihre Bestellung ab      │   │  ← plain textarea
│                                                           │
│              ▬ Save suggestion       Skip                 │
│                                                           │
│   ⓘ A developer reviews this before it ships.            │
└───────────────────────────────────────────────────────────┘
```

**Never rendered on this screen:** key, file path, JSON, branch, commit, "pull request," raw locale codes. **Primary action:** Save suggestion. Suggestions batch into a PR; they are never direct writes (preserves invariant #1 and prevents a marketer shipping a syntax error).

**Responsive:** fully usable at <768 — this is the one surface designed mobile-first, because Inès reviews from a phone.

---

## 6. Project overview — `/{org}/{project}`

```
┌──────────────────────────────────────────────────────────┐
│  web-app                          ◈ github.com/acme/web ↗│
│  Next.js · locales/                                      │
├──────────────────────────────────────────────────────────┤
│  ⚠ 8 need a decision                        [Resolve →]  │  ← only if >0
├──────────────────────────────────────────────────────────┤
│  LOCALES                                     [Manage]    │
│  ┌────────────────────────────────────────────────────┐ │
│  │ de  German      1,204 keys   ✓ current             │ │
│  │ ja  Japanese    1,204 keys   ✓ current             │ │
│  │ ar  Arabic      1,180 keys   ⚠ 24 missing          │ │  ← icon + text
│  │ pt-BR Portuguese  1,204      ✓ current             │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  RECENT RUNS                              All runs →     │
│  ┌────────────────────────────────────────────────────┐ │
│  │ ✓ 5 locales    PR #142 merged ↗       2h ago       │ │
│  │ ⚠ 4/5 · ja failed                     1d ago       │ │
│  └────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

Note "1,204 keys" is a **health indicator, not a meter** — it never appears near price and never aggregates across projects into a billable total.

---

## 7. Run detail — `/{org}/{project}/runs/{id}`

The screen that earns its existence: this data lives nowhere else.

```
┌──────────────────────────────────────────────────────────┐
│  Run · 2h ago · triggered by CLI (maya@acme)             │
│  ✓ PR #142 opened ↗    22s    5 locales    3 keys        │
├──────────────────────────────────────────────────────────┤
│  ✓ de   3 keys                                     4.1s  │
│  ✓ ja   3 keys                                     3.8s  │
│  ✓ es   3 keys                                     4.4s  │
│  ⚠ ar   0 keys · provider error 502                5.0s  │  ← expandable
│    └ "OpenAI API error 401: invalid_api_key"             │
│       [What does this mean?] [Retry this locale]         │
│  ✓ pt-BR 3 keys                                    4.2s  │
├──────────────────────────────────────────────────────────┤
│  2 strings not translated (missingKeys)         [Show]   │  ← never silently hidden
└──────────────────────────────────────────────────────────┘
```

Failures are expandable, explained in plain English, and individually retryable. `missingKeys` is always surfaced (invariant #4).

---

## 8. Connect a project — `/~/new`

The web path is **secondary** and says so.

```
┌──────────────────────────────────────────────────────┐
│  Connect a project                                   │
│                                                      │
│  ┌────────────────────────────────────────────────┐ │
│  │ Fastest: run this in your repo                 │ │  ← primary, visually dominant
│  │ ┌──────────────────────────────────┬────────┐  │ │
│  │ │ $ npx @localize-infra/cli init   │ ◈ Copy │  │ │
│  │ └──────────────────────────────────┴────────┘  │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
│  ── or connect from here ──                          │  ← secondary, muted
│                                                      │
│  ▭ Search repositories…                              │
│  ┌────────────────────────────────────────────────┐ │
│  │ ◈ acme/web-app        Next.js       [Connect]  │ │
│  │ ◈ acme/mobile         React Native  [Connect]  │ │
│  │ ◈ acme/legacy-php     unsupported   ⓘ          │ │
│  │ ◈ acme/internal-tool  installed, not authorized│ │  ← the Task 6 failure, as a state
│  │                       [Configure access ↗]     │ │
│  └────────────────────────────────────────────────┘ │
│  Repository missing? [Configure GitHub App ↗]        │
└──────────────────────────────────────────────────────┘
```

**"Installed but not authorized" is a first-class state** with its own fix — this exact condition broke live validation and will hit every user with a "selected repositories" install.

---

## 9. Billing — `/{org}/settings/billing`

A marketing asset. **No usage meter anywhere.**

```
┌────────────────────────────────────────────────────────────┐
│  Billing — Acme                                            │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  Team · $99/month                    [Change plan]   │ │
│  │  5 private projects · 10 active locales              │ │
│  │  Unlimited strings. Unlimited seats.                 │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  We don't count words, characters, keys, or seats.   │ │  ← the pledge, on the page
│  │  Your bill doesn't change when your product grows.   │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  USING          3 of 5 private projects                    │  ← settings, not consumption
│                 6 of 10 active locales     [Manage]        │
│                                                            │
│  PAYMENT        •••• 4242                     [Update]     │
│  INVOICES       Aug 2026  $99  [PDF]                       │
└────────────────────────────────────────────────────────────┘
```

Plan comparison is a **table, not cards**, at this stage — the user already bought; they need to compare, not be sold. No calculator, no estimator, no "you used X% of…" gauge.

---

## 10. Members — `/{org}/settings/members`

```
┌────────────────────────────────────────────────────────────┐
│  Members — Acme                              [Invite]      │
│  ▭ Search…                    Role: [All ▾]                │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ ◯ Maya Chen     maya@acme.com    Owner       ···     │ │
│  │ ◯ Tomás Silva   tomas@acme.com   Admin       ···     │ │
│  │ ◯ Inès Roy      ines@acme.com    Reviewer    ···     │ │  ← magic-link, no GitHub
│  │ ◯ Wolfgang B.   wolf@ext.de      Reviewer    ···     │ │
│  └──────────────────────────────────────────────────────┘ │
│  ⓘ Seats are unlimited and free on every plan.            │
└────────────────────────────────────────────────────────────┘
```

The seat note is deliberate: it removes the hesitation that stops Maya inviting Inès, which is the growth mechanic.

---

## 11. Public benchmarks — `/benchmarks`

Unique in the category. Must show losses prominently or it is worthless.

**⚠ Data reality check.** Sprint 0 built the eval harness, but **the human evaluation was never run** — no evaluators were recruited, so no preference data exists. The only defensible numbers today are the deterministic ones. This page therefore ships in two stages.

**Stage 1 — what we can honestly publish now:**

```
+---------------------------------------------------------+
|  Translation quality, measured                          |
|  Corpus: 414 real strings from 5 OSS projects. Method > |
|                                                         |
|  MECHANICAL CORRECTNESS            verified every build |
|  +---------------------------------------------------+ |
|  | Placeholder & ICU integrity   100%  (413/413)  CI | |
|  | Plural categories per locale  pass             CI | |
|  | Length-constraint overflow    pass             CI | |
|  +---------------------------------------------------+ |
|                                                         |
|  HUMAN PREFERENCE                                       |
|  +---------------------------------------------------+ |
|  | Not yet measured. 15 native evaluators are being  | |
|  | recruited across de/ja/es/ar/pt-BR. Results will  | |
|  | be published here - including the languages where | |
|  | we lose.                                          | |
|  +---------------------------------------------------+ |
+---------------------------------------------------------+
```

Publishing "we have not measured this yet" is itself the differentiated move. Every competitor asserts accuracy without evidence; saying *not yet measured* is more credible than a number we cannot source, and it publicly pre-commits us to publishing losses.

**Stage 2 — once human evaluation runs:** per-language horizontal bars (design system §4.11), with losing languages labelled inline rather than buried at the bottom of a descending sort.

**Hard rule: no illustrative or placeholder numbers ever ship on this page.** A fabricated benchmark on the one page whose entire purpose is honesty would destroy the exact asset it exists to build.

---

## 12. Remaining screens (compact specs)

| Screen | Layout | Primary action | Notes |
|---|---|---|---|
| **API keys** | table: name · scope · last used · created | Create key | Value shown **once**, copy-once dialog, revoke inline |
| **Audit log** | dense table + filters (actor/action/date), URL state | Export CSV | Append-only; virtualized ≥1k rows |
| **Installations** | list of GitHub App installs + repo access | Configure ↗ | Surfaces "selected repositories" scope explicitly |
| **Locales** | table: locale · keys · status · added | Add locale | Warns when a change affects price |
| **Project settings** | 560px form column, grouped sections | Save (sticky) | Danger zone last, type-to-confirm |
| **Profile** | 560px form | Save | Sessions & devices list with revoke |
| **Notifications** | matrix: event × channel (email/Slack) | Save | Default: only "a human is blocked" events |
| **Docs / Help** | 3-col: nav · prose 720px · on-page TOC | — | Public, indexable, no login |
| **Security** | prose 720px | — | Sub-processors table, residency, retention |
| **Command palette** | centered overlay 640×420, list | — | Fuzzy, recents-first, `>` actions `#` projects |
| **404 / 500** | centered 480px | Go home | Names what broke and what to do |

---

## 13. State patterns (applied to every screen above)

**Loading:** skeletons matching final geometry — never spinners for content, never layout shift. Tables render header + N skeleton rows at true row height.

**Empty:** every empty state names the next action. Positive framing where the empty state *is* the goal (ambiguity, failed runs).

**Error:** inline (field) → section (retry in place) → page (what broke, what to do, status link). Never a raw stack trace or bare code.

**Success:** quiet. The merged PR in GitHub is the real signal. Toasts ≤ 4s, non-blocking, never confirm the obvious.

**Offline:** persistent banner; cached read-only; queued ambiguity decisions replay on reconnect.

**Destructive:** type-to-confirm. **Delete-account shows what you keep** — repo and translations — because that is the product's central claim and this is the moment it is proven.

---

## 14. Responsive summary

| Screen | ≥1280 | 768–1023 | <768 |
|---|---|---|---|
| Landing | full | stacked | single col, command tappable |
| Home | 2-col cards | stacked | stacked |
| **Ambiguity** | 40/60 split | context above | **read-only** (no deciding) |
| **Review (Inès)** | centered 720 | centered | **fully usable — mobile-first** |
| Tables | full | horizontal scroll w/ sticky first col | card list |
| Settings forms | 560 col | full width | full width |
| Sidebar | persistent | icons | sheet |

The two deliberate asymmetries: the ambiguity queue refuses phone *decisions* (mis-keying is worse than deferring), while the non-dev review surface is designed phone-first (Inès is on a phone).
