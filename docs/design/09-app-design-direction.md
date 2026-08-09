# Application Design Direction

Date: 2026-08-08
Depends on: `05-design-system.md`, `02-ux-and-flows.md`, `03-information-architecture.md`
Supersedes nothing. Extends the design system to the application surface.

---

## 0. What the audit found

Read before the direction, because the direction answers these.

**The marketing site is a product. The application is a scaffold.** `apps/site`
has editorial hierarchy, considered measure, real density. `apps/web` renders a
page title and one dashed box in a 1200px column, leaving ~70% of a 1440px
viewport empty on every route. Six of seven routes are `UnbuiltPage`.

**There is no type scale.** 15 distinct hardcoded pixel sizes across 256
occurrences (`text-[14px]` ×82, `text-[13px]` ×48, `text-[12px]` ×43,
`text-[15px]` ×35 …). 13/14/15px all in heavy use is the signature of accretion,
not a system. This is the single largest systemic defect: nothing prevents the
next component from inventing a sixteenth size.

**One typeface does every job.** Inter for interface *and* display. The design
system's argument for Inter as the UI face is sound (optical sizing, small-size
legibility, script coverage) and stays. But using it at 40px for display too is
the default every AI-generated SaaS makes, and it is why the app reads as
generic even though the token system underneath is not.

**The token architecture is genuinely good and stays.** Three layers, colour
reserved for meaning, a distinct dark scale rather than an inversion, Iris
reserved for ambiguity alone, primary buttons in Graphite so nothing competes
with the state signal. Contrast is CI-verified. This is better than most
commercial design systems and none of it needs rework.

**Density is wrong for the audience.** Infrastructure users read dense
information — Linear, Vercel, GitHub, Datadog are all information-dense. Our
44px comfortable rows and 32px section gaps are right; the *page* around them is
not, because it has nothing in it.

---

## 1. Positioning and target user

Localization infrastructure for teams who keep their strings in Git. The
terminal and the pull request are the product; the web application exists for
the two things neither can do.

| | Who | Comes here for | Device |
|---|---|---|---|
| **P1** | Maya, senior frontend engineer | Judgement calls the agent escalated | Desktop, keyboard-first |
| **P2** | Inès, content/marketing, non-technical | Reviewing suggested copy | **Phone**, often |
| **P3** | Tomás, engineering manager | The truth about what ran and what is stale | Desktop, scanning |

Maya is the design target for density and keyboard behaviour. Inès is the design
target for the review surface specifically, which is why that one surface is
designed mobile-first while the rest are desktop-first.

**Not the target:** anyone who wants a dashboard to look at daily. This product
wants merged pull requests, not daily active users. No engagement surfaces, no
vanity metrics, no activity feed.

## 2. Core user journeys

**J1 — Unblock (the differentiator).** A run escalated a string the agent would
not guess at. Maya opens the app, sees exactly what is blocked, reads the string
in its source context, chooses, and the PR unblocks. Target: under 30 seconds
from open to decision, keyboard-only.

**J2 — Review without jargon.** Inès receives a link, reads suggested copy in
her language beside the English, approves or edits. Zero mention of keys,
branches, or ICU. Works on a phone.

**J3 — Establish truth.** Tomás answers: what ran, what failed, which locales
are stale, what is waiting on a human. Scannable, no drilling.

Every surface below serves one of these three or supports them. A surface that
serves none does not ship.

## 3. Information architecture

Flat until organisations exist. `/{org}/{project}` scoping from
`03-information-architecture.md` §2 remains the target and is deliberately not
implemented yet — there are no orgs, and inventing a slug would be inventing
data.

```
/                Home — what needs me
/ambiguity       The escalation queue          ← J1, the differentiator
/review          Non-developer approval        ← J2
/runs            History; /runs/{id} detail    ← J3
/locales         Coverage per language         ← J3
/settings        Account, project, danger
/design          The design system itself
```

## 4. Navigation model

Unchanged in structure — the audit found it correct — refined in execution.

- **Sidebar 240px**, persistent ≥1024, a leading-edge sheet below.
- **Topbar 48px**: breadcrumb, ⌘K, theme.
- **⌘K is the primary navigation for P1** and gains actions, not just routes.
- **Two badges maximum, ever**: ambiguity count and pending review. Both mean *a
  human is blocked*. No badge on Runs — that would be engagement bait.

**Change:** the sidebar gains section labels and the ambiguity/review counts,
because a navigation that cannot tell you where the work is has failed at its
one job. Counts only render with real or explicitly-sampled data.

## 5. Desktop / tablet / mobile

| Tier | Sidebar | Content | Tables |
|---|---|---|---|
| ≥1280 | 240px persistent | up to 1200px, two-column where content earns it | full |
| 1024–1279 | 240px persistent | single column | full, horizontal scroll in-container |
| 768–1023 | sheet | single column, 24px gutter | description column folds into row header |
| <768 | sheet | single column, 16px gutter | folded; numbers stay visible |

Review is the exception: designed for <768 first and allowed to be less dense on
desktop, because Inès reviews from a phone.

## 6. Visual hierarchy

The string is the hero. In priority order on any data surface:

1. **The user's copy** — largest text on the screen after the page title
2. **Its state** — the State Rule, plus a text label; never colour alone
3. **Where it came from** — file path, in mono, tertiary
4. **Chrome** — recedes to near-neutral

A page has exactly one `h1`, one primary action, and no more than two visual
weights competing above the fold.

## 7. Typography system — the main change

**Three roles, three families, one named scale.**

| Role | Family | Used for |
|---|---|---|
| Display | **Archivo** | Page titles, marketing display, numerals in stat positions |
| Interface | **Inter** | Everything else in the UI |
| Data | **JetBrains Mono** | Keys, paths, ICU, counts, shortcuts |
| Scripts | Noto Sans JP / Arabic | Translated copy only, per its own locale |

Archivo is an engineered grotesque with tighter apertures and more structure
than Inter at display sizes. Pairing it with Inter gives the deliberate
display/body separation the house rules require, while keeping Inter — which is
genuinely the right UI face here — for the dense work. It is not a serif
revival, not a geometric humanist, and not Inter-at-40px.

**The named scale replaces all 15 ad-hoc sizes.** Tokens, not arbitrary pixels.

Eleven steps across two registers. The application uses the first eight and is
forbidden the last three; the marketing site may use all eleven.

**Shared — the application register (8):**

| Token | Size / line | Role |
|---|---|---|
| `display-lg` | 40 / 1.05 | Largest title an app surface may use |
| `display` | 28 / 1.15 | Page title |
| `title` | 20 / 1.3 | Section heading |
| `subtitle` | 16 / 1.5 | Card title, small heading |
| `body` | 14 / 1.5 | Default |
| `small` | 13 / 1.5 | Secondary, help |
| `caption` | 12 / 1.35 | Labels, table headers, meta |
| `micro` | 11 / 1.3 | Chips, shortcuts |

**Editorial — `apps/site` only (3):**

| Token | Size / line | Role |
|---|---|---|
| `display-xl` | 52 / 1.02 | The landing hero, and nothing else |
| `headline` | 24 / 1.25 | Section heading on a marketing page |
| `prose` | 17 / 1.65 | Long-form body copy |

The split is the type-level expression of §20: one system, two registers. A
52px hero or a 1.65 prose measure on a data surface would be the site's voice
in the wrong room, so the boundary is enforced in both directions — a test
fails on an ad-hoc pixel size anywhere, and on an editorial step appearing
inside `apps/web`.

The editorial steps exist because the site had the same disease as the app in
its own dialect: section headings at 22px, 26px and 28px doing one job, and
body copy at 15px, 17px and 18px doing another. `headline` and `prose` each
collapse three sizes into one decision. Prose moved 15 → 17 rather than being
held at its old size: 15px is small for marketing copy, and the 1.87 line
height it carried was compensating for that.

Anything not on the scale is a defect, and a test enforces it.

## 8. Colour system

**Unchanged.** The audit found no reason to touch it and several to protect it.
Iris stays reserved for ambiguity; primary actions stay Graphite.

**One addition:** a `demo` treatment for sample data (§13). It deliberately uses
*no* state hue — it must never be confused with a confidence signal — and is
expressed as a dashed border plus a persistent label.

## 9. Spacing and density

8px base retained. The page changes:

- Page gutter 24px (16px <768), content max 1200px — retained.
- **Page header becomes a real component**: title, one-line purpose, metadata
  row, primary action, all on one band with a bottom rule. Currently a bare `h1`
  floating in whitespace.
- Section gap 32px; card padding 16px (was 20px — 20 is generous for a dense
  product).
- Table rows 44 comfortable / 36 dense — retained, verified working.

## 10. Border, radius, surface

Borders do the work; shadows are for overlays only. Radius scale tightens by one
step at the top — 14px reads consumer-soft on a data surface:

`sm 4` (chips, inline) · `md 6` (controls, inputs) · `lg 8` (cards, panels) ·
`xl 12` (dialogs, sheets only).

Surfaces: `canvas` for the page, `surface` for the sidebar and inset bands,
`raised` for cards on `surface`. Never more than two surface steps on one screen.

## 11. Iconography

Lucide, 16px in UI, 1.5 stroke. Icons never appear alone on an interactive
control without an accessible name. No icon in body copy. No decorative icons —
if it does not disambiguate, it does not ship.

## 12. Motion strategy

Retained wholesale — the existing rules are correct and CI-enforced. Transform
and opacity only, nothing over 200ms, everything killed under
`prefers-reduced-motion`.

**One addition, earning its place:** when an ambiguity is resolved, the row
collapses with a 150ms height/opacity transition rather than vanishing. The
queue getting visibly shorter is the feedback that the work is done. That is the
only new motion in this direction.

## 13. Empty, loading, error, success — and sample

Four existing states retained (`EmptyState`, `SkeletonTableRows`, `ErrorState`,
inline success). One new state, and it is the most important decision here.

**The sample-data contract.** Six routes have no backend. The rules are: design
the final UX, never present invented data as real, and distinguish unavailable
from real. Placeholder pages satisfy the second and third and abandon the first.

So each surface renders its **real, final interface, populated with data that is
labelled as sample at three levels simultaneously**:

1. A non-dismissible banner above the content naming exactly what is sample and
   what would be real.
2. A `Sample` chip in the breadcrumb, present on every sample route.
3. Sample regions carry a dashed leading edge — visually distinct from the solid
   State Rule, so a sample row can never be mistaken for a real one.

Sample datasets live in `apps/web/src/lib/sample/`, typed against the same
contracts the real API will return, so swapping to live data is a data-source
change and not a redesign. Every file in that directory says so at the top.

This is not a loophole in the honesty principle — it is the principle applied
one level up. The lie the project forbids is *invented data presented as real*.
An interface that shows its intended shape, labelled three times as sample, is
the opposite of that.

## 14. Command palette

Sections in this order: **Navigation · Actions · Help**. Recents is absent
because nothing persists a history yet, and a section that is always empty is
worse than one that does not exist.

**Every entry runs.** That constraint decides the contents, not a wish list.
Actions are the three theme commands; Help opens the documentation, the
repository and a real example pull request. Extraction, translation, opening a
pull request, resolving an ambiguity and approving a suggestion are all absent
and stay absent until there is a backend — a palette that offers a command it
cannot perform is worse than one that offers fewer, and a test asserts none of
them appear.

Shipping theme here required fixing a real coherence bug first. Two surfaces
can now set the preference, and `ThemeToggle` read `localStorage` once on
mount, so a change made from the palette left its radio showing the previous
value until a reload. The theme module now owns a single `setTheme` that
persists, applies and announces, with `subscribeToTheme` for anything that
displays the preference. Both surfaces go through it.

`⌘K` toggles, `↑↓` move, `Enter` runs, `Esc` restores focus to the opener. Empty
query lists everything.

`⌘K` toggles, `↑↓` move, `Enter` runs, `Esc` restores focus to the opener. Empty
query lists everything. All verified by existing tests, which stay green.

## 15. Tables, string review, translation workflow

The workflow the UI must make legible:

```
repository → source strings → locales → extraction → translation
   → ambiguity → human review → approval → pull request → runs
```

**Design consequence:** every data surface answers "where am I in that pipeline
and what is blocked?" The String Card is the atom throughout — the same
component in the ambiguity queue, the review surface, and run detail — so the
user learns one object and recognises it everywhere.

Tables: no zebra (it fights the State Rule), sticky header, sortable with
explicit direction icons and `aria-sort`, empty state inside the body, numeric
columns right-aligned and tabular. All already correct; retained.

## 16. Home and runs

**Home** answers one question: *is anything waiting for me?* Not a dashboard.
Two blocked-work cards (ambiguity, review) and a recent-runs list. If nothing is
blocked, it says so plainly and does not manufacture a metric.

**Runs** is a table: status, project, locales, duration, PR link, when. Status
carries icon and text, never colour alone. The whole row is a link to detail,
with one focus stop and an accessible name that says which run — the trigger
column repeats `localize-infra init` down the page. No chart: a run history
chart would be decoration; the table is the information.

**Run detail** opens with the pipeline, because a run is not an event with a
status — it is a walk through detect → extract → translate → escalate → open a
pull request, and it can stop or degrade at any step. Drawing the stages puts
the failure *where it happened* instead of as a red badge at the top, and makes
the product's workflow legible on the one screen where the reader already cares
about it. It is an ordered list because the content genuinely is a sequence,
which is the only thing that justifies numbering.

Below it: one row per target language with what it produced, then failures with
the provider's message reproduced verbatim. Paraphrasing that message destroys
its only use, which is being searchable. A stage that never ran says so rather
than rendering an empty success, and an unknown run id is a 404 rather than a
page pretending the run exists.

## 17. Ambiguity

The differentiator, and the surface that gets the most design attention.

A queue of String Cards with the Iris rule. Each shows: the source string, its
file and component, why the agent escalated, and the candidate readings as
selectable options. Choosing one resolves it; the row collapses. `j`/`k` move,
`1`–`9` pick a candidate, `Enter` confirms. Keyboard-complete because P1 will
process these in batches.

## 18. Locales and projects

**Locales**: one row per language — name, code, coverage, strings translated,
last run, state. Coverage is a number and a bar; the bar is secondary. Arabic and
Japanese render in their own scripts, which is the product demonstrating its own
competence.

**Projects** do not exist as an entity yet and are not invented. The sidebar has
no project switcher until there is more than one project to switch between.

## 19. Settings

Three sections, URL-addressable: Configuration, Account, Danger zone. They are
links rather than an ARIA tab widget — the sections survive a reload, can be
linked to, and need no JavaScript, which a tab widget would require for roving
focus and gain nothing by.

**Settings takes no sample data, and this is the one surface where that rule
differs.** Everywhere else the content is *data*, and labelled sample data
demonstrates its shape honestly. Here the content is *controls*, and a control
that silently fails to save is a worse lie than an empty section: it invites an
action and swallows it.

But configuration does exist today — it lives in flags and environment
variables, and getting it wrong is the most common way a first run fails. So
**Configuration reports the CLI's real effective settings read-only**: target
locales, locale directory, API URL, token variable, pull-request flags, base
branch, and the framework-detection signals. Each value sits beside the exact
flag or variable that changes it. Nothing claims to be editable from the
browser, because nothing is.

Those values are duplicated from `packages/cli` and `packages/core` — the web
app cannot import a Node CLI's module-private constants without dragging its
dependency tree into a browser bundle — so a test in `packages/schemas` pins
them to their source. A default changed in the CLI and not here would make the
one surface claiming to be real into the most confidently wrong page in the
product.

**Account** and **Danger zone** stay genuinely unavailable, because they depend
on accounts and projects that do not exist. When they arrive, destructive
actions will require typing the resource name and state their consequence in
plain language, and forms will use the existing `Field` column at 560px.

## 20. Marketing site ↔ application

One design system, two registers. The site is editorial: wider measure, display
type, longer prose, argumentative. The app is operational: dense, quiet, fast.
They share tokens, primitives, State Rule, and voice — a visitor moving from
`/pricing` to the app should feel the same hand without the app trying to sell.

The site keeps `'unsafe-inline'` CSP and static generation; the app keeps
per-request nonces and dynamic rendering. Documented in both configs.

---

## Per-surface specification

| Surface | Primary goal | Primary action | States |
|---|---|---|---|
| Home | Is anything waiting for me? | Open the blocked queue | sample · empty (nothing blocked) · error |
| Ambiguity | Resolve escalations | Choose a reading | sample · empty (queue clear) · loading · error |
| Review | Approve suggested copy | Approve / edit | sample · empty · loading |
| Runs | What ran, what failed | Open run detail | sample · empty · loading · error |
| Locales | Which languages are behind | Open a locale | sample · empty |
| Settings | Know how it is configured | — (read-only) | real config · unavailable per section |
| Design | Verify the system | — | live, real |

## Verdict on the existing implementation

**A — stays unchanged.** Token architecture (3 layers, semantic aliases, dark
scale). Colour semantics and Iris reservation. State Rule. Motion rules and
reduced-motion handling. Command palette behaviour and ARIA. Table semantics.
`Field` accessibility contract. Locale/script font routing. The whole of
`apps/site`.

**B — refined.** Sidebar (section labels, counts). Topbar (breadcrumb density,
theme control demoted on mobile). Card padding 20→16. Radius top step 14→12.
`EmptyState` (currently only used inside a table). Page container (gains a real
header component).

**C — redesigned.** All six `UnbuiltPage` routes become their real interfaces
with sample data. Typography moves to a named scale with a display face. Home
becomes a blocked-work surface rather than a placeholder.

**D — removed.** `UnbuiltPage` as the default answer to "no backend" — retained
only for Settings, where there is genuinely nothing to demonstrate. The bare
`h1`-in-whitespace page pattern. The 15 ad-hoc type sizes.
