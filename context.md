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
│   │   └── getting-started/ ← /getting-started (Help / Docs)
│   ├── components/          ← Shared React components
│   │   ├── CertBadges.tsx
│   │   ├── CertificateCard.tsx
│   │   ├── FastaUploader.tsx
│   │   ├── GateProgressTracker.tsx
│   │   └── InfoTooltip.tsx
│   ├── lib/
│   │   ├── api.ts           ← Typed API client (DO NOT CHANGE SHAPE)
│   │   └── providers.tsx    ← QueryClient + useApiKey() context
│   ├── app/globals.css      ← Tailwind base/components/utilities + custom tokens
│   └── package.json
├── design-reference/        ← New UI prototype (READ ONLY source material)
│   ├── ArtGene Archive.html ← Single-file prototype
│   ├── CD_theme.md          ← Design system spec
│   ├── styles.css           ← Design tokens + utility classes
│   ├── components.jsx       ← Shared components (BrandGlyph, Header, Footer, etc.)
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
- `WatermarkMetadata` — has `carrier_positions`, `anchor_map`, `codon_bias_metrics`, `signature_hex`
- `ConsequenceReport` — gate1/gate2/gate3/gate4 + run_gates/skipped_gates
- `RegistrationRequest` — fasta, owner_id, ethics_code, host_organism?, visibility?
- `CertificateSummary` — registry_id, status, tier, chi_squared, owner_id, host_organism, timestamp

---

## 4. Design system (from design-reference/)

**Fonts (3 families):**
```
Instrument Serif — display, brand name, serif lede, section h2s
Inter Tight      — UI sans (nav, body, forms, labels)
JetBrains Mono   — monospace (IDs, hashes, CLI, code, eyebrows)
```
Note: CD_theme.md lists "Manrope" but the actual prototype (styles.css) uses Instrument Serif + Inter Tight. Use **styles.css** as authoritative.

**Token palette (styles.css :root):**
```css
--paper: #f7f3ec     /* warm ivory — page bg */
--paper-2: #faf8f3   /* cards, raised surfaces */
--paper-3: #efe9dd   /* section bands, table headers */
--ink: #1a1815       /* primary text */
--ink-2: #3d3a33     /* secondary text */
--ink-3: #6b6659     /* tertiary / labels */
--ink-4: #9a9285     /* disabled / hints */
--rule: #d9d0bd      /* hairlines, borders */
--rule-2: #e8e0cf    /* lighter rules */
--accent: oklch(0.48 0.13 45)      /* terracotta */
--accent-soft: oklch(0.94 0.04 45)
--verify: oklch(0.52 0.08 195)     /* cyan — certified/safe */
--verify-soft: oklch(0.95 0.03 195)
--warn: oklch(0.62 0.14 70)        /* amber — under review */
--danger: oklch(0.52 0.16 25)      /* red — restricted/failed */
--radius: 3px
--radius-lg: 6px
--serif: 'Instrument Serif', ...
--sans: 'Inter Tight', ...
--mono: 'JetBrains Mono', ...
```

**No dark mode in the design.** (Clarification needed — see §7.)

---

## 5. Current page → design page mapping

| Existing route | Design page | File to change |
|---|---|---|
| `/` | Home (`HomePage`) | `app/page.tsx` |
| `/register` | Deposit (`RegisterPage`) | `app/register/page.tsx` |
| `/registry` | Registry (`RegistryPage`) | `app/registry/page.tsx` |
| `/sequences/[id]` | Record (`RecordPage`) | `app/sequences/[id]/page.tsx` |
| `/getting-started` | Docs (`DocsPage`) | `app/getting-started/page.tsx` |
| _(missing)_ | Charter (`AboutPage`) | `app/about/page.tsx` (NEW) |
| `/sequences` | My Sequences | keep as-is (not in design) |
| `/verify` | Verify Source | keep as-is (not in design) |
| `/demo` | Demo | keep as-is (not in design) |
| `/demo/fragments` | Fragment Screen | keep as-is (not in design) |

---

## 6. Migration phases & status

### Phase 1 — Audit (COMPLETE)
- [x] Read all design-reference files end-to-end
- [x] Read all existing page components and API client
- [x] MIGRATION.md written
- [x] context.md written

### Phase 2 — Shared foundation (NOT STARTED)
- [ ] Install Google Fonts (Instrument Serif, Inter Tight, JetBrains Mono) via `<link>` in `app/layout.tsx`
- [ ] Port `styles.css` tokens + utility classes into `globals.css` (add to existing, don't remove Tailwind)
- [ ] Create `src/components/design/` directory with ported shared components:
  - `BrandGlyph.tsx`, `GovStrip.tsx`, `Helix.tsx`, `CodonGrid.tsx`, `CertSeal.tsx`
  - `Counter.tsx`, `Ticker.tsx`, `PillarIcon.tsx`
  - `SiteHeader.tsx`, `SiteFooter.tsx` (new layout wrappers)

### Phase 3 — Page migration (NOT STARTED)
- [ ] **3a** Home page
- [ ] **3b** Registry page
- [ ] **3c** Record/Sequence detail page
- [ ] **3d** Deposit/Register flow
- [ ] **3e** Charter + Docs pages

---

## 7. Open clarifications (must resolve before Phase 2)

1. **Dark mode**: Design is light-only (ivory/terracotta palette). Should dark mode be:
   - (a) Dropped entirely — simpler, matches design exactly
   - (b) Preserved alongside the new tokens — adds complexity but keeps existing users
   
2. **`/sequences` vs `/registry`**: The existing app has `/registry` (public list) and `/sequences` (authenticated "my sequences" list). The design shows a single "Registry" page. Should `/sequences` be:
   - (a) Kept as-is for authenticated per-user view
   - (b) Merged into `/registry` with an authenticated state

3. **API key UI in new design**: The design Header has no API key button — it assumes a static institution sign-in. How should the API key entry work in the new UI?
   - (a) Keep existing inline dropdown in the header (add to new Header component)
   - (b) Move to a settings/profile area

4. **Provenance tab redesign**: The design shows watermark fingerprint (CodonGrid + hex) + chain of custody timeline. The existing app shows per-recipient distribution copy issuance (Issue Copy modal + distributions table). Should the new Provenance tab:
   - (a) Show CodonGrid + custody timeline AND keep the distribution issue feature below
   - (b) Split into two sub-tabs: "Watermark" and "Distribution"
   - (c) Replace the existing distribution UI entirely (not recommended — core feature)

5. **Abstract tab data**: The design's Abstract tab shows a rich abstract text, authors list with ORCIDs, keywords, design method, and citation. None of these fields exist in the current `Certificate` API response. How to handle:
   - (a) Show placeholder/empty state for now, wire when backend adds fields
   - (b) Use `owner_id`, `org_id`, `ethics_code` etc. as best-effort stand-ins
   - (c) Add a new `metadata` field to the API (requires backend change)

6. **Sequence tab data**: The feature map and watermark codon positions should come from `watermark_metadata.anchor_map.carrier_indices`. Confirmed?

7. **About/Charter route**: Should the charter page live at `/about` or `/charter`?

---

## 8. Key constraints (never violate these)

- Do NOT change `lib/api.ts` — the API shape is frozen.
- Do NOT change the backend at all.
- Preserve all existing routes and their URLs.
- All buttons must be real `<button>` elements. Nav links must be `<a>` / Next.js `<Link>`.
- Accessibility: keyboard focus, ARIA where needed.
- Do not push to `main`. Development branch: `claude/migrate-design-reference-LlvYA`.
