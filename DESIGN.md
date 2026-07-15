---
name: VOLT
description: A digital bank that runs two skins on one product — concrete-brutalist by day, electric-neon by night.
colors:
  volt-yellow: "#FFD700"
  volt-yellow-pastel: "#FFED86"
  volt-lime: "#A2FF00"
  volt-black: "#000000"
  volt-dark: "#131313"
  volt-surface: "#201f1f"
  volt-surface-low: "#1c1b1b"
  volt-surface-high: "#2a2a2a"
  volt-surface-top: "#353534"
  volt-green: "#00ff9d"
  volt-primary-dark: "#00e38b"
  volt-cyan: "#00E5FF"
  volt-pink-focus: "#FF5C8D"
  on-surface: "#e5e2e1"
  on-surface-variant: "#b9cbbc"
  neon-secondary: "#c9bfff"
  neon-outline: "#849587"
  neon-error: "#ffb4ab"
typography:
  display:
    fontFamily: "Space Grotesk, Manrope, sans-serif"
    fontWeight: 900
    letterSpacing: "normal"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontWeight: 700
    letterSpacing: "0.05em"
  mono:
    fontFamily: "JetBrains Mono, monospace"
    fontWeight: 400
rounded:
  sm: "0.75rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2rem"
components:
  card-yellow:
    backgroundColor: "#FFFFFF"
    textColor: "#000000"
    rounded: "{rounded.lg}"
  card-yellow-high:
    backgroundColor: "{colors.volt-yellow-pastel}"
    textColor: "#000000"
    rounded: "{rounded.md}"
  card-midnight:
    backgroundColor: "{colors.volt-surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.lg}"
  button-primary-midnight:
    backgroundColor: "{colors.volt-green}"
    textColor: "#000000"
    rounded: "{rounded.md}"
  button-primary-yellow:
    backgroundColor: "#000000"
    textColor: "{colors.volt-yellow}"
    rounded: "{rounded.md}"
---

# Design System: VOLT

## 1. Overview

**Creative North Star: "The Neon-Concrete Notebook"**

VOLT is one banking product with two physical materials depending on the hour. By day (Yellow theme) it's concrete: saturated yellow ground, thick black borders, hard offset shadows with zero blur — like a brutalist notebook margin, confident to the point of irreverence. By night (Midnight theme) it's neon: near-black surfaces, a single electric-green wire (`volt-green` #00ff9d) running through numbers and CTAs, glowing rather than shadowing. Neither skin is a "dark mode toggle" on the other; each has its own elevation physics, its own contrast rules, its own restraint.

This system explicitly rejects generic fintech AI-slop — purple-blue gradients, gradient-clipped text, identical floating hero-metric cards — and rejects old-school corporate banking's navy-serious, bureaucratic density. VOLT is a modern challenger bank that still needs to read as credible and real, not just stylish: every screen doubles as a teaching artifact for Clean Code and testing practice, so visual confidence and data correctness (real R$ values, correct pt-BR dates, correct invoice math) carry equal weight.

**Key Characteristics:**
- Two fully-specified themes, never a single design reskinned after the fact
- Zero soft shadows in either theme — hard offset (Yellow) or none (Midnight), no blur-based elevation ever
- One accent per theme used with restraint: black-on-yellow in daylight, neon-green-on-black at night
- Brazilian fintech vocabulary (PIX, fatura, boleto, CPF, R$) is native, not translated

## 2. Colors

The palette runs on exactly two registers with no shared middle ground: a saturated, high-chroma daylight register (Yellow) and a near-monochrome nocturnal register (Midnight) pierced by a single neon wire.

### Primary
- **Volt Green** (#00ff9d): the Midnight theme's only accent — CTAs, active states, key numbers (balances, invoice totals), glowing highlights. Never used at more than a handful of points per screen; its rarity is what makes it read as "electric" rather than "green app."
- **Volt Yellow** (#FFD700): the Yellow theme's entire canvas — full-bleed background, not an accent. This is the one context where a brand color IS the surface rather than a highlight on it.

### Secondary
- **Volt Lime** (#A2FF00): secondary accent inside dark "exempt" surfaces (Stories, credit-card-shell) that survive the Yellow-theme override — a lime-green stand-in for volt-green when a component must stay dark even in daylight mode.
- **Volt Cyan** (#00E5FF) / **Volt Pink Focus** (#FF5C8D): tertiary highlight colors used sparingly for badges, tags, and secondary CTAs (e.g. "6 Meses" analytics badge, focus rings) across both themes.

### Neutral
- **Volt Dark** (#131313): Midnight theme's base background — near-black, not pure black, so neon-green glows have somewhere to breathe.
- **Volt Surface / Surface-Low / Surface-High / Surface-Top** (#201f1f / #1c1b1b / #2a2a2a / #353534): a four-step tonal ramp for card layering in Midnight — each step up is a "closer to the user" surface, used instead of shadows to convey depth.
- **On-Surface** (#e5e2e1) / **On-Surface-Variant** (#b9cbbc): primary and muted text in Midnight; the variant carries a faint green cast so muted copy never reads as neutral gray.
- **Volt Black** (#000000): text and borders in Yellow theme — every card border, every shadow, every label is pure black, no exceptions.
- **White** (#FFFFFF): Yellow theme's card background — the only "paper" color against the saturated yellow ground.
- **Volt Yellow Pastel** (#FFED86): Yellow theme's inner high-contrast surface (nested cards, callouts) — one step lighter than pure white-on-yellow, used sparingly for emphasis blocks.

### Named Rules
**The One Wire Rule.** Midnight has exactly one accent color in play at a time: `volt-green`. If a screen needs a second highlight, reach for cyan or pink-focus as a rare tertiary, never introduce a second green.

**The Full-Bleed Exception Rule.** Volt Yellow is the only brand color allowed to be a full-page background rather than an accent. Every other named color — including volt-green — is a highlight on a neutral base, never the base itself.

## 3. Typography

**Display Font:** Space Grotesk (with Manrope, sans-serif fallback)
**Body Font:** Inter (with ui-sans-serif, system-ui fallback)
**Label/Mono Font:** JetBrains Mono (for code, receipts, transaction IDs)

**Character:** Space Grotesk's geometric, slightly technical display letterforms pair with Inter's neutral, highly legible body — a "confident but readable" combination that keeps headings feeling engineered without sacrificing scanability in dense financial screens.

### Hierarchy
- **Display** (font-weight 900, `text-2xl`–`text-3xl`, tight line-height): screen titles, hero balances, invoice totals — the numbers users came to check.
- **Headline** (font-weight 900, Space Grotesk, `text-lg`–`text-xl`): section headers ("Seu Dashboard", "Cartão de Crédito", card component titles).
- **Title** (font-weight 700–900, `text-sm`–`text-base`): component headers inside cards, modal titles.
- **Body** (font-weight 400–600, Inter, `text-sm`, line-height 1.5): transaction descriptions, help text, form labels. Kept under ~65ch per line inside any modal or sheet.
- **Label** (font-weight 700–900, `text-[9px]`–`text-[11px]`, uppercase, letter-spacing 0.05em+): eyebrow-style micro-labels ("FATURA ATUAL", "MELHOR DIA DE COMPRA", tab pills) — always uppercase, always bold, always tiny relative to the value it labels.

### Named Rules
**The Loud Label, Quiet Value Rule.** Micro-labels are tiny, bold, and uppercase; the value beneath them is large and often the loudest element on the card. The label should never compete in size with what it's labeling.

## 4. Elevation

VOLT commits to opposite elevation physics per theme — neither uses soft blur-based shadows, ever. Yellow theme is **structural**: depth is a literal offset black shape behind the card, like a printed sticker peeling off the page. Midnight theme is **tonal**: depth is conveyed by moving one step up a four-step surface ramp (volt-dark → volt-surface → volt-surface-high → volt-surface-top), with only a hairline white-5% border to separate layers — no shadow at all.

### Shadow Vocabulary
- **Brutalist offset — primary** (`box-shadow: 6px 6px 0px 0px rgba(0,0,0,1)`, `border: 4px solid #000`): main cards in Yellow theme (`.bg-volt-surface` override). The signature "stuck-on" look.
- **Brutalist offset — nested** (`box-shadow: 4px 4px 0px 0px rgba(0,0,0,1)`, `border: 3px solid #000`): inner high-contrast blocks inside a Yellow card (`.bg-volt-surface-high`), a smaller echo of the primary offset.
- **Tonal layer — Midnight** (`border: 1px solid rgba(255,255,255,0.05)`, no box-shadow): every card surface in Midnight theme. Depth is the surface color step, not the shadow.

### Named Rules
**The No-Blur Rule.** Zero `blur()` in any shadow, in either theme. Yellow's shadows are hard offsets with 0px blur radius; Midnight has no shadows to blur. A soft drop-shadow anywhere in this system is a bug, not a style choice.

## 5. Components

Every component ships two variants — Yellow and Midnight — driven by the same markup and a `.theme-midnight` body class, not two separate component trees.

### Buttons
- **Shape:** rounded-xl (`1rem`) as the default; rounded-full for pill-style quick-action chips (scroll-lateral action buttons on the Home credit-card section).
- **Primary (Midnight):** `volt-green` background, black text, font-weight 900, uppercase tracking-wide. `active:scale-95` on tap, no hover-lift — the tactile feedback is a compression, not a float.
- **Primary (Yellow):** solid black background, `volt-yellow` or white text — the one place black is a fill color rather than just a border/shadow.
- **Ghost / Secondary:** `bg-white/5` with `hover:bg-white/10` in Midnight; white background with black 2–4px border and offset shadow in Yellow (never a borderless ghost button in Yellow — every interactive surface needs its black outline).

### Cards / Containers
- **Corner Style:** `1.5rem` (`rounded-2xl`) for primary cards, `1rem` for nested/high-contrast blocks.
- **Background:** white (Yellow) or `volt-surface` (Midnight); see Elevation for the border/shadow pairing per theme.
- **Shadow Strategy:** see Elevation — hard offset in Yellow, none in Midnight.
- **Border:** 4px black (Yellow primary), 3px black (Yellow nested), 1px white/5% (Midnight) — never omit the border in Yellow theme; it's load-bearing for the brutalist read.
- **Internal Padding:** `p-5` (20px) as the default card padding; `p-3`–`p-4` for nested stat tiles.

### Inputs / Fields
- **Style:** dark translucent fill (`bg-black/40`) with `border border-white/10`, `rounded-lg`, monospace type for numeric fields (CVV, expiry, PIN).
- **Focus:** border color shifts to `volt-green` (Midnight) — no glow/box-shadow focus ring, the border color change alone carries the state.
- **Error:** `neon-error` (#ffb4ab) text and border on validation failure, paired with an inline icon (AlertCircle), never color-alone.

### Navigation
- Bottom nav bar: floating pill container (`rounded-full`), active tab gets a filled circular icon background; typography is label-scale (bold, tiny, uppercase optional). Same pill shape and motion in both themes; only the fill/accent color swaps.

### Bottom Sheets (signature component)
Every modal in the app — invoice summary, delivery tracking, promotional popups — is a spring-animated bottom sheet (`motion/react`, `type: spring, damping: 30, stiffness: 300`) sliding up from `y: '100%'`, with a black/60 backdrop-blur scrim and a `w-10 h-1 bg-white/20` drag handle centered at the top. This is the app's one consistent "surface entering the user's world" gesture — reused rather than reinvented per modal.

## 6. Do's and Don'ts

### Do:
- **Do** build every new component theme-aware from the start — Yellow (black border + hard offset shadow) and Midnight (tonal surface + hairline border) — never ship one theme and reskin later.
- **Do** use `volt-green` as the single accent wire in Midnight; reach for cyan/pink-focus only as a rare tertiary, never a second green.
- **Do** keep micro-labels tiny/bold/uppercase and their values large — the Loud Label, Quiet Value Rule.
- **Do** use the spring bottom-sheet pattern (backdrop blur scrim + drag handle + spring slide-up) for any new modal, so new UI doesn't invent a competing overlay gesture.
- **Do** treat pt-BR formatting (R$, CPF, dates as "15 de ago") and Brazilian fintech vocabulary (PIX, fatura, boleto) as first-class, not an afterthought.

### Don't:
- **Don't** use any blur-based `box-shadow` in either theme — Yellow is hard-offset-only, Midnight is shadow-free.
- **Don't** use purple-blue gradients, gradient-clipped text, or the SaaS hero-metric template — this is explicitly generic fintech AI-slop VOLT rejects.
- **Don't** default to navy-serious, bureaucratic, form-dense corporate-bank styling — VOLT is a challenger bank, not a legacy institution.
- **Don't** render a Yellow-theme card without its 3–4px black border — an unbordered white card on yellow reads as broken, not minimal.
- **Don't** introduce a second bright accent color competing with `volt-green` in Midnight screens.
