# ArtGene Archive — Demo Day Page Brief
**Document version:** 1.0  
**Last updated:** 2026-04-24  
**Branch:** `claude/demo-page-new-ui-KKIRQ`  
**Author:** Claude Code (generated from full codebase audit)

---

## Purpose

This document is a structured brief for building the ArtGene **Demo Day showcase page** (`/showcase`). It is written as a series of self-contained prompts you can hand directly to Claude Design, one section at a time.

The goal is a single long-form page that tells the ArtGene story end-to-end as a user walkthrough. Every major feature that is **already working** is shown as a live interactive widget. Features that are **planned but not yet built** are shown in a clearly labelled "In Pipeline" section at the end.

---

## Audience

**Primary:** Funders, strategic partners, and institutional reviewers visiting the project for the first time — non-technical but scientifically literate.

**Secondary:** Technical evaluators who want to probe the live API.

**What they need to leave knowing:**
1. ArtGene solves a real, urgent problem (no public registry for AI-designed biological sequences).
2. The core infrastructure is already working end-to-end (pipeline → watermark → certificate → provenance).
3. The roadmap is concrete and credible.

---

## How to Use This Document

Each numbered `## PROMPT` section below is a standalone instruction for Claude Design. Work through them in order. Each prompt:
- Specifies the **route and file** to create or edit.
- Lists the **existing components** to reuse (never recreate them).
- Lists the **API endpoints** to call (all are auth-free demo endpoints).
- Describes the **layout and content** precisely.
- Notes any **design system tokens** from `design-reference/CD_theme.md` to apply.

Do **not** alter `globals.css`, the shared `layout.tsx`, `SiteHeader`, or `SiteFooter`. All work is confined to the new `/showcase` route and its sub-components.

---

## Effort Estimation

All components, the design system, and all required API endpoints already exist. The work is **assembly and narrative wiring**, not new engineering.

| # | Section | New build needed | Reuses existing | Est. days |
|---|---------|-----------------|-----------------|-----------|
| 1 | Shell + page route | New file `app/showcase/page.tsx` | `SiteHeader`, `SiteFooter`, `globals.css` | 0.25 |
| 2 | Hero | Narrative copy + layout | `Helix.tsx`, `Counter.tsx`, `GovStrip.tsx` | 0.5 |
| 3 | Feature map (Done / Pipeline) | New grid section | `CertBadges.tsx` badge patterns | 0.75 |
| 4 | Live biosafety pipeline | Sequence selector + trigger | `GateProgressTracker.tsx`, `/api/proxy/analyse` | 1.5 |
| 5 | Watermark + certificate | Narrative wrapper | `CodonGrid.tsx`, `CertSeal.tsx` | 0.75 |
| 6 | Provenance tracing | Condensed from `/demo` page | `CodonGrid.tsx`, `/api/proxy/analyse` | 0.75 |
| 7 | Fragment assembly screen | Condensed from `/demo/fragments` | `FastaUploader.tsx`, `/api/proxy/analyse/fragments` | 0.5 |
| 8 | Compliance + Synthesis Auth | New display cards | `/api/proxy/certificates/{id}/compliance` | 0.5 |
| 9 | Registry live snapshot | Mini-table | `/api/proxy/certificates/` | 0.5 |
| 10 | In-pipeline roadmap | New section | Badge patterns only | 0.5 |
| 11 | CTA + responsive polish | Global pass | — | 1.0 |
| | **Total** | | | **~7.5 days** |

**With a developer already familiar with this codebase: 4–5 days.**  
**From cold start following this brief: 7–8 days.**

---

---
## PROMPT 1 — Shell & Page Route
---

### What to build
Create the scaffold for the `/showcase` page. No section content yet — just the outer shell, the sticky sidebar, and the section skeleton. Every subsequent prompt will fill in one section.

### File to create
`apps/dashboard/app/showcase/page.tsx`

### Instructions

1. Add `'use client'` at the top (the page uses `IntersectionObserver` for sidebar highlighting).

2. Import `SiteHeader` and `SiteFooter` from `@/components/design/SiteHeader` and `@/components/design/SiteFooter`. Import `GovStrip` from `@/components/design/GovStrip`. Render them wrapping `<main>`.

3. Define a `SECTIONS` constant array:
```ts
const SECTIONS = [
  { id: 'hero',       label: '§ 01 — Overview' },
  { id: 'features',   label: '§ 02 — Features' },
  { id: 'pipeline',   label: '§ 03 — Biosafety' },
  { id: 'watermark',  label: '§ 04 — Watermark' },
  { id: 'provenance', label: '§ 05 — Provenance' },
  { id: 'fragments',  label: '§ 06 — Fragments' },
  { id: 'compliance', label: '§ 07 — Compliance' },
  { id: 'registry',   label: '§ 08 — Registry' },
  { id: 'roadmap',    label: '§ 09 — Roadmap' },
  { id: 'cta',        label: '§ 10 — Get involved' },
]
```

4. Use `useState<string>` to track the active section ID. Use a single `IntersectionObserver` (threshold `0.4`) across all section refs to update the active ID as the user scrolls.

5. **Layout structure:**
```tsx
<div style={{ display: 'flex' }}>
  {/* Sidebar — hidden below 1024px via CSS */}
  <aside className="showcase-sidebar">
    {SECTIONS.map(s => (
      <a key={s.id} href={`#${s.id}`}
         className={activeSection === s.id ? 'active' : ''}>
        {s.label}
      </a>
    ))}
  </aside>

  {/* Main content */}
  <div className="showcase-content">
    {SECTIONS.map(s => (
      <section key={s.id} id={s.id} className="showcase-section">
        <div className="wrap">
          <p className="eyebrow">{s.label}</p>
          {/* placeholder — will be replaced section by section */}
        </div>
      </section>
    ))}
  </div>
</div>
```

6. Add these CSS classes to `globals.css` (append at the bottom, do not change existing rules):
```css
/* Showcase page */
.showcase-sidebar {
  position: sticky;
  top: 72px;
  height: calc(100vh - 72px);
  width: 200px;
  flex-shrink: 0;
  padding: 40px 0 40px 40px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
}
.showcase-sidebar a {
  font-family: var(--font-mono);
  font-size: 10.5px;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--ink-3);
  text-decoration: none;
  padding: 6px 12px;
  border-left: 2px solid transparent;
  transition: color 150ms, border-color 150ms;
  white-space: nowrap;
}
.showcase-sidebar a:hover,
.showcase-sidebar a.active {
  color: var(--accent);
  border-left-color: var(--accent);
}
.showcase-content { flex: 1; min-width: 0; }
.showcase-section { padding: 80px 0; }
.showcase-section:nth-child(even) { background: var(--paper-3); }
@media (max-width: 1024px) { .showcase-sidebar { display: none; } }
```

7. Add a link to `/showcase` in `SiteHeader.tsx` nav list after the existing "Docs" link, labelled **"Demo Day"**, styled with `.btn .btn-accent .btn-sm` so it stands out.

### Done when
- Navigating to `/showcase` shows the page with the sidebar and 10 labelled placeholder sections.
- Scrolling highlights the correct sidebar entry.
- No TypeScript errors.

---

---
## PROMPT 3 — Feature Map (`#features`)
---

### What to build
A scannable grid showing every feature and capability of the platform. Each card is labelled **LIVE** (green `--verify`) or **IN PIPELINE** (amber `--warn`). This is the funder's "what does it do?" cheat-sheet before they interact with the live demos below.

### Layout
Section band background: `var(--paper-3)`.  
3-column card grid on desktop, 2-col tablet, 1-col mobile.

```
§ 02 — Features

What's built — and what's next.
[lede]

┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ LIVE         │ │ LIVE         │ │ LIVE         │
│ Four-gate    │ │ TINSEL codon │ │ WOTS+ cert   │
│ biosafety    │ │ watermark    │ │ signing      │
│ pipeline     │ │              │ │              │
└──────────────┘ └──────────────┘ └──────────────┘
... (all 18 cards)
```

### Feature card data
Define this as a `const FEATURES` array. Each card has: `status: 'live' | 'pipeline'`, `title`, `body` (one short sentence), `anchor` (optional — links to the relevant demo section below).

```ts
const FEATURES = [
  // ── LIVE ──────────────────────────────────────────────────
  {
    status: 'live',
    title: 'Four-gate biosafety pipeline',
    body: 'Every sequence runs gates α, β, γ, δ automatically before a certificate is issued.',
    anchor: '#pipeline',
  },
  {
    status: 'live',
    title: 'TINSEL codon watermark',
    body: 'A spread-spectrum HMAC-SHA3-256 watermark embedded invisibly in synonymous codon positions.',
    anchor: '#watermark',
  },
  {
    status: 'live',
    title: 'Post-quantum WOTS+ certificate',
    body: 'Every certificate is signed with a Winternitz One-Time Signature — quantum-resistant by design.',
    anchor: '#watermark',
  },
  {
    status: 'live',
    title: 'Immutable audit ledger',
    body: 'A blockchain-style SHA3-256 chained log. DB-level trigger prevents any row from being modified.',
    anchor: null,
  },
  {
    status: 'live',
    title: 'Unique AG-ID accession',
    body: 'Each registered sequence receives a permanent, citable accession number (e.g. AG-2026-000001).',
    anchor: '#registry',
  },
  {
    status: 'live',
    title: 'Provenance tracing',
    body: 'Issue fingerprinted copies to recipients. If a sequence leaks, identify the source in milliseconds.',
    anchor: '#provenance',
  },
  {
    status: 'live',
    title: 'Fragment assembly risk screen',
    body: 'Screen multi-FASTA fragments individually and as assembled contigs — catches split-vector evasion.',
    anchor: '#fragments',
  },
  {
    status: 'live',
    title: 'ESMFold structural screening (Gate α)',
    body: 'Per-residue pLDDT scores and instability index from ESMAtlas — folds before certifying.',
    anchor: '#pipeline',
  },
  {
    status: 'live',
    title: 'SecureDNA + IBBIS hazard screening (Gate β)',
    body: 'DOPRF privacy-preserving pathogen screening and IBBIS HMM family classification.',
    anchor: '#pipeline',
  },
  {
    status: 'live',
    title: 'Host-specific codon optimisation check (Gate γ)',
    body: 'CAI, GC content, and HGT risk against six host organisms: E. coli, human, yeast, CHO, insect, plant.',
    anchor: '#pipeline',
  },
  {
    status: 'live',
    title: 'Functional embedding similarity (Gate δ)',
    body: 'Amino acid composition fingerprint compared against a reference dangerous-protein database.',
    anchor: '#pipeline',
  },
  {
    status: 'live',
    title: 'US DURC + EU Dual-Use compliance manifest',
    body: 'Machine-readable attestation document generated per certificate for regulatory submission.',
    anchor: '#compliance',
  },
  {
    status: 'live',
    title: 'ArtGene-SCD-1.0 synthesis clearance',
    body: 'Signed synthesizer authorisation document compatible with firmware-level screening.',
    anchor: '#compliance',
  },
  {
    status: 'live',
    title: 'Multi-gene pathway bundles',
    body: 'Group related sequences into a Merkle-rooted pathway bundle with a single pathway ID.',
    anchor: null,
  },
  {
    status: 'live',
    title: 'Public searchable registry',
    body: 'All certified sequences are publicly discoverable by AG-ID, institution, or sequence hash.',
    anchor: '#registry',
  },
  // ── IN PIPELINE ───────────────────────────────────────────
  {
    status: 'pipeline',
    title: 'LWE lattice commitment (real)',
    body: 'Post-quantum zero-knowledge commitment currently stubbed — full implementation in Phase 4.',
    anchor: null,
  },
  {
    status: 'pipeline',
    title: 'Merkle inclusion proofs for pathways',
    body: 'Per-sequence membership proofs within a pathway bundle. Phase 7.',
    anchor: null,
  },
  {
    status: 'pipeline',
    title: 'ESM-2 650M production embeddings',
    body: 'Gate δ will switch from composition fingerprint to full ESM-2 mean-pooled cosine similarity in production.',
    anchor: null,
  },
  {
    status: 'pipeline',
    title: 'SDK: Python, R, Julia',
    body: 'First-party client libraries for programmatic submission and verification.',
    anchor: null,
  },
  {
    status: 'pipeline',
    title: 'Rich sequence metadata',
    body: 'Abstract, authors, ORCID, keywords, generating model, molecular weight, and feature map per record.',
    anchor: null,
  },
  {
    status: 'pipeline',
    title: 'Live ticker & real-time updates',
    body: 'WebSocket feed of new deposits on the home page and registry.',
    anchor: null,
  },
]
```

### Card component
Each card is a `.card` div. Status badge top-right: use `.badge .badge-verify` for `live` (text: `● LIVE`), `.badge .badge-warn` for `pipeline` (text: `◌ IN PIPELINE`).

If `anchor` is set, the card title is a `<a href={anchor}>` link with `color: inherit` and underline only on hover.

### Lede copy (above the grid)
```
Fifteen capabilities are live today. Six more are in active development.
Click any live feature to jump to its interactive demo below.
```

### Done when
- All 21 cards render in a 3-column grid.
- LIVE cards have cyan badge; IN PIPELINE have amber badge.
- Cards with anchors scroll to the correct section on click.
- No TypeScript errors.

---
## PROMPT 2 — Hero Section (`#hero`)
---

### What to build
Replace the `#hero` placeholder in `showcase/page.tsx` with a full hero section that frames the problem, states what ArtGene is, and anchors the page with animated stat counters.

### Layout
Two-column on desktop (text left, helix animation right). Single column on mobile.

```
┌─────────────────────────────────────────────────────┐
│  EYEBROW: § 01 — Overview                           │
│                                                     │
│  [Display heading — 2 lines]                        │
│  "The first public registry for                     │
│   AI-designed biological sequences."                │
│                                                     │
│  [Lede paragraph — 2 sentences]                     │
│                                                     │
│  [4 stat counters]     [Animated Helix SVG]         │
│                                                     │
│  [2 CTA buttons]                                    │
└─────────────────────────────────────────────────────┘
```

### Instructions

1. **Heading copy:**
```
The first public registry for
AI-designed biological sequences.
```
Use `.display` class. The word **"AI-designed"** gets `color: var(--accent)`. No italics, no other colour.

2. **Lede copy:**
```
Generative models now produce proteins and genes faster than the 
scientific community can catalogue them. ArtGene is the infrastructure 
layer: automated biosafety screening, codon watermarking, post-quantum 
certificates, and an immutable public ledger — for every sequence.
```

3. **Stat counters** — import `Counter` from `@/components/design/Counter`. Arrange in a 2×2 grid or 4-column row. Values and labels:
   - `1,247` — Sequences registered
   - `4` — Biosafety gates
   - `12` — Partner institutions
   - `100%` — Open access

4. **Animated helix** — import `Helix` from `@/components/design/Helix`. Render it at `width={360} height={420}` on the right column. Hide on mobile.

5. **CTA buttons:**
   - Primary (`.btn .btn-primary`): `"Run a live demo ↓"` — `href="#pipeline"` (scrolls to pipeline section)
   - Ghost (`.btn .btn-ghost`): `"Read the charter"` — `href="/about"`

6. **Background:** `var(--paper)` (default, no band colour on the hero).

7. **No partner logos here.** Those are in the existing home page; don't duplicate them.

### Done when
- Hero renders with heading, lede, counters animating on mount, helix visible on desktop.
- "Run a live demo" button smooth-scrolls to `#pipeline`.
- Mobile: single column, helix hidden, counters stack 2×2.

---

### Key risk
Section 4 (live pipeline) takes the longest — the `GateProgressTracker` component exists but has only been used inside the `/register` wizard. Adapting it to work as a standalone showcase widget with pre-seeded input is the single trickiest task. Plan that day first.

---

## Page Architecture

**Route:** `apps/dashboard/app/showcase/page.tsx`  
**Type:** Client component (`'use client'`)  
**URL:** `/showcase`

The page is a **single scrolling document** with a sticky progress sidebar on desktop (≥1024px). Each section is an `<section id="...">` so the sidebar can highlight the active section via `IntersectionObserver`.

```
/showcase
│
├── <GovStrip />                          (imported, no changes)
├── <SiteHeader />                        (imported, no changes)
│
├── <main>
│   ├── Sticky sidebar (desktop only)     — anchor links to each section
│   │
│   ├── #hero          Hero
│   ├── #features      Feature Map
│   ├── #pipeline      Biosafety Pipeline Demo
│   ├── #watermark     Watermark + Certificate
│   ├── #provenance    Provenance Tracing
│   ├── #fragments     Fragment Assembly
│   ├── #compliance    Compliance & Synthesis Auth
│   ├── #registry      Registry Snapshot
│   ├── #roadmap       In-Pipeline Roadmap
│   └── #cta           Call to Action
│
└── <SiteFooter />                        (imported, no changes)
```

### Sidebar behaviour
- On desktop: fixed left rail, `width: 200px`, lists section names as anchor links.
- Active section: text colour `--accent`, left border `2px solid var(--accent)`.
- On mobile/tablet: sidebar hidden; a small floating "§" button reveals a bottom-sheet nav.
- Each section anchor link is prefixed with its `§` number, matching the eyebrow style.

### Section rhythm
Every section follows this shell:
```tsx
<section id="pipeline" className="showcase-section">
  <div className="wrap">
    <div className="eyebrow">§ 03 — Biosafety Pipeline</div>
    <h2>Four-gate automated biosafety review</h2>
    <p className="lede">…</p>
    {/* interactive widget */}
  </div>
</section>
```
Alternate sections use `background: var(--paper-3)` as a band to provide visual rhythm without borders.

### Key assumptions
- Zero new API endpoints needed. All demo routes are already live and require no authentication.
- Zero new design decisions. Every token, font, colour, and spacing rule is in `CD_theme.md`.
- The six golden test-vector sequences in `packages/tinsel-demo/` are used as the demo payload — no real user sequences needed.
- Sections 4, 6, and 7 make real API calls to the running backend. A static fallback (hardcoded response) must be provided for when the API is unreachable, so the page never appears broken during a live funder demo.
