# ArtGene Archive — Session Context

> Read this file at the start of every session. It is the single source of truth for
> where we are in the migration and how the codebase is structured.

---

## 1. Repo layout

```
artgene-archive/
├── apps/dashboard/          ← The Next.js app (deployed on Railway)
│   ├── app/                 ← Next.js App Router pages
│   │   ├── page.tsx         ← Home /
│   │   ├── register/        ← /register
│   │   ├── registry/        ← /registry (public, no auth needed to view)
│   │   ├── sequences/       ← /sequences (my sequences, API key required)
│   │   │   └── [id]/        ← /sequences/:id (sequence detail / record)
│   │   ├── verify/          ← /verify (verify source by FASTA paste)
│   │   ├── demo/            ← /demo and /demo/fragments
│   │   ├── about/           ← /about (Charter — NEW, Phase 3e)
│   │   └── getting-started/ ← /getting-started (Docs)
│   ├── components/
│   │   ├── design/          ← New design-system components (Phase 2)
│   │   │   ├── BrandGlyph.tsx
│   │   │   ├── GovStrip.tsx
│   │   │   ├── SiteHeader.tsx
│   │   │   ├── SiteFooter.tsx
│   │   │   ├── Helix.tsx
│   │   │   ├── CodonGrid.tsx
│   │   │   ├── CertSeal.tsx
│   │   │   ├── Counter.tsx
│   │   │   ├── Ticker.tsx
│   │   │   └── PillarIcon.tsx
│   │   ├── CertBadges.tsx
│   │   ├── CertificateCard.tsx
│   │   ├── FastaUploader.tsx
│   │   ├── GateProgressTracker.tsx
│   │   └── InfoTooltip.tsx
│   ├── lib/
│   │   ├── api.ts           ← Typed API client (DO NOT CHANGE SHAPE)
│   │   └── providers.tsx    ← QueryClient + useApiKey() context
│   ├── app/globals.css      ← Design tokens + utility classes (replaces Tailwind-only)
│   └── package.json
├── design-reference/        ← New UI prototype (READ ONLY source material)
│   ├── ArtGene Archive.html
│   ├── CD_theme.md          ← AUTHORITATIVE design system spec
│   ├── styles.css
│   ├── components.jsx
│   ├── page-home.jsx
│   ├── page-registry.jsx
│   ├── page-record.jsx
│   └── page-register.jsx    ← Also contains AboutPage and DocsPage
└── context.md               ← THIS FILE
```

---

## 2. Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, TypeScript) |
| Styling | Tailwind CSS 3 + CSS custom properties in globals.css |
| Data fetching | @tanstack/react-query v5 |
| Forms | react-hook-form + zod |
| Charts | recharts |
| Auth | API key via `useApiKey()` context → `X-API-Key` header |
| Backend | FastAPI (`sentinel_api`) — DO NOT CHANGE |
| Deployment | Railway (monorepo, `apps/dashboard`) |

---

## 3. API client summary (`lib/api.ts`)

All routes live under `${NEXT_PUBLIC_API_URL}/api/v1`. Two tiers:

**Public (no auth):**
- `GET /health` → `HealthResponse`
- `POST /analyse` → `AnalyseResponse` (demo)
- `POST /analyse/structure` → `StructureResponse`
- `POST /analyse/fragments` → `FragmentsResponse`
- `GET /certificates/lookup?sequence_hash=…` → `CertificateLookupResponse`
- `GET /certificates/:id/compliance/verify` → `ComplianceVerify`

**Authenticated (`createApiClient(apiKey)`):**
- `GET /health` → `HealthResponse`
- `GET /certificates/?limit&offset` → `CertificateListResponse`
- `GET /certificates/:id` → `Certificate`
- `GET /certificates/:id/export` → JSON blob
- `GET /certificates/:id/compliance?frameworks=…` → `ComplianceManifest`
- `GET /certificates/:id/synthesis-auth` → `SynthesisAuthDocument`
- `POST /register` → `RegistrationResponse`
- `POST /certificates/:id/revoke` → revocation response
- `GET /sequences/:id/distributions` → `DistributionSummary[]`
- `POST /sequences/:id/distributions` → FASTA blob (per-recipient fingerprinted copy)
- `POST /verify-source` → `VerifySourceResponse`

**Key types to preserve:**
- `Certificate` — includes `watermark_metadata: WatermarkMetadata | null`
- `WatermarkMetadata` — `carrier_positions`, `anchor_map.carrier_indices`, `codon_bias_metrics`, `signature_hex`
- `ConsequenceReport` — gate1/gate2/gate3/gate4 + run_gates/skipped_gates
- `RegistrationRequest` — fasta, owner_id, ethics_code, host_organism?, visibility?
- `CertificateSummary` — registry_id, status, tier, owner_id, host_organism, timestamp

---

## 4. Design system — CD_theme.md is AUTHORITATIVE

**Fonts:**
```
Manrope (300/400/500/600/700) — ALL display, UI, body text
JetBrains Mono (400/500)      — monospace only (IDs, hashes, CLI, eyebrows)
```
Google Fonts link:
```html
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet"/>
```

**Token palette (CD_theme.md values):**
```css
--paper:    #fafaf6;   /* page bg — warm ivory */
--paper-2:  #ffffff;   /* cards, raised surfaces */
--paper-3:  #f3f1e9;   /* section bands, table headers */
--ink:      #1c1b17;   /* primary text */
--ink-2:    #3b3a34;   /* secondary text */
--ink-3:    #6d6b60;   /* tertiary / labels */
--ink-4:    #9e9b8d;   /* disabled / hints */
--rule:     #e2ddcb;   /* hairlines, borders */
--rule-2:   #eeeadb;   /* lighter rules (table rows) */
--accent:       oklch(0.48 0.13 45);   /* terracotta */
--accent-soft:  oklch(0.95 0.035 45);
--verify:       oklch(0.52 0.08 195);  /* cyan — certified/safe */
--verify-soft:  oklch(0.96 0.025 195);
--warn:         oklch(0.62 0.14 70);   /* amber — embargoed/review */
--danger:       oklch(0.52 0.16 25);   /* red — restricted/failed */
--radius:     3px;
--radius-lg:  6px;
--sans: 'Manrope', system-ui, sans-serif;
--mono: 'JetBrains Mono', ui-monospace, Menlo, monospace;
```

**NO dark mode.** Light-only palette throughout.

---

## 5. Resolved decisions

| # | Decision | Resolution |
|---|----------|-----------|
| 1 | Dark mode | **Removed entirely.** No `.dark` CSS, no toggle, no `dark:` Tailwind classes. |
| 2 | Font authority | **CD_theme.md** — Manrope for all text, JetBrains Mono for mono. |
| 3 | API key UI | **Deprecated.** No "Set API Key" button. Key read from `NEXT_PUBLIC_API_KEY` env var, falls back to `sessionStorage`. `useApiKey()` context kept intact. |
| 4 | Provenance tab | **Both** live in one tab: CodonGrid watermark visual + chain-of-custody timeline (new) AND distribution copy issuance UI (existing). Old "TINSEL" branding replaced with "codon fingerprinting". |
| 5 | Abstract tab data | New fields **added to register form** (Phase 3d). Mandatory: sequence name, molecule type, generating model. Optional: abstract, authors, ORCID, keywords, design method. Empty state shown until backend exposes fields. |
| 6 | Watermark positions | Use `cert.watermark_metadata.anchor_map.carrier_indices` for codon highlight positions in Sequence tab. |
| 7 | Charter route | `/about` |
| 8 | Gate naming | **α/β/γ/δ throughout:** α=Structural, β=Off-target, γ=Ecological, δ=Functional analogue |

---

## 6. Current page → design page mapping

| Existing route | Design page | File to change |
|---|---|---|
| `/` | Home (`HomePage`) | `app/page.tsx` |
| `/register` | Deposit (`RegisterPage`) | `app/register/page.tsx` |
| `/registry` | Registry (`RegistryPage`) | `app/registry/page.tsx` |
| `/sequences/[id]` | Record (`RecordPage`) | `app/sequences/[id]/page.tsx` |
| `/getting-started` | Docs (`DocsPage`) | `app/getting-started/page.tsx` |
| _(missing)_ | Charter (`AboutPage`) | `app/about/page.tsx` (NEW) |
| `/sequences` | My Sequences | keep as-is |
| `/verify` | Verify Source | keep as-is |
| `/demo` | Demo | keep as-is |
| `/demo/fragments` | Fragment Screen | keep as-is |

---

## 7. Migration phases & status

### Phase 1 — Audit ✅ COMPLETE
- [x] Read all design-reference files and all existing pages
- [x] MIGRATION.md written (30 new features catalogued)
- [x] context.md written

### Phase 2 — Shared foundation ✅ COMPLETE
- [x] globals.css — Manrope tokens, all utility classes, no dark mode
- [x] layout.tsx — font links, SiteHeader/SiteFooter shell, no dark FOUC script
- [x] providers.tsx — env-var API key default
- [x] components/design/ — BrandGlyph, GovStrip, Helix, CodonGrid, CertSeal, Counter, Ticker, PillarIcon
- [x] SiteHeader.tsx + SiteFooter.tsx
- [x] GateProgressTracker.tsx — α/β/γ/δ labels

### Phase 3 — Page migration (NOT STARTED)
- [ ] **3a** Home page (`app/page.tsx`)
- [ ] **3b** Registry page (`app/registry/page.tsx`)
- [ ] **3c** Record / Sequence detail (`app/sequences/[id]/page.tsx`)
- [ ] **3d** Deposit / Register flow (`app/register/page.tsx`)
- [ ] **3e** Charter (`app/about/page.tsx`) + Docs (`app/getting-started/page.tsx`)

---

## 8. Key constraints (never violate)

- Do NOT change `lib/api.ts` — API shape is frozen.
- Do NOT change the backend at all.
- Preserve all existing route URLs.
- All interactive elements must be real `<button>` or `<a>`/`<Link>` elements.
- Accessibility: keyboard focus, ARIA labels where needed.
- Dev branch only: `claude/migrate-design-reference-LlvYA`. Never push to `main`.
