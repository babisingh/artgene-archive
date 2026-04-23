# ArtGene Archive — Design System Specification

**Version:** 1.0  
**Last updated:** 2026-04-22  
**Purpose:** Source of truth for fonts, colours, spacing, components. Use when building new pages so they match the existing design.

---

## 1. Typography

All typography uses a single family for simplicity and institutional consistency.

| Role | Family | Weights | Source |
|------|--------|---------|--------|
| Display / UI / Body | **Manrope** | 300, 400, 500, 600, 700 | Google Fonts |
| Monospace (data, IDs, code) | **JetBrains Mono** | 400, 500 | Google Fonts |

### Google Fonts import
```html
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet"/>
```

### Type scale
| Token | Size | Weight | Letter-spacing | Usage |
|---|---|---|---|---|
| `.display` hero | 44–60px clamp | 600 | -0.025em | Landing hero |
| `.display` page | 32–44px | 600 | -0.025em | Page titles |
| H2 | 24–32px | 600 | -0.02em | Section heads |
| H3 | 18–22px | 600 | -0.01em | Card titles |
| Lede | 16–17px | 400 | -0.005em | Intro paragraphs |
| Body | 14.5px | 400 | 0 | Default |
| Small | 12.5–13.5px | 400 | 0 | Captions, metadata |
| Mono eyebrow | 10.5–11px | 500 | 0.12em, UPPERCASE | Section labels |

**Rules:** no italics for branding. Accent colour on key nouns only (never whole paragraphs). Line-height 1.55 body, 1.05 display.

---

## 2. Colour

### Base palette (CSS custom properties)
```css
:root {
  --paper:    #fafaf6;  /* primary bg — warm ivory */
  --paper-2:  #ffffff;  /* cards, raised surfaces */
  --paper-3:  #f3f1e9;  /* section bands, tbl headers */
  --ink:      #1c1b17;  /* primary text */
  --ink-2:    #3b3a34;  /* secondary text */
  --ink-3:    #6d6b60;  /* tertiary / labels */
  --ink-4:    #9e9b8d;  /* disabled / hints */
  --rule:     #e2ddcb;  /* hairlines, borders */
  --rule-2:   #eeeadb;  /* lighter rules (tbl rows) */
}
```

### Accent & signal
```css
:root {
  --accent:       oklch(0.48 0.13 45);   /* terracotta — the one accent */
  --accent-soft:  oklch(0.95 0.035 45);  /* accent background */
  --verify:       oklch(0.52 0.08 195);  /* cyan — certified, verified, safe */
  --verify-soft:  oklch(0.96 0.025 195);
  --warn:         oklch(0.62 0.14 70);   /* amber — embargo, under review */
  --danger:       oklch(0.52 0.16 25);   /* red — restricted, failed */
}
```

### Usage rules
- **--accent** is used for emphasis, active states, hero keyword highlights. Never whole buttons unless they're CTA.
- **--verify** is reserved for "certified / safe / open access" states.
- **--warn** for embargoed or under-review.
- **--danger** for restricted or failed biosafety.
- Primary CTA uses `--ink` bg + `--paper` text. Secondary uses `--paper-2` + `--rule` border.

---

## 3. Layout & spacing

```css
:root {
  --radius:     3px;   /* badges, inputs */
  --radius-lg:  6px;   /* cards, panels */
}

/* Container widths */
.wrap         { max-width: 1360px; padding: 0 40px; }
.wrap-narrow  { max-width: 980px;  padding: 0 40px; }

/* Standard section padding */
section { padding: 72–96px 0; }
```

- 12-column grid with 24–48px gutters.
- Hairline rules: `0.5px solid var(--rule)`. Never heavier.
- No drop shadows on cards; use hairline borders.

---

## 4. Components

### Buttons
```css
.btn          { padding: 10px 18px; font-size: 13.5px; border-radius: 999px; font-weight: 500; }
.btn-primary  { background: var(--ink); color: var(--paper); }
.btn-ghost    { border: 0.5px solid var(--rule); background: var(--paper-2); }
.btn-accent   { background: var(--accent); color: var(--paper); }
.btn-sm       { padding: 6px 12px; font-size: 12px; }
```

### Badges (status pills)
```css
.badge         { padding: 3px 9px; radius: 3px; font-mono 10.5px uppercase; letter-spacing: 0.06em; }
.badge-verify  { color: var(--verify); bg: var(--verify-soft); }
.badge-warn    { color: var(--warn); }
.badge-accent  { color: var(--accent); bg: var(--accent-soft); }
.badge-dot::before { content: ''; 5px circle of currentColor; }
```

### Cards
```css
.card {
  background: var(--paper-2);
  border: 0.5px solid var(--rule);
  border-radius: 6px;
  padding: 28px;
}
```

### Tables
- Header row background: `var(--paper-3)`.
- Column headers: mono, 10.5px, UPPERCASE, `var(--ink-3)`.
- Cell borders: `0.5px solid var(--rule-2)`.
- Row hover: `background: var(--paper-2)`.
- Action column: replace arrows with `"See record"`, `"Embargoed"`, `"Restricted"` + lock/open icon, coloured by state.

### Section eyebrows
```html
<div class="eyebrow">§ 01 — Section title</div>
```
Always prefixed with `§` and a number for editorial rhythm. Mono, 11px, UPPERCASE, letter-spacing 0.14em.

---

## 5. Iconography & imagery

- **No emoji. No stock illustrations.**
- Custom SVGs only: helix (thin-line), codon-grid watermark, certificate seal, shield, lock/open.
- Stroke weights: 0.5–1.2px. Never heavier.
- Imagery is monochrome + single accent. No gradients except extremely subtle radial paper-grain.

---

## 6. Motion

- Transitions: 150ms ease on hover (colour, border).
- Route change: 400ms fade + 4px translate-Y.
- Counters: 1200ms ease-out cubic.
- Pulse dot on "LIVE" status: 2.4s ease-in-out infinite.
- Certificate seal: 60s linear infinite rotation on outer ring only.

---

## 7. Voice & copy

- **Tone:** academic but warm (Nature editorials, not press releases).
- Use `§` section prefix + Roman numerals for Charter items.
- Titles are short, declarative, occasionally aphoristic ("Four pillars.", "All three gates passed.").
- Accent colour `<span>` on one keyword per hero, never more.
- Mono text for IDs (`AG-2026-018427`), dates (`2026-04-22`), hashes, CLI, system status.
- Write `E. coli` not `e.coli`; italicise genus names.

---

## 8. Pages map

| Route | Purpose | File region |
|---|---|---|
| `home` | Landing / overview | `HomePage` in HTML |
| `registry` | Browse certified sequences | `RegistryPage` |
| `record` | GenBank-style sequence detail | `RecordPage` (reached from registry only) |
| `register` | Submit wizard (4 steps) | `RegisterPage` |
| `about` | Charter | `AboutPage` |
| `demo` | Run-without-depositing sandbox | `DemoPage` |

---

## 9. When creating a new page

1. Import Manrope + JetBrains Mono.
2. Paste the `:root` tokens from §2 into global CSS.
3. Use `.wrap` or `.wrap-narrow` containers.
4. Start the page with an `.eyebrow` + `.display` h1 + `.lede` paragraph.
5. Group content into `section`s with 72–96px vertical padding, separated by `hr.hr` (0.5px rule).
6. Use `.card` for enclosed content. Never add shadows.
7. Any status/state → use the badge component with the right colour token.
8. Any ID, hash, timestamp → mono.
9. Any keyword → one per hero only, in `--accent`.

This file lives in the project root and should be kept in sync whenever tokens or component conventions change.
