# Information Architecture

Date: 2026-08-06
Depends on: `01-prd.md`, `02-ux-and-flows.md`

---

## 1. Entity model

The IA follows from one decision: **a Project is a repository plus a path.**

Rationale: monorepos are common in the target segment, and one repo can legitimately contain several apps with separate `locales/` directories. Repo-only would make monorepo users unable to separate concerns; path-only would fragment billing. **Price is per repo** (so a monorepo with three apps is one paid project), while configuration is per path. This resolves PRD open question #2.

```
Account (person)
 └── memberships → Organization (billing + permission boundary)
                    ├── GitHubInstallation (0..n)   ← an org may install on personal + org accounts
                    ├── Project (0..n)              ← repo + path; the priced unit is the repo
                    │    ├── ActiveLocale (1..n)    ← the second price axis
                    │    ├── Run (0..n)             ← one CLI/CI invocation
                    │    │    └── LocaleOutcome (per locale: ok | failed | missingKeys)
                    │    ├── AmbiguityItem (0..n)
                    │    │    └── Decision (0..1)   ← persisted; never re-asked
                    │    └── Suggestion (0..n)      ← from non-dev reviewers, batched into PRs
                    ├── Member (1..n) → Role
                    ├── ApiKey (0..n)
                    └── AuditEvent (append-only)
```

**What is deliberately absent from this model, and must stay absent:**

- **Translations themselves.** They live in Git. Postgres stores a *cache* keyed by content hash, disposable at any time. Invariant #1 is enforceable by a test: drop the database, run the CLI, everything recovers from customer repos. If a `translations` table with authority ever appears in a migration, the product has changed identity.
- **Word/character/key counters.** Not stored, not computed, not displayed. A counter that exists is a counter that gets billed (invariant #3).
- **Assignments, due dates, workloads.** That is project management — an explicit non-goal.

**Every org has exactly one billing subject.** Personal accounts get an implicit personal org, hidden in the UI until a second member or project appears. Users should never learn the word "organization" to localize one app.

---

## 2. URL structure

Mirrors GitHub's mental model deliberately — the audience already has it loaded.

```
/                              landing (public)
/pricing  /docs  /benchmarks  /security  /status      public, indexable
/login  /auth/device  /auth/callback

/~/                            personal home: "what needs me?"
/~/new                         connect a project (secondary to the CLI)
/~/settings/{profile,sessions,notifications}

/{org}                         org home
/{org}/settings/{general,members,installations,api-keys,audit,billing}

/{org}/{project}               project overview
/{org}/{project}/ambiguity     ← J1, the differentiating screen
/{org}/{project}/review        ← J2, non-dev surface
/{org}/{project}/runs          history
/{org}/{project}/runs/{id}     single run detail
/{org}/{project}/locales       active locales (price axis)
/{org}/{project}/settings/{general,paths,glossary,danger}
```

**Rules.** URLs are stable, shareable, and deep-linkable — a teammate pasting `/{org}/{project}/ambiguity?item=123` into Slack must land on that exact item after auth. `/~/` is the personal scope (borrowed convention, avoids colliding with an org named "me"). No IDs in user-facing URLs except where an entity has no natural name (runs, ambiguity items).

---

## 3. Navigation

### Sidebar — persistent, deliberately short

```
┌──────────────────────┐
│ [org switcher     ▾] │  ← org + project switcher, ⌘K-driven
├──────────────────────┤
│ ◈ Home               │
│ ⚠ Ambiguity      12  │  ← count badge; the only badge that earns its place
│ ⤴ Review          3  │  ← visible only if suggestions pending
├──────────────────────┤
│ PROJECTS             │
│   web-app            │
│   mobile             │
│   + Connect          │
├──────────────────────┤
│ ⚙ Settings           │
└──────────────────────┘
```

**Maximum two levels of nesting in the sidebar. Ever.** Deeper hierarchy goes in-page (tabs) or into ⌘K. A sidebar that scrolls is a sidebar that has failed.

**Only two badges exist in the entire product:** ambiguity count and pending suggestions — both meaning *a human is blocked*. Badges for "runs" or "activity" would be engagement bait, and this product does not want daily logins; it wants merged PRs.

### Top bar — minimal

Breadcrumb (left) · ⌘K search (center, always visible, keyboard hint shown) · notifications · avatar menu. **No global "New" button** — creation happens in the terminal, and a prominent web CTA would contradict the product's whole shape.

### Breadcrumbs

`org / project / section`, each segment a switcher rather than a plain link. Truncate from the middle at narrow widths; always keep the last segment. On mobile the breadcrumb collapses to the current segment plus a back affordance.

---

## 4. Settings hierarchy — three separate scopes

Conflating these is the most common IA failure in B2B SaaS; the user must always know *what* they are changing.

| Scope | Path | Contains |
|---|---|---|
| **Personal** | `/~/settings` | profile, sessions & devices (device-auth grants, revocable), notification preferences, theme |
| **Organization** | `/{org}/settings` | general, members & roles, GitHub installations, API keys, audit log, billing |
| **Project** | `/{org}/{project}/settings` | general, monorepo paths, active locales, glossary, danger zone |

Each settings screen states its scope in the heading ("Organization settings — Acme"), because a mis-scoped destructive action is unrecoverable.

---

## 5. Permissions

Five roles. Designed around one economic constraint from the PRD: **seats are unlimited and free**, so `Reviewer` must be genuinely cheap to hand out — it is the growth mechanic (Inès), not a premium add-on.

| Capability | Owner | Admin | Developer | Reviewer | Billing |
|---|:--:|:--:|:--:|:--:|:--:|
| View projects, runs | ✅ | ✅ | ✅ | ✅ | — |
| Run translations / CLI token | ✅ | ✅ | ✅ | — | — |
| **Resolve ambiguity** | ✅ | ✅ | ✅ | ✅ | — |
| **Suggest text edits** | ✅ | ✅ | ✅ | ✅ | — |
| Connect repo / manage installation | ✅ | ✅ | ✅ | — | — |
| Change active locales *(affects price)* | ✅ | ✅ | — | — | — |
| Manage members & roles | ✅ | ✅ | — | — | — |
| API keys | ✅ | ✅ | — | — | — |
| Audit log | ✅ | ✅ | — | — | ✅ |
| Billing & plan | ✅ | — | — | — | ✅ |
| Delete project | ✅ | ✅ | — | — | — |
| Delete / transfer org | ✅ | — | — | — | — |

**Notes.** `Reviewer` is the magic-link persona — no GitHub account required, and can do exactly the two things J2 needs. `Billing` sees invoices and audit but no source strings, which is what finance and procurement actually want. Changing active locales is Admin-gated because it is the one setting that moves the bill.

**Enforcement rule:** every permission is checked server-side per request. UI hiding is a courtesy, never a control. Denied actions explain *which role is required*, so a Reviewer who hits a wall knows exactly what to ask for.

---

## 6. Search

Two distinct mechanisms, deliberately not merged:

- **⌘K palette** — navigation and actions. Fuzzy, recents-first, scoped by `>` (actions) and `#` (projects). This is Maya's primary navigation and the reason the sidebar can stay short.
- **In-page filtering** — runs, members, audit, ambiguity. Filters are URL state (`?locale=de&status=failed`), so a filtered view is shareable and back-button-correct.

**No global full-text search over translations in v1.** The strings live in Git; GitHub code search does this well already, and duplicating it is exactly the "re-render what GitHub renders" mistake §0 of the UX doc forbids.

---

## 7. Scalability

Where each structure breaks, and what happens then:

| Dimension | Breaks at | Response |
|---|---|---|
| Projects per org | ~15 in sidebar | Sidebar shows 5 most recent + "All projects"; ⌘K becomes primary navigation |
| Members | ~50 in a list | Server-side pagination, search, role filter; bulk role change |
| Ambiguity items | ~200 | Queue is one-at-a-time by design and never renders a long list; grouped by string similarity so a repeated pattern is one decision, not fifty |
| Runs | continuous growth | Cursor pagination, retention window by tier, `?from=&to=` filters |
| Audit events | fastest-growing table | Append-only, partitioned by month, exportable, retention by tier |
| Locales | 25 at Scale tier | Table, not tabs, beyond ~8 |
| Orgs per user | rare > 5 | ⌘K switcher, recents-first |

**Structural safeguards.** Every list is paginated server-side from day one — no "load all then filter" anywhere, because the first customer with 10k strings would otherwise discover it in production. Every counted badge has a cap display (`99+`) so a runaway count cannot break layout. Every filter lives in the URL so state is shareable and debuggable.

---

## 8. Public (unauthenticated) surface

Indexable, no login, treated as an acquisition channel rather than an afterthought:

`/` · `/pricing` (full prices, no gate) · `/docs` · **`/benchmarks`** (per-language quality including losses — unique, and the strongest trust asset we have) · **`/security`** (sub-processors, residency, retention — removes a sales call for P5) · `/status` · `/changelog`.

Every one of these must be reachable and readable without an account, because the buyer evaluates before signing up and the current market moment (repriced Phrase/Lokalise customers actively shopping) rewards being easy to evaluate.
