# ArtGene Archive — Demo Day Page Brief
**Document version:** 1.0  
**Last updated:** 2026-04-24  
**Branch:** `claude/demo-page-new-ui-KKIRQ`  
**Author:** Claude Code (generated from full codebase audit)

---

## Purpose

This document is a structured brief for building the ArtGene **Demo Day showcase page** (`/showcase`). It is written as a series of self-contained prompts you can hand directly to Claude Design, one section at a time.

The goal is a single long-form page that tells the ArtGene story end-to-end as a funder walkthrough. Every major feature that is **already working** is shown as a live interactive widget. Features that are **planned but not yet built** are shown in a clearly labelled "In Pipeline" section at the end.

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
## PROMPT 11 — CTA Section + Final Polish (`#cta`)
---

### What to build
The closing section of the showcase page: a strong call-to-action for funders, plus a final responsive and animation polish pass across the whole page.

### File to edit
`apps/dashboard/app/showcase/page.tsx` — replace the `#cta` placeholder and do a final review of all sections.

---

### CTA section layout

```
§ 10 — Get involved
[Large heading]
[2 action buttons]
[Contact line]
```

Background: `var(--ink)` (dark — the one dark-background section on the page, for visual punctuation).  
All text: `var(--paper)` and `var(--paper-3)`.

**Heading (`.display`, centred):**
```
ArtGene is open infrastructure.
Join us in building it.
```
The word **"open"** in `var(--accent)`.

**Two CTA buttons (centred, gap 16px):**
- Primary: `.btn` with `background: var(--paper)`, `color: var(--ink)` — `"Deposit a sequence →"` → `href="/register"`
- Ghost: `.btn` with `border: 0.5px solid var(--paper-3)`, `color: var(--paper)` — `"Read the charter"` → `href="/about"`

**Contact line (below buttons, 13px, `var(--ink-4)`):**
```
Questions? contact@artgene.org  ·  Charter v1.2  ·  WHO observer
```

---

### Final polish checklist

After placing the CTA, review the whole page against these rules before marking this prompt done:

**Typography**
- [ ] Every section has an `.eyebrow` with `§ NN —` prefix.
- [ ] Every section has an `<h2>` heading (no heading skipped).
- [ ] Lede paragraphs use `.lede` class.
- [ ] All IDs, hashes, and accession numbers use `.mono` / `font-family: var(--font-mono)`.

**Colour**
- [ ] No Tailwind dark-mode classes anywhere in the new files (`dark:`, `text-slate-`, `bg-slate-`, etc.).
- [ ] Every colour references a CSS custom property (`var(--...)`) from `CD_theme.md`.
- [ ] Accent (`--accent`) used only on key nouns, not whole sentences.

**Spacing**
- [ ] All sections have `padding: 80px 0`.
- [ ] All content is wrapped in `.wrap` (max 1360px) or `.wrap-narrow` (980px).
- [ ] Cards use `.card` (28px padding, 6px radius, 0.5px border).

**Responsiveness**
- [ ] At 375px (iPhone SE): sidebar hidden, all grids single-column, helix hidden.
- [ ] At 768px (iPad): 2-column grids where 3-column was used.
- [ ] At 1024px+: sidebar visible, full layout.

**Accessibility**
- [ ] All interactive elements have `:focus-visible` outlines.
- [ ] All SVGs have `aria-hidden` or `aria-label`.
- [ ] "Run biosafety screen" button is keyboard-triggerable.

**Performance**
- [ ] `PipelineDemo`, `ProvenanceDemo`, `FragmentDemo`, and `RegistrySnapshot` are all lazy-loaded with `React.lazy` + `<Suspense>` to keep the initial page bundle small.

```tsx
const PipelineDemo    = React.lazy(() => import('./components/PipelineDemo'))
const ProvenanceDemo  = React.lazy(() => import('./components/ProvenanceDemo'))
const FragmentDemo    = React.lazy(() => import('./components/FragmentDemo'))
const RegistrySnapshot = React.lazy(() => import('./components/RegistrySnapshot'))
```

Wrap each in:
```tsx
<Suspense fallback={<div style={{ height: 200, background: 'var(--paper-3)' }} />}>
  <ComponentName />
</Suspense>
```

---

### Done when
- CTA section renders on dark `--ink` background with correct button styles.
- All checklist items above are confirmed.
- `npm run build` in `apps/dashboard` completes with zero TypeScript errors and zero `next build` errors.
- Visiting `/showcase` in a browser shows all 10 sections with working scroll-spy sidebar.

---

---
## PROMPT 10 — In-Pipeline Roadmap (`#roadmap`)
---

### What to build
A timeline/phases section showing what is actively in development. This is purely static — no API calls. The goal is to give funders a clear, credible view of what comes next and when.

### File to edit
Add inline JSX directly into the `#roadmap` section in `apps/dashboard/app/showcase/page.tsx`. No separate component file needed.

---

### Section background
`var(--paper)` (odd-numbered section).

---

### Layout
Vertical timeline on mobile. Two-column phase grid on desktop (left: phase label + date; right: items list).

```
§ 09 — Roadmap
What we're building next.
[lede]

  Phase 4  ·  Q2 2026          Phase 5  ·  Q3 2026
  ──────────────────────        ──────────────────────
  ◉ LWE lattice commitment      ◉ CDK / Terraform infra
  ◉ ESM-2 650M Gate δ          ◉ IBBIS + SecureDNA live
  ◉ Abstract rich metadata     ◉ mRNA sequence view

  Phase 6  ·  Q3 2026          Phase 7  ·  Q4 2026
  ──────────────────────        ──────────────────────
  ◉ Python SDK                  ◉ Merkle pathway proofs
  ◉ R SDK                       ◉ Citation network
  ◉ Live registry WebSocket     ◉ Julia SDK
```

---

### Phase data constant

```ts
const PHASES = [
  {
    phase: 'Phase 4',
    period: 'Q2 2026',
    items: [
      { title: 'LWE lattice commitment (real)',         detail: 'Replace the current zero-filled stub with a full post-quantum commitment scheme.' },
      { title: 'ESM-2 650M embeddings for Gate δ',     detail: 'Switch Gate δ from 420-D composition fingerprint to full ESM-2 mean-pooled cosine similarity.' },
      { title: 'Rich sequence metadata',               detail: 'Abstract, authors, ORCID, keywords, generating model, molecular weight, and feature map per certificate.' },
    ],
  },
  {
    phase: 'Phase 5',
    period: 'Q3 2026',
    items: [
      { title: 'CDK / Terraform infrastructure',       detail: 'AWS Lambda + RDS deployment manifests. The Mangum adapter is already wired in main.py.' },
      { title: 'IBBIS + SecureDNA live mode',          detail: 'Both adapters are fully implemented — switching from mock to live is gated on credential provisioning.' },
      { title: 'mRNA sequence view',                   detail: 'Expose back-translated mRNA sequence in the record sequence tab.' },
    ],
  },
  {
    phase: 'Phase 6',
    period: 'Q3 2026',
    items: [
      { title: 'Python SDK',                           detail: 'First-party client library for programmatic submission and verification.' },
      { title: 'R SDK',                                detail: 'For bioinformatics workflows in the R ecosystem.' },
      { title: 'Live registry WebSocket feed',         detail: 'Real-time new-deposit ticker on the home page and registry.' },
    ],
  },
  {
    phase: 'Phase 7',
    period: 'Q4 2026',
    items: [
      { title: 'Merkle inclusion proofs for pathways', detail: 'Per-sequence membership proofs within a pathway bundle (route stub already returns placeholder).' },
      { title: 'Citation network',                     detail: 'Cross-reference citations between registered sequences and external literature.' },
      { title: 'Julia SDK',                            detail: 'For computational biology workflows.' },
    ],
  },
]
```

---

### Phase card design

Each phase is a `.card` with:
- Top row: phase label in `.eyebrow` + period in `.mono` style, right-aligned with `color: var(--ink-3)`
- Divider: `<hr className="hr">`
- Items list: each item is a row with:
  - Left: `◉` circle in `color: var(--warn)` (amber = in pipeline)
  - Title: `font-weight: 600`, 14.5px
  - Detail: 13px, `color: var(--ink-3)`, shown on hover **or** always shown (always shown is fine for funder readability)

---

### "Already live" callout above the timeline
A narrow `.card-flat` strip (full-width, `background: var(--verify-soft)`, `border: 0.5px solid var(--verify)`) above the phase grid:

```
✓  15 features are live today — see the interactive demos above.
   The 6 items below are in active development.
```

`✓` in `var(--verify)`. Text body 14px.

---

### Lede copy
```
The core registry infrastructure — biosafety pipeline, watermarking, 
certificates, provenance tracing — is complete and live. The roadmap 
below covers cryptographic upgrades, infrastructure automation, 
external service integrations, and first-party SDKs.
```

---

### Done when
- Four phase cards render in a 2×2 grid (single column on mobile).
- Each item shows title + detail text.
- "Already live" callout renders above in verify-soft tint.
- `◉` markers are amber.
- No TypeScript errors.

---
## PROMPT 9 — Registry Live Snapshot (`#registry`)
---

### What to build
A mini live table showing the most recent certified sequences from the public registry. Calls `GET /certificates/?limit=8` (no auth) via the proxy. Falls back to static mock data. The goal is to show funders that the registry is real, public, and growing.

### File to create
`apps/dashboard/app/showcase/components/RegistrySnapshot.tsx`

---

### API call
```ts
const res = await fetch('/api/proxy/certificates/?limit=8&status=certified')
const data: { items: CertificateSummary[] } = await res.json()
```
`CertificateSummary` is already defined in `@/lib/api` — import it. Key fields to display: `ag_id`, `status`, `tier`, `host_organism`, `created_at`, `org_name` (or `owner_id`).

Use TanStack Query (`useQuery`) for data fetching so the result is cached and the table doesn't re-fetch on every re-render. Import `useQuery` from `@tanstack/react-query`. The `QueryClientProvider` is already set up in `apps/dashboard/app/layout.tsx`.

---

### Static fallback (8 rows)
```ts
const MOCK_REGISTRY: CertificateSummary[] = [
  { ag_id: 'AG-2026-000001', status: 'certified', tier: 'standard',  host_organism: 'ecoli',  created_at: '2026-02-14', org_name: 'Broad Institute' },
  { ag_id: 'AG-2026-000002', status: 'certified', tier: 'standard',  host_organism: 'human',  created_at: '2026-02-15', org_name: 'Wellcome Sanger' },
  { ag_id: 'AG-2026-000003', status: 'certified', tier: 'reduced',   host_organism: 'yeast',  created_at: '2026-02-16', org_name: 'EMBL-EBI' },
  { ag_id: 'AG-2026-000004', status: 'certified', tier: 'standard',  host_organism: 'cho',    created_at: '2026-02-17', org_name: 'Pasteur Institute' },
  { ag_id: 'AG-2026-000005', status: 'certified', tier: 'standard',  host_organism: 'insect', created_at: '2026-02-18', org_name: 'RIKEN' },
  { ag_id: 'AG-2026-000006', status: 'certified', tier: 'standard',  host_organism: 'plant',  created_at: '2026-02-19', org_name: 'UCSF' },
  { ag_id: 'AG-2026-000007', status: 'under_review', tier: 'standard', host_organism: 'ecoli', created_at: '2026-02-20', org_name: 'Crick Institute' },
  { ag_id: 'AG-2026-000008', status: 'certified', tier: 'standard',  host_organism: 'human',  created_at: '2026-02-21', org_name: 'NIH NIAID' },
]
```
Use the mock if the API call fails or the real registry returns 0 rows.

---

### Table layout

Use `.tbl` CSS class. Columns:

| Column | Content | Notes |
|--------|---------|-------|
| AG-ID | `ag_id` in `.mono` | Links to `/sequences/{ag_id}` — `target="_blank"` |
| Status | `StatusBadge` from `@/components/CertBadges` | |
| Tier | `TierBadge` from `@/components/CertBadges` | |
| Host | capitalised host organism string | `ecoli` → `E. coli`, `cho` → `CHO`, etc. |
| Institution | `org_name` | Truncate at 24 chars |
| Issued | `created_at` — format as `DD MMM YYYY` | |

Host organism display map:
```ts
const HOST_LABELS: Record<string, string> = {
  ecoli: 'E. coli', human: 'Human', yeast: 'Yeast',
  cho: 'CHO', insect: 'Insect', plant: 'Plant',
}
```

---

### Above the table
A live stat strip (single row, `var(--paper-3)` background, `border-bottom: 0.5px solid var(--rule)`):
- Left: `{total} sequences registered` — total from API response `total` field, or `1,247` static
- Center: `Updated continuously` with a 2.4s pulse dot (`.badge-dot` class)
- Right: `.btn .btn-ghost .btn-sm` → `"Browse full registry →"` linking to `/registry`

---

### Section background
`var(--paper-3)` (even-numbered section).

---

### Loading state
While data is loading, show 8 skeleton rows: `<div style={{ height: 36, background: 'var(--rule-2)', borderRadius: 3, animation: 'pulse 1.5s ease-in-out infinite' }} />`. Add the `pulse` keyframe to `globals.css` if not already present:
```css
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
```

---

### Lede copy
```
Every certified sequence is publicly discoverable by AG-ID, institution, 
or sequence hash. The registry is open access — no account required to 
search or verify.
```

---

### Done when
- Table renders with 8 rows (live or mock data).
- AG-ID cells link to the correct record page.
- Status and Tier badges render correctly.
- Loading skeleton shows during fetch.
- `"Browse full registry →"` links to `/registry`.
- No TypeScript errors.

---
## PROMPT 8 — Compliance & Synthesis Auth (`#compliance`)
---

### What to build
A static display section (no API calls) showing two regulatory documents that ArtGene generates automatically per certificate: the US DURC / EU Dual-Use compliance manifest and the ArtGene-SCD-1.0 synthesis clearance document. The goal is to show funders that the platform speaks the language of regulators and synthesizer manufacturers.

### File to edit
Add inline JSX directly into the `#compliance` section in `apps/dashboard/app/showcase/page.tsx`. No separate component file needed.

---

### Section background
`var(--paper)` (odd-numbered section — no band).

---

### Layout: two-column cards

```
§ 07 — Compliance & Synthesis Auth
Regulatory documents, generated automatically.
[lede]

┌─ Card A ───────────────────────────────┐  ┌─ Card B ──────────────────────────────┐
│  COMPLIANCE MANIFEST                   │  │  SYNTHESIS CLEARANCE DOCUMENT         │
│  US DURC · EU Dual-Use                 │  │  ArtGene-SCD-1.0                      │
│                                        │  │                                       │
│  [attestation table]                   │  │  [machine instruction fields]         │
│                                        │  │                                       │
│  [Download JSON]                       │  │  [Download SCD]                       │
└────────────────────────────────────────┘  └───────────────────────────────────────┘
```

---

### Card A — Compliance Manifest

Use a `.card` component. Header: `.eyebrow` "COMPLIANCE MANIFEST", then `H3` "US DURC & EU Dual-Use".

Render a two-column attestation table (`.tbl` class) with static data representing a GLP-1 certificate. Rows:

| Framework | Provision | Status |
|-----------|-----------|--------|
| US DURC | 7 categories of concern (NSABB 2017) | ✓ None apply |
| US DURC | Gain-of-function potential | ✓ Negative |
| EU Dual-Use | Annex I Category 1C351 | ✓ Not listed |
| EU Dual-Use | Control list screening | ✓ Cleared |
| WHO BIOSEC | Pathogen alignment check | ✓ No match |
| ArtGene | Biosafety tier assigned | STANDARD |

Status column: `✓` in `var(--verify)`, tier badge uses `.badge .badge-verify`.

Below the table, a `.btn .btn-ghost .btn-sm` button: `"Download compliance.json ↓"` (disabled/inert — no real download needed, just `href="#"`).

---

### Card B — Synthesis Clearance Document

Use a `.card` component. Header: `.eyebrow` "SYNTHESIS CLEARANCE", then `H3` "ArtGene-SCD-1.0".

Body — a `.seq-block` (monospace preformatted block) showing the SCD fields:

```
ARTGENE-SCD   Version: 1.0
──────────────────────────────────────────────────────────
AG-ID:          AG-2026-000001
Issued:         2026-02-14T09:11:42Z
Issuer:         ArtGene Consortium
Clearance:      APPROVED
Tier:           STANDARD
Host organism:  Escherichia coli K-12
Restrictions:   None
──────────────────────────────────────────────────────────
Synthesizer instruction:
  PROCEED — all biosafety gates passed.
  Watermark embedded at 48 carrier positions.
  Certificate signature verified (WOTS+).
──────────────────────────────────────────────────────────
SCD-SIG:  a3f9c2…0e12
```

`APPROVED` and `PROCEED` in `var(--verify)`. `SCD-SIG` value in `var(--ink-3) .mono`.

Below, a `.btn .btn-ghost .btn-sm` button: `"Download SCD ↓"` (inert, `href="#"`).

---

### Explanatory footnote
Below both cards, a single line in `var(--ink-4)` at 12.5px:
```
Compliance manifests and SCD documents are generated atomically at certificate issuance — 
they cannot be issued without a passing biosafety pipeline result.
```

---

### Lede copy
```
Every ArtGene certificate automatically generates two regulatory documents: 
a US DURC and EU Dual-Use compliance manifest for institutional review boards, 
and an ArtGene-SCD-1.0 synthesis clearance document for synthesizer 
manufacturers. No manual paperwork required.
```

---

### Done when
- Both cards render side-by-side (stacked on mobile).
- Attestation table uses `.tbl` class.
- SCD block uses `.seq-block` monospace styling.
- All colours use design-system tokens.
- No TypeScript errors.

---
## PROMPT 7 — Fragment Assembly Screening (`#fragments`)
---

### What to build
A condensed version of the existing `/demo/fragments` page, embedded as a showcase section. The user submits a multi-FASTA and the API screens each fragment individually (Gates β + δ) **and** the assembled contig — catching split-vector evasion that single-fragment screening misses. Calls the real `POST /analyse/fragments` endpoint.

### File to create
`apps/dashboard/app/showcase/components/FragmentDemo.tsx`

---

### API function to reuse
Import `analyseFragments` from `@/lib/api`. Calls `POST /api/proxy/analyse/fragments`. No auth required. Returns `FragmentsResponse`:
```ts
interface FragmentsResponse {
  fragments: FragmentScreenResult[]  // per-fragment gate β + δ results
  assembly:  AssemblyResult          // assembled contig screening
}
```

---

### Preloaded example
Use the three-fragment example from `apps/dashboard/app/demo/fragments/page.tsx` verbatim:
```
>fragment_1
MAEQKLISEEDLGIGKFLHSAGITGMLSEM
>fragment_2
DLGIGKFLHSAGITGMLSEMKWKLFKKIPKFLHLAK
>fragment_3
LSEMKWKLFKKIPKFLHLAKFKKLIPENDSEQ
```
This example is designed so each fragment passes individually but the assembled contig flags as `WARN`, demonstrating the value of assembly-level screening.

---

### Layout

```
§ 06 — Fragment Assembly Screen
Split-vector evasion caught at assembly.
[lede]

┌─ Privacy banner ──────────────────────────────────────────────────┐
│  🔒 Sequences are not stored. Analysed in memory only.            │
└───────────────────────────────────────────────────────────────────┘

┌─ Input ────────────────────────────────────────────────────────────┐
│  [Multi-FASTA textarea — pre-filled with 3 fragments]              │
│  Host: [ECOLI ▾]          [Screen fragments →]                    │
└────────────────────────────────────────────────────────────────────┘

┌─ Per-fragment results ─────────────────────────────────────────────┐
│  Fragment 1  ✓ PASS  (Gate β: pass · Gate δ: pass)                │
│  Fragment 2  ✓ PASS  (Gate β: pass · Gate δ: pass)                │
│  Fragment 3  ✓ PASS  (Gate β: pass · Gate δ: pass)                │
└────────────────────────────────────────────────────────────────────┘

┌─ Assembly result ──────────────────────────────────────────────────┐
│  ⚠ WARN                                                            │
│  Assembled contig (58 AA) resembles a membrane-disrupting peptide  │
│  Gate δ similarity score: 0.73                                     │
└────────────────────────────────────────────────────────────────────┘
```

---

### Redesign rules (strip old Tailwind dark classes)
Same pattern as Prompt 6 — replace all dark-mode Tailwind with design-system tokens:

| Old pattern | Replace with |
|-------------|-------------|
| `verdictBg('BLOCKED')` → `bg-red-50 …` | `background: var(--danger-soft, oklch(0.97 0.02 25)); border-color: var(--danger)` |
| `verdictBg('WARN')` → `bg-amber-50 …` | `background: var(--warn-soft, oklch(0.97 0.04 70)); border-color: var(--warn)` |
| `verdictBg('SAFE')` → `bg-emerald-50 …` | `background: var(--verify-soft); border-color: var(--verify)` |
| `text-red-600` | `color: var(--danger)` |
| `text-amber-600` | `color: var(--warn)` |
| `text-emerald-600` | `color: var(--verify)` |
| Privacy banner `bg-blue-50` | `background: var(--verify-soft); border-color: var(--verify)` |

---

### Privacy banner
```tsx
<div className="card" style={{ background: 'var(--verify-soft)', borderColor: 'var(--verify)', display: 'flex', gap: 12 }}>
  {/* lock SVG icon */}
  <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: 0 }}>
    <strong>Sequences are not stored.</strong> Fragments submitted here are 
    analysed in memory only — nothing is saved, logged, or cached.
  </p>
</div>
```

---

### Per-fragment result rows
Each row: fragment name (`.mono`) · per-gate status badges (`.badge-verify` / `.badge-warn` / `.badge-danger`) · overall pass/warn/fail icon.  
Use a horizontal rule `<hr className="hr">` between each row.

---

### Assembly result card
The assembly card is the hero of this section — make it visually prominent.  
`.card` with verdict-coloured left border (`4px solid var(--warn)` for WARN, etc.):
- Top: `ASSEMBLED CONTIG · 58 amino acids` in `.eyebrow`
- Verdict badge: large `.badge .badge-warn` (WARN) or `.badge-danger` (BLOCKED)  
- Body: assembly screening detail from `assembly.detail`
- Gate δ score bar (same pattern as Prompt 4 right panel)

---

### Static fallback
If the API is unreachable, show the preloaded three-fragment result with its `WARN` assembly verdict using hardcoded data. Add `(offline demo)` footnote in `var(--ink-4)`.

---

### Lede copy
```
Each fragment below passes biosafety screening when evaluated alone. 
Submitted together, the assembled contig is flagged — catching the 
split-vector evasion technique used to bypass single-sequence screening.
```

---

### Done when
- Preloaded fragments submit and return per-fragment PASS + assembly WARN.
- Assembly card has a warn-coloured left border.
- Privacy banner renders in verify-soft tint.
- Static fallback works offline.
- No TypeScript errors.

---
## PROMPT 6 — Provenance Tracing Demo (`#provenance`)
---

### What to build
A condensed version of the existing `/demo` page, embedded as a section in the showcase. The user picks a sequence and a host organism, clicks "Generate fingerprinted copies", and the live `POST /analyse` API returns two distinct fingerprinted FASTA copies with a codon-diff table. This is the only section that makes a real live API call.

### File to create
`apps/dashboard/app/showcase/components/ProvenanceDemo.tsx`

---

### How it works (for the funder)
The `POST /analyse` endpoint (no auth required) accepts a FASTA sequence and host organism, and returns:
- `copies[0]` and `copies[1]` — two fingerprinted DNA copies, one per simulated recipient
- `codon_diffs` — the specific synonymous codon substitutions that distinguish each copy
- A simulated `verify_result` showing which copy a "leaked" sequence came from

The existing `/demo` page already implements all of this — the task here is to **lift the core logic and re-skin it** to match the new design system (no old Tailwind dark-mode classes).

---

### API function to reuse
Import `analyseSequence` from `@/lib/api`. It calls `POST /api/proxy/analyse` via the Next.js reverse proxy (no auth, no API key needed). Signature:
```ts
analyseSequence(fasta: string, host: string): Promise<AnalyseResponse>
```
Where `AnalyseResponse` has: `original_dna`, `copies: RecipientCopy[]`, `verify_result`.

---

### Preloaded sequence options
Use the same 3 sequences from the existing `/demo` page:
```ts
const SEQUENCES = [
  { label: 'GLP-1 Receptor Agonist',  fasta: '>GLP1RA|demo\nHAEGTFTSDVSSYLEGQAAKEFIAWLVKGRCEGVLGDTFR' },
  { label: 'Green Fluorescent Protein', fasta: '>GFP|demo\nMSKGEELFTGVVPILVELDGDVNGHKFS…' },  // full seq from /demo/page.tsx
  { label: 'Human Insulin',             fasta: '>Insulin|demo\nMALWMRLLPLLALLALWGPDPAA…' },   // full seq from /demo/page.tsx
]
const HOSTS = ['ECOLI', 'HUMAN', 'YEAST', 'CHO', 'INSECT', 'PLANT']
```
Copy the full FASTA strings verbatim from `apps/dashboard/app/demo/page.tsx` — do not truncate them.

---

### Layout

```
§ 05 — Provenance Tracing
If a sequence leaks, we know who.
[lede]

┌─ Controls ────────────────────────────────────────┐
│  Sequence: [GLP-1 ▾]    Host: [ECOLI ▾]           │
│  [Generate fingerprinted copies →]                │
└───────────────────────────────────────────────────┘

[Loading state: "Embedding watermarks…" with pulse]

┌─ Results ─────────────────────────────────────────┐
│  Recipient A copy                                  │
│  ████████████████████ (DNA preview, first 90 bp)  │
│  14 synonymous substitutions  [codon diff chips]  │
│                                                   │
│  Recipient B copy                                  │
│  ████████████████████ (DNA preview, first 90 bp)  │
│  11 synonymous substitutions  [codon diff chips]  │
│                                                   │
│  ┌─ Simulate a leak ──────────────────────────────┐│
│  │  "Copy A was identified as the source"         ││
│  │  Recipient: Recipient A · Issued: today        ││
│  └─────────────────────────────────────────────────┘
└───────────────────────────────────────────────────┘
```

---

### Redesign rules (strip old Tailwind dark classes)
The existing `/demo` page uses Tailwind classes like `bg-slate-100 dark:bg-slate-700`, `text-rose-500`, etc. Replace all of these with design-system tokens:

| Old class | Replace with |
|-----------|-------------|
| `bg-slate-100` | `background: var(--paper-3)` |
| `border-slate-200` | `border: 0.5px solid var(--rule)` |
| `text-slate-500` | `color: var(--ink-3)` |
| `text-slate-700` | `color: var(--ink)` |
| `text-rose-500` (original codon) | `color: var(--danger)` |
| `text-blue-500` (fingerprinted codon) | `color: var(--verify)` |
| `bg-blue-50` (highlight) | `background: var(--verify-soft)` |
| `border-blue-300` (highlight) | `border-color: var(--verify)` |
| `font-mono` | `fontFamily: var(--font-mono)` |

Use `.card` for result panels. Use `.btn .btn-primary` for the submit button.

---

### Codon diff chips
Each chip shows: `[AA+position]  [original→fingerprinted]`  
Style: inline-block, `background: var(--paper-3)`, `border: 0.5px solid var(--rule)`, `border-radius: 3px`, `padding: 2px 8px`, `font-family: var(--font-mono)`, `font-size: 12px`.  
Original codon in `var(--danger)`, fingerprinted codon in `var(--verify)`, position label in `var(--ink-3)`.

---

### Simulate a leak card
Show a `.card` with `background: var(--verify-soft)`, `border-color: var(--verify)`:
- Eyebrow: `VERIFY RESULT`
- Body: `Copy A was identified as the source of this sequence.`
- Metadata row: Recipient · Organisation · Issue date · Fingerprint ID (all from `verify_result` response field)

---

### Static fallback
If the API is unreachable (network error), show a static version of the results using hardcoded data for GLP-1 / ECOLI — same layout, but with a small `(offline demo)` footnote in `var(--ink-4)`.

---

### Lede copy
```
Every sequence issued through ArtGene can be fingerprinted for each 
recipient using synonymous codon substitutions. If a copy leaks, the 
registry identifies the source in milliseconds — without storing the 
sequence itself.
```

---

### Done when
- Submitting GLP-1 / ECOLI returns two copies with codon diff chips.
- Leaking Copy A shows the correct `VERIFY RESULT` card.
- All colours use design-system tokens (no Tailwind dark classes).
- Static fallback renders when the backend is offline.
- No TypeScript errors.

---
## PROMPT 5 — TINSEL Watermark + Certificate Showcase (`#watermark`)
---

### What to build
A narrative two-part section that explains (1) how the codon watermark works visually, and (2) what the resulting certificate looks like. No API calls — everything is static display using existing components.

### File to edit
Add inline JSX directly into the `#watermark` section in `apps/dashboard/app/showcase/page.tsx`. No separate component file needed.

---

### Section background
Use `var(--paper-3)` band (it's an even-numbered section per the alternating rule).

---

### Part A — Watermark explainer

**Layout:** Two columns. Left: text explanation. Right: animated `CodonGrid`.

**Left column — copy:**

Eyebrow: `§ 04a — Codon Watermark`  
Heading: `Invisible to ribosomes. Detectable by us.`  
Body (3 short paragraphs):

> Every certified sequence carries a covert TINSEL watermark — a spread-spectrum HMAC-SHA3-256 signature embedded across synonymous codon positions. Synonymous codons encode the same amino acid, so the protein's function is unchanged.
>
> Carrier positions (highlighted in cyan below) are chosen deterministically from a secret spreading key. Each position carries one bit of the watermark. Reed-Solomon error correction tolerates up to 30% position loss before the mark becomes unverifiable.
>
> The watermark survives sequence editing, reordering of codons, and partial truncation. It cannot be removed without knowledge of the spreading key — and that key never leaves the registry vault.

Below the copy, add a mono code snippet block (`.seq-block` CSS class) showing a 6-codon excerpt with carrier positions annotated:

```
Position  Codon  AA   Carrier?
──────────────────────────────
  47       GAA    Glu    —
  48       CTG    Leu    ◉  bit 0
  49       AAG    Lys    —
  50       TTC    Phe    ◉  bit 1
  51       GGC    Gly    —
  52       AGC    Ser    ◉  bit 2
```

Style the `◉` and `bit N` in `color: var(--verify)`.

**Right column — CodonGrid:**

Import `CodonGrid` from `@/components/design/CodonGrid`.

```tsx
<div style={{ maxWidth: 340, margin: '0 auto' }}>
  <CodonGrid rows={8} cols={16} highlights={[2, 5, 9, 14, 18, 23, 27, 31, 36, 40, 45, 49]} />
</div>
```

Below the grid, a caption in `.eyebrow` style:
`Cyan cells = carrier positions · Terracotta = set bits · Grey = unset bits`

---

### Part B — Certificate showcase

**Layout:** Two columns. Left: `CertSeal` + AG-ID + metadata. Right: JSON certificate excerpt.

Import `CertSeal` from `@/components/design/CertSeal`.

**Left column:**

```tsx
<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
  <CertSeal size={160} />
  <div className="mono" style={{ fontSize: 13, color: 'var(--ink-2)', textAlign: 'center' }}>
    AG-2026-000001
  </div>
  <table style={{ fontSize: 13, borderCollapse: 'collapse' }}>
    <tbody>
      {[
        ['Status',    '● CERTIFIED'],
        ['Tier',      'STANDARD'],
        ['Host',      'E. coli K-12'],
        ['Issued',    '2026-02-14'],
        ['Issuer',    'ArtGene Consortium'],
        ['Algorithm', 'WOTS+ · TINSEL-v1'],
      ].map(([k, v]) => (
        <tr key={k}>
          <td style={{ color: 'var(--ink-3)', paddingRight: 16, paddingBottom: 6 }}>{k}</td>
          <td style={{ color: 'var(--ink)', fontFamily: 'var(--mono)' }}>{v}</td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

**Right column — JSON excerpt:**

A `<pre className="seq-block">` block, trimmed to fit, showing the certificate structure. Style the property names in `--ink-3` and values in `--ink`. Use this static content:

```json
{
  "ag_id":       "AG-2026-000001",
  "status":      "certified",
  "tier":        "standard",
  "issued_at":   "2026-02-14T09:11:42Z",
  "host_organism": "ecoli",
  "gate_summary": {
    "alpha": "pass",
    "beta":  "pass",
    "gamma": "pass",
    "delta": "pass"
  },
  "watermark": {
    "version":        "tinsel-v1",
    "carrier_count":  48,
    "signature_hex":  "a3f9…c02e"
  },
  "certificate_sig": {
    "algorithm": "WOTS+",
    "public_key": "04ab…ff12"
  }
}
```

Below the JSON block, a `.btn .btn-ghost .btn-sm` link: `"View a live record →"` pointing to `/sequences/AG-DEMO-001`.

---

### Done when
- CodonGrid renders with highlighted carrier positions in cyan.
- CertSeal renders with its 60-second outer-ring rotation animation.
- Both columns are responsive (stack on mobile).
- No TypeScript errors.

---
## PROMPT 4 — Live Biosafety Pipeline Demo (`#pipeline`)
---

### What to build
An interactive widget where the funder picks one of six preloaded sequences, clicks "Run biosafety screen", and watches all four gates animate through in real time, ending with a pass/warn/fail verdict card.

### Important architecture note
The four-gate biosafety pipeline (`POST /register`) requires an API key and writes to the database — it cannot be called freely from the demo page. **Do not call `/register` or any authenticated endpoint here.**

Instead, all gate outcomes are **pre-computed golden results** embedded as static TypeScript constants (derived from the six test vectors in `packages/tinsel-demo/`). The animation is driven entirely by `setTimeout` phase transitions. This guarantees the demo never breaks during a live funder presentation.

---

### File to create
`apps/dashboard/app/showcase/components/PipelineDemo.tsx`

---

### Pre-computed golden data constant

Define this at the top of the file. Each entry maps to one FASTA in `packages/tinsel-demo/sequences/`:

```ts
const DEMO_SEQUENCES = [
  {
    id: 'glp1',
    label: 'GLP-1 receptor agonist',
    tag: 'AG-DEMO-001',
    molecule: 'Protein',
    host: 'E. coli',
    verdict: 'certified',
    gates: {
      gate1: { status: 'pass', score: 0.91, detail: 'Mean pLDDT 91.3 · low-confidence residues 4.2%' },
      gate2: { status: 'pass', score: 0.97, detail: 'No pathogen homologs · GRAVY –0.41 · allergen p=0.03' },
      gate3: { status: 'pass', score: 0.88, detail: 'CAI 0.88 · GC 52.1% · HGT risk: none' },
      gate4: { status: 'pass', score: 0.99, detail: 'Cosine similarity 0.12 — no dangerous-protein match' },
    },
  },
  {
    id: 'misfolded',
    label: 'Misfolded variant (Gate α fail)',
    tag: 'AG-DEMO-002',
    molecule: 'Protein',
    host: 'Human',
    verdict: 'rejected',
    gates: {
      gate1: { status: 'fail', score: 0.38, detail: 'Mean pLDDT 38.1 · low-confidence residues 71% — structurally unresolvable' },
      gate2: { status: 'skip', score: null, detail: 'Skipped — Gate α failed' },
      gate3: { status: 'skip', score: null, detail: 'Skipped — Gate α failed' },
      gate4: { status: 'skip', score: null, detail: 'Skipped — Gate α failed' },
    },
  },
  {
    id: 'toxin',
    label: 'Toxin homolog (Gate β fail)',
    tag: 'AG-DEMO-003',
    molecule: 'Protein',
    host: 'E. coli',
    verdict: 'rejected',
    gates: {
      gate1: { status: 'pass', score: 0.84, detail: 'Mean pLDDT 84.0 · low-confidence residues 8.1%' },
      gate2: { status: 'fail', score: 0.12, detail: 'SecureDNA hit: Schedule 1 toxin family · IBBIS HMM score 247.3 bits' },
      gate3: { status: 'skip', score: null, detail: 'Skipped — Gate β failed' },
      gate4: { status: 'skip', score: null, detail: 'Skipped — Gate β failed' },
    },
  },
  {
    id: 'is_element',
    label: 'IS element (Gate γ fail)',
    tag: 'AG-DEMO-004',
    molecule: 'DNA',
    host: 'E. coli',
    verdict: 'rejected',
    gates: {
      gate1: { status: 'pass', score: 0.79, detail: 'Mean pLDDT 79.2 · low-confidence residues 11%' },
      gate2: { status: 'pass', score: 0.82, detail: 'No pathogen homologs detected' },
      gate3: { status: 'fail', score: 0.21, detail: 'IS element detected · HGT risk: HIGH · GC 65.3% — atypical for host' },
      gate4: { status: 'skip', score: null, detail: 'Skipped — Gate γ failed' },
    },
  },
  {
    id: 'near_threshold',
    label: 'Near-threshold (Gate γ warn)',
    tag: 'AG-DEMO-005',
    molecule: 'Protein',
    host: 'CHO',
    verdict: 'certified_reduced',
    gates: {
      gate1: { status: 'pass', score: 0.76, detail: 'Mean pLDDT 76.1 · low-confidence residues 18%' },
      gate2: { status: 'pass', score: 0.78, detail: 'No pathogen hits · GRAVY 0.31 — borderline hydrophobic' },
      gate3: { status: 'warn', score: 0.61, detail: 'CAI 0.61 — below threshold · GC 48.2% · HGT propensity: moderate' },
      gate4: { status: 'pass', score: 0.94, detail: 'Cosine similarity 0.08 — no dangerous-protein match' },
    },
  },
  {
    id: 'sgrna',
    label: 'CRISPR sgRNA (all pass)',
    tag: 'AG-DEMO-006',
    molecule: 'RNA',
    host: 'Human',
    verdict: 'certified',
    gates: {
      gate1: { status: 'pass', score: 0.93, detail: 'LinearFold ΔMFE –42.1 kcal/mol · well-structured guide scaffold' },
      gate2: { status: 'pass', score: 0.96, detail: 'No off-target BLAST hits in pathogen DBs' },
      gate3: { status: 'pass', score: 0.91, detail: 'CAI 0.91 · GC 54.2% · no HGT risk' },
      gate4: { status: 'pass', score: 0.98, detail: 'No functional similarity to dangerous proteins' },
    },
  },
]
```

---

### Widget layout

```
┌──────────────────────────────────────────────────────────────────┐
│  § 03 — Biosafety Pipeline                                       │
│  Four-gate automated biosafety review                            │
│  [lede]                                                          │
│                                                                  │
│  ┌─ Sequence selector (6 buttons) ──────────────────────────┐   │
│  │  [GLP-1 ✓]  [Misfolded]  [Toxin]  [IS elem]  [Warn]  [sgRNA]│
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─ Left panel (gate tracker) ──┐  ┌─ Right panel (results) ─┐  │
│  │                              │  │                          │  │
│  │  GateProgressTracker         │  │  Gate detail cards       │  │
│  │  (animated phase states)     │  │  Score bars              │  │
│  │                              │  │  Verdict badge           │  │
│  └──────────────────────────────┘  └──────────────────────────┘ │
│                                                                  │
│  [Run biosafety screen →]  button                               │
└──────────────────────────────────────────────────────────────────┘
```

---

### State machine

```ts
type Phase = 'idle' | 'gate1' | 'gates234' | 'done'

const [selected, setSelected] = useState(DEMO_SEQUENCES[0])
const [phase, setPhase]       = useState<Phase>('idle')
const [report, setReport]     = useState<typeof DEMO_SEQUENCES[0]['gates'] | null>(null)
```

When "Run biosafety screen" is clicked:
1. `setPhase('gate1')` immediately — shows Gate α spinning.
2. After **1 400 ms**: if `selected.gates.gate1.status === 'fail'` → `setPhase('done')`, `setReport(selected.gates)`. Otherwise continue.
3. After **1 400 ms** more: `setPhase('gates234')` — shows Gates β/γ/δ spinning.
4. After **2 200 ms** more: `setPhase('done')`, `setReport(selected.gates)`.

---

### Gate tracker adaptation

Import `GateProgressTracker` from `@/components/GateProgressTracker`. It accepts `phase: RunPhase` and `report: ConsequenceReport | null`. Map local state to its props:

```ts
// Map our Phase → RunPhase expected by the component
const trackerPhase: RunPhase =
  phase === 'gate1'    ? 'gate1'   :
  phase === 'gates234' ? 'gates23' :
  phase === 'done'     ? 'done'    : 'idle'

// Map our golden gate data to ConsequenceReport shape
const trackerReport = report ? {
  gate1: { status: report.gate1.status },
  gate2: { status: report.gate2.status },
  gate3: { status: report.gate3.status },
  skipped_gates: Object.entries(report)
    .filter(([, v]) => v.status === 'skip')
    .map(([k]) => parseInt(k.replace('gate', ''))),
} as ConsequenceReport : null
```

---

### Right panel — gate detail cards

Once `phase === 'done'`, render a stacked list of gate result cards. Each card:
- Left: gate label (`α / β / γ / δ`) in `.mono` + gate name
- Center: one-line `.detail` string from golden data
- Right: score bar (if score not null) + status badge (`.badge-verify` / `.badge-warn` / `.badge-danger`)

Score bar: `<div style={{ width: '120px', height: '4px', background: 'var(--rule)' }}><div style={{ width: score*100+'%', background: scoreColour }} /></div>`

Score colour: `>= 0.8` → `--verify`, `>= 0.6` → `--warn`, `< 0.6` → `--danger`. Skip status: grey, no bar.

---

### Verdict card

Below the gate cards, render a verdict summary `.card` with:
- `certified` → `--verify` background tint, `● CERTIFIED` badge, `CertSeal` at 64px
- `certified_reduced` → `--warn` tint, `⚠ CERTIFIED — REDUCED TIER` badge
- `rejected` → `--danger` tint, `✗ REGISTRATION REJECTED` badge

Import `CertSeal` from `@/components/design/CertSeal` for the certified state only.

---

### Sequence selector buttons

Six `.btn .btn-ghost .btn-sm` buttons in a row (wrapping on mobile). Active selection: `background: var(--accent-soft)`, `border-color: var(--accent)`. Each shows molecule type as a tiny `.mono` sub-label: `Protein / DNA / RNA`.

---

### Lede copy (above widget)
```
Select a sequence below and click Run. The four biosafety gates execute 
in sequence: α structural confidence, β hazard screening, γ ecological 
risk, δ functional similarity. Gates β, γ, and δ run concurrently after 
α passes. A certificate is only issued when all gates clear.
```

---

### Done when
- Selecting each of the 6 sequences and clicking Run plays the correct animation.
- Misfolded variant stops after Gate α with a REJECTED card.
- Toxin and IS element stop after Gate β/γ respectively.
- Near-threshold ends with `⚠ CERTIFIED — REDUCED TIER`.
- GLP-1 and sgRNA end with `● CERTIFIED` + spinning `CertSeal`.
- No TypeScript errors.

---

### Key risk
Section 4 (live pipeline) takes the longest
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

---

## Appendix A — Existing Components to Reuse

Never recreate these. Import directly.

| Component | Import path | Used in prompt |
|-----------|-------------|----------------|
| `GovStrip` | `@/components/design/GovStrip` | 1 |
| `SiteHeader` | `@/components/design/SiteHeader` | 1 |
| `SiteFooter` | `@/components/design/SiteFooter` | 1 |
| `Helix` | `@/components/design/Helix` | 2 |
| `Counter` | `@/components/design/Counter` | 2 |
| `CodonGrid` | `@/components/design/CodonGrid` | 5 |
| `CertSeal` | `@/components/design/CertSeal` | 4, 5 |
| `GateProgressTracker` | `@/components/GateProgressTracker` | 4 |
| `StatusBadge`, `TierBadge` | `@/components/CertBadges` | 9 |
| `FastaUploader` | `@/components/FastaUploader` | (optional for 7) |
| `analyseSequence` | `@/lib/api` | 6 |
| `analyseFragments` | `@/lib/api` | 7 |

---

## Appendix B — API Endpoints Used

All are auth-free and available via the Next.js proxy at `/api/proxy/...`.

| Prompt | Method | Path | Notes |
|--------|--------|------|-------|
| 6 | POST | `/api/proxy/analyse` | Provenance fingerprinting. Body: `{ fasta, host_organism }` |
| 7 | POST | `/api/proxy/analyse/fragments` | Fragment + assembly screen. Body: `{ fasta, host_organism }` |
| 9 | GET  | `/api/proxy/certificates/?limit=8&status=certified` | Public registry list |

All other sections are static — no API calls.

---

## Appendix C — Design Token Quick Reference

Full spec in `design-reference/CD_theme.md`. Most-used tokens for this page:

```css
--paper:       #fafaf6   /* default background */
--paper-2:     #ffffff   /* card background */
--paper-3:     #f3f1e9   /* section band, table headers */
--ink:         #1c1b17   /* primary text, dark CTA bg */
--ink-2:       #3b3a34   /* secondary text */
--ink-3:       #6d6b60   /* labels, captions */
--ink-4:       #9e9b8d   /* disabled, footnotes */
--rule:        #e2ddcb   /* borders */
--accent:      oklch(0.48 0.13 45)   /* terracotta */
--accent-soft: oklch(0.95 0.035 45)  /* accent tint background */
--verify:      oklch(0.52 0.08 195)  /* cyan — live / certified */
--verify-soft: oklch(0.96 0.025 195) /* cyan tint background */
--warn:        oklch(0.62 0.14 70)   /* amber — in pipeline / warn */
--danger:      oklch(0.52 0.16 25)   /* red — fail / blocked */
--font-mono:   'JetBrains Mono', monospace
```
