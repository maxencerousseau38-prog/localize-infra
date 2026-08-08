# Design System

Date: 2026-08-06
Depends on: `04-wireframes.md`
**Specification only. No component code.**

---

## 1. Design plan (decided before any token)

### 1.1 Concept — "Chrome is neutral. Colour means something."

Most developer tools spend colour on decoration: a branded blue button, a gradient hero, a coloured sidebar. We spend **zero** colour on chrome and **all** of it on meaning. Every hue in the interface answers one question: *what is the state of this piece of copy?*

This is not minimalism for its own sake. It follows from the product thesis. Our differentiator is that the system tells you when it is unsure — so uncertainty must be **the most visually legible thing in the product**, and it cannot compete with a decorative brand colour for attention.

### 1.2 The insight that shapes the palette

**Ambiguity is not a warning.** Every design system reaches for amber when something needs attention, but amber means *something is wrong*. An escalated ambiguity is the system working correctly — it is an invitation to apply human judgement, not a defect. Colouring it amber would teach users to feel bad about the product's best feature.

So ambiguity gets its own hue, **Iris**, used nowhere else in the product. When a developer sees Iris, it means exactly one thing: *your judgement is required.* Amber remains available for genuine degradation (missing keys, stale locale).

### 1.3 Palette (6 named colours)

| Name | Light | Dark | Meaning — never used for anything else |
|---|---|---|---|
| **Graphite** | `#0C0E12` … `#F7F8F9` | inverted | All chrome, text, surfaces, borders. Near-neutral, faint cool cast. |
| **Iris** | `#5B4BE8` | `#8B7CF6` | **Needs your decision.** The signature. Ambiguity only. |
| **Jade** | `#0B7D5B` | `#34D399` | Confident, current, merged, passing |
| **Amber** | `#A96A00` | `#FBBF24` | Degraded: missing keys, stale, partial |
| **Crimson** | `#BE2C2C` | `#F87171` | Failed, destructive, irreversible |
| **Azure** | `#1F6FEB` | `#58A6FF` | Links and external references only (GitHub's language, deliberately) |

**Explicitly avoided**, per the house rules on default-AI aesthetics: cream `#F4F1EA` grounds with contrasty serif and terracotta near `#D97757`; near-black with acid-green; broadsheet layouts with hairline rules. None of those appear here. Our accent is a cool violet at high chroma on a near-neutral ground — a different family entirely.

**Primary buttons are Graphite, not Iris.** If the primary action were Iris, every screen would shout the same colour as the ambiguity signal and the signal would die. Interactive prominence comes from weight and contrast; colour is reserved for state.

### 1.4 Typography — three families, because we render three writing systems

This is where a localization product must be more rigorous than a normal design system: **we display our users' translated copy**, so Japanese and Arabic are not edge cases, they are the product surface.

| Role | Family | Why |
|---|---|---|
| **Interface** | **Inter Variable** | Excellent at small sizes, real optical sizing, huge Latin/Cyrillic/Greek coverage, variable weight |
| **Code, keys, strings-as-data** | **JetBrains Mono** | Distinguishes `l/1/I` and `0/O` — non-negotiable when displaying keys and ICU placeholders |
| **CJK / Arabic rendering** | **Noto Sans JP**, **Noto Sans Arabic** | Correct script rendering with metrics compatible with Inter |

**Rule:** a translated string is always rendered in the font stack of *its own* locale, never the interface locale. German in Inter, Japanese in Noto Sans JP, Arabic in Noto Sans Arabic — RTL, with correct shaping. Rendering Japanese in a Latin-first fallback is the single most obvious way a localization product proves it does not care.

### 1.5 Layout concept — "the string is the hero"

Chrome recedes: 240px sidebar, 48px top bar, both near-neutral, minimal borders, no shadows on structure. Everything visually expensive is spent on the user's copy in context.

### 1.6 Signature element — **the State Rule**

A **3px vertical rule on the leading edge** of any card, row, or panel that carries user copy, coloured by state:

```
┃ Close                          ┃ = Iris    → needs your decision
┃ Schließen                      ┃ = Jade    → confident
┃ (untranslated)                 ┃ = Amber   → missing
┃ —                              ┃ = Crimson → failed
```

It is the product's core idea — *confidence is always visible* — compressed into one reusable, scannable element. It appears on the ambiguity queue, the review surface, locale tables, and run details. **It flips to the trailing edge in RTL** (logical `border-inline-start`), which is both correct and a small proof of competence.

---

## 2. Tokens

### 2.1 Colour scales

Each semantic hue ships a 12-step scale (Radix-style: 1–2 backgrounds, 3–5 component backgrounds, 6–8 borders, 9–10 solid, 11 low-contrast text, 12 high-contrast text). Only the anchors are listed:

```
graphite  1 #FFFFFF   2 #F7F8F9   3 #EDEEF0   6 #D7DAE0   8 #868D9B   9 #6C727F   11 #4A505C   12 #0C0E12
iris      3 #EFEDFE   6 #C7C0F9   9 #5B4BE8   11 #4A3CD1   12 #221B63
jade      3 #E3F5EE   6 #A7DFCB   9 #0B7D5B   11 #08674B   12 #05301F
amber     3 #FDF3E0   6 #F0D9A8   9 #9A6100   11 #7A4D00   12 #40280A
crimson   3 #FDECEC   6 #F5BFBF   9 #BE2C2C   11 #A02222   12 #4A1212
azure     3 #E7F0FF   6 #ACC8F7   9 #1F6FEB   11 #1A5CC4   12 #0B2A5E
```

**These values were corrected by the CI contrast gate, not by eye.** The check (`packages/ui/src/__tests__/contrast.test.ts`) parses the real token file and failed three pairs on its first run, each a genuine accessibility defect that would otherwise have shipped:

| Pair | Was | Now | Reason |
|---|---|---|---|
| light `graphite-8` on canvas | 2.08:1 | **3.33:1** | strong border below the 3:1 required of a boundary identifying an interactive state |
| dark `graphite-9` on canvas | 4.00:1 | **5.02:1** | tertiary text below 4.5:1 |
| dark `graphite-8` on canvas | 2.41:1 | **3.30:1** | strong border below 3:1 |

The gate also asserts both themes define identical token names (a token present in one scale and missing from the other renders as an unresolved `var()`, usually invisible text) and that no hex value contains a non-ASCII character — which caught a real full-width-digit typo during implementation.

It encodes one deliberate distinction: `border-strong` must meet 3:1 because it identifies interactive state, while `border-subtle` and `border-default` are decorative dividers and are not subject to WCAG 1.4.11.

**Dark mode is a distinct scale, not an inversion.** Inverted palettes produce muddy mid-tones and broken contrast. Dark surfaces are `graphite-1 #0C0E12` → `graphite-3 #1A1D23`; hues shift lighter and *desaturate slightly* to avoid vibration on dark ground (Iris `#5B4BE8` → `#8B7CF6`).

**Semantic aliases** (what components actually consume — never raw scale values):
```
bg.canvas bg.surface bg.raised bg.overlay
text.primary text.secondary text.tertiary text.inverse
border.subtle border.default border.strong border.focus
state.ambiguous state.confident state.degraded state.failed
```

### 2.2 Spacing — 8px base

`0 · 2 · 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64 · 80 · 96`
4px and 2px exist only for optical alignment inside controls.

### 2.3 Radius

`sm 4` (badges, inputs) · `md 6` (buttons, cards) · `lg 10` (dialogs, popovers) · `xl 14` (marketing) · `full` (avatars).
Deliberately restrained — large radii read consumer-friendly and undercut the "infrastructure" register.

### 2.4 Type scale

| Token | Size/Line | Weight | Use |
|---|---|---|---|
| `display` | 56/60 | 600 | landing h1 only |
| `h1` | 32/40 | 600 | page title |
| `h2` | 24/32 | 600 | section |
| `h3` | 18/28 | 600 | card title |
| `body` | 14/22 | 400 | **default UI size** |
| `body-lg` | 16/26 | 400 | prose, docs, review surface |
| `small` | 13/20 | 400 | secondary |
| `caption` | 12/16 | 500 | labels, meta |
| `mono` | 13/20 | 400 | keys, code, ICU |
| `mono-sm` | 12/18 | 400 | dense tables |

14px default (not 16) because this is a dense professional tool; prose and Inès's review surface step up to 16. Tabular numerals on all numeric columns. Letter-spacing `-0.011em` at ≥24px, `0` at body, `+0.01em` on all-caps captions.

### 2.5 Elevation

Four levels only. Borders do most of the work; shadows are reserved for genuine layering.

```
e0  none                     flat surfaces, table rows
e1  0 1px 2px rgba(12,14,18,.06)                     cards
e2  0 4px 12px rgba(12,14,18,.08)                    dropdowns, popovers
e3  0 16px 48px rgba(12,14,18,.16)                   dialogs, command palette
```
In dark mode shadows are near-useless; elevation is expressed by **surface lightness + border** instead.

### 2.6 Borders

`subtle` (dividers) · `default` (cards, inputs) · `strong` (hover) · `focus` = 2px Iris ring at 2px offset. 1px hairlines throughout; **never** decorative rules (that is the broadsheet look we are avoiding).

---

## 3. Motion

### 3.1 Principles

1. **Motion explains causality, never decorates.** If it does not tell the user where something came from or where it went, delete it.
2. **The ambiguity queue is exempt from decorative motion entirely.** It is a throughput instrument; a 200ms transition between items is 200ms of throughput lost. Item→item is instantaneous.
3. **`prefers-reduced-motion` removes all non-essential motion**, and the product must be fully usable and *not visibly degraded* in that mode.

### 3.2 Rules

| Class | Duration | Easing | Example |
|---|---|---|---|
| Instant | 0ms | — | ambiguity item advance |
| Micro | 100ms | `ease-out` | hover, focus |
| Standard | 150ms | `cubic-bezier(.2,0,0,1)` | dropdown, toast, tooltip |
| Emphasis | 200ms | `cubic-bezier(.2,0,0,1)` | dialog, drawer |
| Never | >300ms | — | nothing in the app exceeds 300ms |

Transform and opacity only (compositor-safe). No layout-animating properties. No spring physics in the app shell — springs read playful and cost predictability.

### 3.3 Library decisions — with honest scoping

The house defaults name Lenis, GSAP, Framer Motion and React Bits. Applying all four everywhere would be wrong, so each is scoped deliberately:

| Library | Marketing site | Application | Rationale |
|---|:--:|:--:|---|
| **Framer Motion** | ✅ | ✅ (sparingly) | Best-in-class with Radix; respects reduced-motion natively. In-app: dialogs, drawers, toasts, palette only. |
| **Lenis** | ✅ | ❌ | Smooth scroll suits a long marketing narrative. **In a dashboard it fights the OS, adds input latency, and breaks `scroll-into-view` for keyboard users** — directly hostile to Maya and to WCAG focus management. Landing and docs only. |
| **GSAP** | ⚠️ one sequence max | ❌ | Only if the landing PR-diff reveal genuinely needs a timeline Framer cannot express. Otherwise it is ~30kb for nothing. Default: **do not add.** |
| **React Bits** | ✅ selectively | ❌ | Showcase components suit a hero section. In-app they conflict with Radix a11y semantics and the "chrome is neutral" rule. |
| **Radix UI** | — | ✅ **foundation** | Focus traps, roving tabindex, dismiss layers, ARIA. Non-negotiable given WCAG 2.2 AA. |

**The bar for any in-app animation: it must survive `prefers-reduced-motion: reduce` being on, and it must not delay a keystroke.**

---

## 4. Components

Built on **shadcn/ui + Radix**, restyled to these tokens. shadcn is chosen because we own the source — a design system we cannot modify would fail the "chrome is neutral" restyle.

### 4.1 Buttons

| Variant | Appearance | Use |
|---|---|---|
| `primary` | Graphite-12 fill, inverse text | one per view |
| `secondary` | surface + border | most actions |
| `ghost` | transparent, hover surface | toolbars, table rows |
| `danger` | Crimson-9 fill | destructive only, always with confirm |
| `link` | Azure, underline on hover | inline navigation |

Sizes `sm 28` / `md 32` / `lg 40`; touch targets padded to ≥44px on coarse pointers. States: default, hover, active, focus-visible (2px Iris ring), disabled (`opacity .5`, `cursor: not-allowed`, **plus a tooltip explaining why** — a disabled control with no explanation is a dead end), loading (spinner replaces label, width locked to prevent reflow).

### 4.2 The String Card — *signature component*

The product's atom. Appears on ambiguity, review, locale tables, run detail.

```
┃  Close                                        [ EN ]
┃  ────────────────────────────────────────────────────
┃  Schließen                                    [ DE ] ✓
┃  src/components/Modal.tsx · Settings dialog
```
Leading State Rule (3px, `border-inline-start` so it flips in RTL) · source text in interface font · translated text **in the target locale's font stack** with `lang` and `dir` set · locale chip · context line, muted. Density variants comfortable/dense.

### 4.3 Tables

Header `caption` weight 500 uppercase; rows 44px comfortable / 36px dense; zebra **off** (borders instead — zebra fights the State Rule); sticky header; first column sticky on horizontal scroll; sortable headers with explicit direction icons; row hover surface-2; selection via checkbox column; empty state inside the table body, never replacing it. Numeric columns right-aligned, tabular figures. ≥1k rows virtualized.

### 4.4 Forms

Labels **above** inputs, always (placeholder-as-label is an accessibility failure). Required marked on the label, not by absence. Inline validation on blur, never on keystroke. Errors below the field in Crimson-11 **with an icon** — never colour alone. Help text below label, above input. 560px form column. Sticky save bar appears only when dirty, with explicit Save / Discard.

**Deviation from the layout contract (wireframes §0), recorded rather than silent.** That table specifies 16px label→control. The implementation uses 8px, with 24px between fields as specified. 16px against a 24px inter-field gap is too weak a ratio: the label stops reading as belonging to the control beneath it and starts floating between two fields, which is the one thing label placement has to get right. 8px against 24px groups unambiguously. Help text sits 4px below the label, inside the same group.

### 4.5 Dialogs / Drawers / Dropdowns / Popovers

Radix primitives throughout. Dialog: centered, 480/560/720, `e3`, focus trapped, `Esc` closes, focus returns to trigger, scrim `graphite-12 @ 40%`. Drawer: right side, 400/560, for detail-without-navigation (run detail, member edit). Dropdown: `e2`, 8px radius, roving tabindex, type-ahead. Destructive confirmations require typing the resource name and state the consequence in plain language.

### 4.6 Command palette

640×420, `e3`, overlay at 20vh. Sections: recents · navigation · actions (`>`) · projects (`#`) · help. Fuzzy match with matched-character emphasis. `↑↓` navigate, `Enter` run, `Esc` close, `⌘K` toggles. Opens in <50ms — it is Maya's primary navigation, and a slow palette is an unused palette. Empty query shows recents, never a blank box.

### 4.7 Badges & chips

`neutral` (counts) · `iris` (needs decision) · `jade` (current) · `amber` (degraded) · `crimson` (failed). **Always icon + text**, never colour alone (WCAG 1.4.1 and simple colour-blind correctness). Counts cap at `99+`. Locale chips show the code with the full name in `title` and in the accessible name — `pt-BR` is meaningless to Inès.

### 4.8 Toasts

Bottom-right (bottom-center <768), max 3 stacked, 4s auto-dismiss, 6s if it has an action, **never auto-dismiss on error**. Contains icon + message + optional single action + dismiss. Never used to confirm the obvious. `role="status"` for info, `role="alert"` for errors.

### 4.9 Progress & skeletons

Determinate bars only where a real fraction exists (translation run: locales completed / total). Indeterminate: a 2px top-of-content bar, never a full-screen spinner. Skeletons mirror final geometry exactly — same row heights, same column widths — so nothing shifts on load. Shimmer is a single 1.2s sweep, disabled under reduced-motion. **A skeleton that does not match the loaded layout is worse than a spinner.**

### 4.10 Empty & error states

Empty: icon (24px, muted) + one-line title + one sentence + primary action. **Positive framing where empty is the goal** — an empty ambiguity queue is a success screen, not an apology.
Error: three tiers (field / section / page). Every error names what broke, what to do next, and links to status when systemic. No stack traces, no bare codes, no "Something went wrong."

### 4.11 Charts (benchmarks page only)

The only charts in the product, by design — analytics dashboards are banned (they lead to usage meters). Horizontal bars for per-language quality. Categorical colour is **not** used to rank; the losing languages are labelled in text, because encoding "we lose" in hue alone would hide it. Grid lines `border.subtle`, no 3D, no gradients, direct labelling over legends, axis starts at zero.

### 4.12 Icons & illustration

**Lucide**, 16/20/24, 1.5px stroke, aligned to the 8px grid. One family only. Illustration is used **almost nowhere** — no mascots, no isometric scenes, no abstract blobs. The two exceptions: a geometric empty-state mark (single-weight line, monochrome) and the landing page's real screenshots. Real product beats drawn metaphor for an infrastructure buyer.

---

## 5. Accessibility rules (WCAG 2.2 AA as the floor)

1. **Every interactive element reachable and operable by keyboard.** Verified per screen, not assumed.
2. Focus visible everywhere: 2px Iris ring, 2px offset, ≥3:1 against both adjacent surfaces.
3. Contrast: ≥4.5:1 body, ≥3:1 large text and UI boundaries. **Every token pair machine-verified in CI**, not eyeballed.
4. **Never colour alone.** Every state carries an icon and text alongside the State Rule.
5. Target size ≥24×24 (2.2 AA), ≥44×44 on coarse pointers.
6. Dialogs trap focus, `Esc` dismisses, focus returns to the trigger.
7. Async results announced via live regions (`polite` for results, `assertive` for errors).
8. `prefers-reduced-motion` honoured globally.
9. **`lang` and `dir` set correctly on every rendered translation** — a Japanese string inside an English page must be marked `lang="ja"` so screen readers switch voice. This is the product's own subject matter; getting it wrong is disqualifying.
10. Full RTL support in the app shell, driven by logical properties (`margin-inline`, `border-inline-start`), never physical ones.
11. Forms: labels programmatically associated, errors linked via `aria-describedby`.
12. Zoom to 200% without loss of function; reflow at 320px.

---

## 6. Token implementation

CSS custom properties as the single source of truth, consumed by Tailwind. Both `class="dark"` and `prefers-color-scheme` supported, with an explicit three-state preference (light / dark / system) — never system-only.

```
:root {
  --bg-canvas: var(--graphite-1);
  --text-primary: var(--graphite-12);
  --border-focus: var(--iris-9);
  --state-ambiguous: var(--iris-9);
  --state-confident: var(--jade-9);
  --state-degraded: var(--amber-9);
  --state-failed: var(--crimson-9);
}
```

Components consume **semantic aliases only**. A component referencing `--iris-9` directly instead of `--state-ambiguous` is a review rejection — that indirection is what lets ambiguity be re-themed without a product-wide audit.

**Tokens are versioned and contrast-tested in CI.** A PR that changes a colour and drops a pair below threshold fails the build, in the same spirit as the existing 99.5% placeholder/ICU gate.

---

## 7. What this system deliberately refuses

- A branded accent on chrome (would compete with the ambiguity signal).
- Gradients, glassmorphism, glow. They date fast and read consumer.
- Illustrated mascots or abstract 3D.
- More than one icon family, one motion library in-app, or one type scale.
- Decorative hairline rules (broadsheet).
- Cream + serif + terracotta, or near-black + acid green — the two most recognisable machine-generated looks.
- Any component whose only purpose is to look impressive in a screenshot.
