# DESIGN.md

**The single source of truth for the design of Localize Infra.**

Every visual and interaction decision in this repository is settled here. If a
screen needs a value, it comes from this document. If this document does not
have the answer, the answer is added here first and then implemented — never
the other way round.

Supersedes `docs/design/05-design-system.md` and
`docs/design/09-app-design-direction.md`, which remain as the record of how the
system arrived here.

---

## 0. Audit — what this document is fixing

Written after inspecting the rendered product at 390, 768, 1024, 1440 and
1920px. The system underneath is strong; the product on top of it is not
finished. Three findings decide most of what follows.

**The tables are not products.** No filter, no search, no sort, no result
count, no pagination on any data surface. `grep` for an input or a select on
`/runs` or `/locales` returns nothing. A list of three rows that cannot be
narrowed is a mock of a table, not a table. This is the single largest gap
between this product and Linear, GitHub or Vercel, and it is not a visual gap.

**Loading and error states are demonstrated but never shipped.** `Skeleton` and
`ErrorState` appear in `/design` and nowhere else. Every real surface renders
as though data is always present and always succeeds. A developer tool is
judged on how it behaves when things are slow or broken, and ours has no
opinion about either.

**Typography does not respond.** Zero `sm:text-*` in the application. The page
title is 28px at 390 and 28px at 1920. At 1920 the content locks to 1200px and
roughly 55% of the viewport is empty, with no compensating density, context or
detail.

Preserved because it is genuinely good: the three-layer token architecture, the
State Rule, the reservation of Iris for ambiguity alone, the sample-data
contract, and the accessibility rigour (axe on every route in both themes,
ARIA ownership, RTL correctness).

---

## 1. Brand and art direction

### 1.1 Personality

Localize Infra is **an instrument, not an assistant.** It is precise, quiet,
and unembarrassed about being technical. It tells you what it did, what it
could not do, and what it is unsure about, in that order.

The nearest cultural reference is not a SaaS dashboard. It is a **build log, a
diff, and a well-made measuring tool.**

### 1.2 What it must feel like

| | |
|---|---|
| **Exact** | Every number is real and traceable. Nothing is rounded to look better. |
| **Quiet** | Chrome recedes. The user's copy is the loudest thing on screen. |
| **Fast** | State is visible immediately. Nothing spins without saying why. |
| **Candid** | Uncertainty is displayed, not hidden. Unbuilt is labelled, not faked. |
| **Dense** | Information-rich without being cramped. A developer reads this for hours. |

### 1.3 What it must never feel like

Consumer-friendly. Playful. Reassuring in a way it has not earned. Marketing-led.
"AI-powered." A dashboard that exists to be looked at. Anything that would be at
home in a startup pitch deck.

### 1.4 Distinctive identity

Three things make this product recognisable, and no future work may dilute them:

1. **The State Rule** — a 3px logical leading-edge rule on any surface carrying
   user copy, coloured by confidence. Used everywhere copy appears. It is the
   signature.
2. **Iris means one thing.** A cool violet reserved *exclusively* for "your
   judgement is required". Never chrome, never a brand accent, never a roadmap
   state, never a logo.
3. **The pipeline as visual language.** Five stages —
   **detect → extract → translate → escalate → pull request** — bounded by your
   repository at one end and locale files at the other. The repository and the
   files are inputs and outputs, not stages; conflating them is how this
   document once listed eight while the application drew five and the marketing
   site named three.

   Defined once, in `PIPELINE_STAGES` (`packages/ui/src/lib/pipeline.ts`), and
   every surface that expresses where a run is takes its names from there.
   Collapsing stages for a smaller surface is a presentation choice; renaming
   or dropping one is not, because the word a reader learns on the landing page
   must be the word they meet in the product. Drawn as connected stages on run
   detail and on the landing page, and pinned by test in both.

---

## 2. Design principles

Ordered. When two conflict, the earlier wins.

1. **Truth over polish.** Real data or an explicitly labelled state. Never a
   convincing fiction.
2. **Precision over decoration.** If an element does not disambiguate, inform,
   or afford an action, it does not ship.
3. **Density without clutter.** Prefer more information per screen, achieved by
   removing chrome rather than shrinking type.
4. **Semantic colour.** Colour is a signal with a fixed meaning. Chrome is
   neutral. A screen with no state on it has no colour on it.
5. **Consistent geometry.** One radius scale, one control height scale, one
   border language. A component that invents its own geometry is a defect.
6. **Keyboard first.** Every action a mouse can perform, a keyboard can perform,
   and the primary ones have shortcuts.
7. **Restrained motion.** Motion clarifies causality or it does not exist.
8. **Progressive disclosure.** Show the answer; put the derivation one
   interaction away.
9. **Reversibility.** Destructive actions are explicit, named, and confirmed by
   typing the resource name.
10. **URL-addressable state.** Filters, tabs, and selections belong in the URL.

---

## 3. Typography

### 3.1 Families

| Role | Family | Used for |
|---|---|---|
| Display | **Archivo** | Page and section titles, marketing display. Never body. |
| Interface | **Inter** | All UI text, prose, labels. |
| Data | **JetBrains Mono** | Keys, paths, ICU, counts, shortcuts, diffs, commands. |
| Script | **Noto Sans JP / Arabic** | Translated copy, in its own locale's stack. |

**Rule:** a translated string always renders in the font stack, `lang` and
`dir` of *its own* locale, never the interface locale. This is not a nicety; it
is the product demonstrating the competence it sells.

### 3.2 Scale — eleven steps, two registers

The application uses the first eight. The marketing site may use all eleven.
Nothing outside them, enforced by test.

| Token | px / line | Register | Role |
|---|---|---|---|
| `display-2xl` | 68 / 0.98 | editorial | Landing hero only |
| `display-xl` | 52 / 1.02 | editorial | Hero at small viewports |
| `display-lg` | 40 / 1.05 | shared | Largest title an app surface may use |
| `display` | 28 / 1.15 | shared | Page title |
| `headline` | 24 / 1.25 | editorial | Marketing section heading |
| `title` | 20 / 1.3 | shared | Section heading |
| `prose` | 17 / 1.65 | editorial | Long-form body copy |
| `subtitle` | 16 / 1.5 | shared | Card title, small heading |
| `body` | 14 / 1.5 | shared | Application default |
| `small` | 13 / 1.5 | shared | Secondary, help |
| `caption` | 12 / 1.35 | shared | Labels, table headers, meta |
| `micro` | 11 / 1.3 | shared | Chips, shortcuts |

### 3.3 Weights and tracking

Only 400, 500, 600. No 700 — at these sizes it reads as shouting on a neutral
ground. Display sizes carry negative tracking (`-0.02em` to `-0.035em`); text
at or below `body` carries none; uppercase labels carry `+0.12em` to `+0.14em`.

### 3.4 Responsive typography — required

**Every step at or above `title` must step down at least once below `lg`.**
A 28px page title on a 390px screen occupies a third of the width; the same
title at 1920 is undersized for the space. Fixed display type is a defect.

| Step | <640 | 640–1023 | ≥1024 |
|---|---|---|---|
| Page title | `title` 20 | `display` 28 | `display` 28 |
| Section | `subtitle` 16 | `title` 20 | `title` 20 |
| Marketing hero | `display-xl` 52 | `display-xl` 52 | `display-2xl` 68 |

Body, small, caption and micro never scale — a 14px row must be 14px.

### 3.5 Hierarchy contrast

A scale with eleven steps is worthless if a surface uses three adjacent ones.
**Where two heading levels appear on the same surface, they must be at least two
steps apart, or separated by weight and colour as well as size.**

The audit found the application running `display` 28 → `title` 20 → `body` 14 —
a 2.0× span from page title to body doing the work of a display hierarchy. That
is not a spacing problem and no amount of padding fixes it. Either the title
takes a larger step, or the levels below it recede in colour and weight so the
ranking is unambiguous.

Corollary: **never** express hierarchy through size alone when the sizes are
close. Weight (500 vs 600), colour (`primary` vs `secondary` vs `tertiary`) and
letter-spacing carry ranking more reliably at these scales than two pixels do.

---

## 4. Layout system

### 4.1 Spacing

8px base. 4px permitted only for optical alignment inside a control. 2px only
for the State Rule and hairlines. **No arbitrary spacing values.**

### 4.2 Containers

| Context | Width |
|---|---|
| Application content | 1200px max, 24px gutter (16px <768) |
| Application wide surfaces (tables, queues) | **1600px max at ≥1680** |
| Marketing content | 1152px max |
| Prose measure | 68ch |
| Form column | 560px |

**Large-viewport rule.** Above 1680px a data surface may widen to 1600px **only
if it is hiding columns at 1440 and reveals them by doing so.** Prose stays at
its measure and gains nothing.

The qualifier is the rule. Widening a table that is already showing every
column does not add information — it pours the slack into the widest column,
which is decoration wearing a layout's clothes. Empty space at 1920 is a real
finding, but where it comes from having three rows rather than three hundred,
it is a data problem and no layout change is the honest fix.

### 4.3 Application shell

240px sidebar (persistent ≥1024, leading-edge sheet below) · 48px topbar ·
content region scrolls independently. The shell never scrolls; only content does.

### 4.4 Section rhythm — marketing

Sections must not share one shape. The page alternates: asymmetric split →
full-bleed inverted band → connected pipeline → full-bleed rail → editorial
rows → status board → centred close. **A page where every section is
heading-then-content is a document, not a composition.**

That prohibition was too vague to enforce and two sections drifted into the
same shape anyway. The testable form:

**No two adjacent sections may share the same structural signature.** A
signature is the tuple *(column split, whether the section is full-bleed,
whether its payload is prose or evidence)*. Commitments and Build status were
both `(4/8 split, contained, prose)` — different content, identical structure,
and the page read as one long list through both.

At least one section in the first three must be **full-bleed and inverted**,
and at least one must carry **evidence rather than prose** — a diff, a table, a
file, real output. A page of seven prose sections is a brochure.

### 4.5 The fold

The first viewport is the only one every visitor sees. It is governed, not
left to whatever the hero happens to produce.

1. **The strongest evidence available goes above the fold.** The audit found
   the reverse: a light, low-contrast abstraction in the hero, with the real
   merged pull request — the product's actual deliverable and its best
   argument — in the section below it.
2. **No dead zone.** In an asymmetric split, the short column's slack is
   composed away (the artifact grows, the columns re-balance, or the section
   shortens). ~300px of empty right-hand column at 1440 is a defect, not
   whitespace.
3. **The primary action must be an action that works today.** Where the
   nominal primary action is unavailable — an unpublished package, a
   gated beta — it is demoted to secondary and the strongest *working* action
   is promoted. A prominent CTA followed by a disclaimer explaining that it
   does not work spends the visitor's trust at the exact moment it is highest.
4. **Never repeat a non-working CTA.** Once is an honest limitation; twice on
   one page reads as the product's main message.

### 4.6 Vertical density — application

An application surface should **fill its first viewport with information or
explain why it cannot.** The audit measured `/runs` ending at 590px of a 900px
viewport — a third of the screen blank on the product's primary data surface,
with no loading state, no pagination, and nothing below the fold.

Where a surface genuinely has little to show, the empty region carries a
designed empty state. Where it has more, it shows more. Blankness is never the
default outcome of a layout.

Chrome must earn its space against that budget: a non-dismissible banner, a
page header and a toolbar together should not consume more than roughly a
third of the first viewport before the first row of real content.

### 4.7 Breakpoints

`sm 640` · `md 768` · `lg 1024` · `xl 1280` · `2xl 1536` · wide `1680`.

---

## 5. Geometry

### 5.1 Radius

`sm 4` chips, inline code · `md 6` controls, inputs · `lg 10` cards, panels ·
`xl 12` dialogs, sheets · `full` avatars, dots only.

**Nothing above 12px on a data surface.** Larger radii read consumer-soft and
are forbidden outside dialogs.

### 5.2 Borders

Borders do the work; shadows are for overlays only.

`subtle` — separation inside a component (rows, list items)
`line` — the edge of a component (cards, inputs, panels)
`strong` — emphasis and dashed sample chrome

One border weight: 1px. The only exceptions are the State Rule (3px) and the
sample edge (2px dashed).

### 5.3 Control heights

`sm 28` · `md 32` · `lg 40` · icon `32`. Inputs match `md`. Table rows: 44
comfortable, 36 dense. Topbar 48. Sidebar item 32.

### 5.4 Surfaces

`canvas` page · `surface` sidebar and inset bands · `raised` cards on surface ·
`overlay` scrims. **Never more than two surface steps on one screen.**

### 5.5 Containment depth

**A bordered or filled container may not contain another bordered or filled
container more than one level deep.** Two levels is the hard ceiling; three is
a defect.

The ambiguity queue reached three — a State Rule card, holding a filled
question block, holding individually bordered candidate boxes — to present one
string, one question and two options. Each border was locally defensible and
the result was a nest of boxes in which nothing was dominant.

When a third level feels necessary, the answer is almost always that the
*content* needs ranking, not that the container needs a border: use spacing,
weight, a rule, or the leading edge instead. Borders are the most expensive way
to group and the easiest to overuse.

---

## 6. Colour system

### 6.1 Semantic tokens

Components may use only these. Referencing a raw palette value is a defect.

| Token | Meaning |
|---|---|
| `canvas` / `surface` / `raised` / `overlay` | Ground |
| `primary` / `secondary` / `tertiary` / `inverse` | Text |
| `subtle` / `line` / `strong` / `focus` | Borders |
| `ambiguous` (+`-bg`, `-text`) | **Your judgement is required. Nothing else.** |
| `confident` (+`-bg`, `-text`) | Verified, current, merged, passing |
| `degraded` (+`-bg`, `-text`) | Partial, stale, behind, missing |
| `failed` (+`-bg`, `-text`) | Failed, destructive, irreversible |
| `link` / `link-hover` | Navigation to another document |

### 6.2 When colour is allowed

Only to express **the state of a piece of copy, a run, or a locale**; to mark a
link; or to indicate focus. Six coloured marks on a status board of eleven
items means exactly six things are in that state.

### 6.3 When colour is forbidden

Chrome. Logos and brand marks. Roadmap or maturity state. Decoration.
Primary buttons — these are graphite, so nothing competes with the state
signal. Section backgrounds, except the single inverted band on the landing
page. Data visualisation that is not encoding state.

### 6.4 Dark mode

A distinct scale, not an inversion. Elevation is expressed through surface
lightness and border, not shadow. Every token pair must pass AA in both
schemes; contrast is verified by unit test against the real token file.

---

## 7. Motion

### 7.1 Budget

| Duration | Use |
|---|---|
| `micro` 100ms | Hover, colour, border |
| `standard` 150ms | Menus, popovers, fades, collapses |
| `emphasis` 200ms | Dialogs, sheets |

Easing `cubic-bezier(0.2, 0, 0, 1)`. **Nothing exceeds 200ms.** Transform and
opacity only — never height, width, or layout-affecting properties, except a
deliberate row collapse.

### 7.2 Purpose test

Every animation must answer: *what would the user misunderstand without it?*
If there is no answer, it is deleted. Permitted: overlay entrance/exit, an
ambiguity row collapsing on resolution (the queue visibly shortening is the
feedback), the ecosystem rail's drift, skeleton shimmer.

Forbidden: scroll-triggered reveals, parallax, staggered entrance, number
count-ups, hover lift, anything decorative.

### 7.3 Reduced motion

A global rule kills animation and transition. Every animated surface must have
a designed static presentation — not a paused animation, not a clipped frame.

---

## 8. Components

Common rules: one radius from §5.1; one height from §5.3; visible focus ring
(2px, `focus`, 2px offset); never colour alone to carry meaning; every
icon-only control has an accessible name.

**Buttons.** `primary` graphite fill · `secondary` bordered · `ghost` · `danger`
`failed` fill · `link`. Text is the action performed and keeps that word through
the whole flow — "Publish" produces "Published".

**Badges.** Always icon + text. Never wrap. Tone from the state tokens only.

**Inputs.** Label above, always. Required marked on the label. Help between
label and control. Errors below with an icon. Validation on blur, never on
keystroke. 8px label-to-control, 24px between fields.

**Tables.** No zebra — it competes with the State Rule. Sticky header. Sortable
headers show direction by icon and `aria-sort`. Numeric right-aligned, tabular.
Empty state inside the body. **Below `lg`, secondary columns fold into the row
header; they are relocated, never dropped.** ≥1000 rows virtualised.

**A data surface is incomplete without:** a result count, a filter or search
affordance, sortable columns where more than one order is meaningful,
pagination once rows exceed one screen, URL-addressable filter and sort state,
and a designed empty, loading and error state. This is a hard requirement, not
a nicety.

**Choice sets.** Where a surface presents N options and the user must pick one,
**each option is itself the control.** A single action button placed beneath a
list of candidates does not say which candidate it applies to — the ambiguity
queue shipped exactly that, one "Use this reading" under two readings, on the
surface the product is built around. Selection and confirmation may be one step
(click the option) or two (select, then confirm), but the target must always be
unambiguous, and keyboard selection must map to the same targets.

**One object, one geometry.** A domain object rendered on two surfaces uses the
same component in both. Runs appeared as bordered rows inside a card on Home and
as table rows on `/runs` — the same object wearing two geometries, which teaches
the reader that the difference means something when it does not. Density and
column count may vary by surface; the shape may not.

**Dialogs / sheets.** Radix throughout — focus trap, Esc, focus restoration,
scroll lock. Dialog centred 480/560/720. Sheet: trailing edge for detail,
leading edge for navigation, logical so it flips in RTL.

**Command palette.** 640×420 at 20vh. Sections: Recents · Navigation · Actions ·
Help. **Only commands that can actually run.** ⌘K toggles, ↑↓ move, Enter runs,
Esc restores focus to the opener. Empty query lists everything.

**Empty / loading / error.** Empty names what is missing and offers exactly one
way to create it. Loading mirrors final geometry exactly. Error states say what
failed, why, and what to do, and reproduce machine output verbatim.

---

## 9. Product UX principles

Keyboard-first: `⌘K` palette, `j`/`k` list traversal, `1`–`9` selection, `Enter`
confirm, `Esc` cancel and restore focus. Shortcuts are shown, not hidden.

URL-addressable: filters, tabs, selections and pagination live in the URL and
survive reload and sharing. This has been stated since the first draft and was
never implemented — filter and sort live in component state, so no view a
developer builds can be linked to a colleague. It is a hard requirement and
must be pinned by test, not restated.

**Chrome earns its place.** Space in the sidebar and topbar is the most
expensive in the product; it is paid for on every screen, forever. Rank by
frequency of use: a control touched once ever does not outrank the work.

The theme switcher was the standing example: a three-segment control in the
topbar of every page, a settings-level concern wearing navigation-level
prominence. It is now a single control that reports the current choice and
opens the same three options, so the preference costs one slot rather than
three. All three states remain — a user whose OS is dark may still want this
product light, and a binary toggle removes that choice silently.

The second half of that finding still stands: **no surface offers a global
primary action.** Chrome was reclaimed; nothing has yet been promoted into it.

System status is always visible: what ran, when, whether it succeeded, what is
waiting on a human. Never a spinner without a subject.

Destructive actions state their consequence in plain language and require
typing the resource name.

---

## 10. Marketing site

**Hero philosophy:** demonstrate, do not describe. The hero artifact is the
product's actual output — a string becoming five strings, in their own scripts,
with the State Rule. Not a screenshot, not an illustration, not a mockup.

**Trust without social proof:** no customer logos, no testimonials, no metrics
that are not measured and reproducible. Trust comes from linking the real pull
request, publishing benchmarks generated from committed data, and naming what
does not work yet.

**Ecosystem rail:** communicates compatibility, never endorsement. Monochrome
marks. States which relationships are integrations and which are simply
untouched. Restrained; never the visual focus.

**CTA hierarchy:** one primary action on the page (`npx` command). Everything
else is a link.

**Continuity with the application:** one design system, two registers. The site
is editorial — wider measure, display type, argument. The app is operational —
dense, quiet, fast. Shared tokens, primitives, State Rule, and voice.

---

## 11. Application

**Navigation:** flat until organisations exist. Two badges maximum, ever —
ambiguity and review, both meaning a human is blocked. No badge on Runs.

**Density:** rows 36px by default, 44px only where a row carries two lines of
content. The scale has always allowed both and every table shipped at 44 with
`dense` used nowhere, which is how a tool meant to be read for hours ended up
with a third of its primary surface empty. Dense is the default for a developer
product; comfortable is the exception that must be justified by content.

Page header carries title, purpose, metadata row and the single primary action,
closed by a rule.

**Surfaces:** Home answers "is anything waiting for me?" — not a dashboard.
Ambiguity is the differentiator and gets the most attention. Review is
mobile-first. Runs is a table, run detail is a pipeline. Locales renders each
language in its own script. Settings is read-only real configuration.

**Future backend states:** where data does not exist, render the real interface
with data labelled sample at three levels — banner, breadcrumb chip, dashed
edge — with types matching the future API. Where *controls* do not exist,
refuse rather than demonstrate: a control that silently fails is worse than an
empty section.

---

## 12. Responsive

Not a scaled-down desktop. Each tier has a designed job.

| Tier | Behaviour |
|---|---|
| **<640** | Single column, 16px gutter. Navigation is a sheet. Tables fold secondary columns into the row header. Actions full-width and thumb-sized. Type steps down. |
| **640–1023** | Single column, 24px gutter. Sidebar still a sheet. Tables fold their widest column. |
| **1024–1679** | Sidebar persistent. Content 1200px. Tables full. |
| **≥1680** | Data surfaces widen to 1600px and gain detail; prose stays at measure. Extra width buys information, never margin. |

---

## 13. Accessibility

Non-negotiable and gated in CI.

Zero axe violations on every route in **both** colour schemes. Overlays audited
open. One `h1` per page, no skipped levels. Visible focus on every interactive
element; focus restored to the opener on dismissal. Touch targets ≥24×24.
Colour never the sole carrier of meaning. `prefers-reduced-motion` respected
with a designed static alternative. Translated copy carries `lang` and `dir`.
Logical properties throughout so RTL works. ARIA ownership correct — a
`listbox` owns only `option` and `group`.

---

## 14. Anti-patterns

Rejected on sight, in review and in implementation.

**Visual:** gradients as decoration · glassmorphism · radius above 12px on data
surfaces · drop shadows on structure · decorative illustrations · icons that do
not disambiguate · more than two surface steps · coloured chrome · brand colour
as accent · giant type without hierarchy · excessive whitespace standing in for
composition.

**Content:** fake metrics · fake testimonials · fake social proof · "trusted by"
without evidence · unearned partner or endorsement claims · invented data
presented as real · a control that appears operational and is not · roadmap
described in the present tense.

**Interaction:** meaningless animation · scroll-triggered reveal · parallax ·
count-ups · motion over 200ms · anything animating layout · a spinner without a
subject · a modal for something that is not modal · hover-only affordances.

**Structure:** every section the same shape · a dashboard of cards nobody acts
on · charts that encode nothing · a table without count, filter or states · a
type size outside the scale · an arbitrary spacing value · a component with its
own geometry.

---

## 15. External primitives

`packages/ui` is the product's component library. External sources — shadcn
chief among them — are a **parts supplier, never a design system.**

The order of authority is: this document → the Localize Infra design language →
`packages/ui` architecture → external primitives.

Adopt an external primitive only when it clears all four:

1. **It does not already exist here.** `packages/ui` is already a complete Radix
   set — dialog, sheet, menu, popover, tooltip, select, tabs, field, table,
   command palette. Re-importing any of them buys nothing and creates a second
   system with different geometry.
2. **It solves accessibility or interaction we would otherwise hand-roll** —
   focus management, roving tabindex, scroll locking, collision detection. This
   is the real reason to take a dependency; a hand-rolled radiogroup already
   shipped here and was broken.
3. **It is re-skinned to these tokens on the way in.** No imported component
   keeps its own radius, height, colour or focus ring. If it arrives with a
   token layer, that layer is deleted, not merged.
4. **It is vendored into `packages/ui` and re-exported**, so consumers import
   from one place and the boundary stays auditable.

Never install a component "to see what it looks like." Never let an external
library's defaults set a value this document specifies.

---

## 16. Governance

This document is the contract. A pull request that introduces a value not
found here is incomplete: either it uses an existing token, or it amends this
document first with the reasoning.

Enforced by test today: the type scale (no ad-hoc sizes, both registers,
editorial steps kept out of the app), token contrast in both schemes, axe on
every route, ARIA ownership, reduced motion, responsive overflow, and the
sample-data contract.

Not yet enforced and therefore requiring review discipline: radius and control
height usage, motion budget, and the data-surface completeness rule in §8.
