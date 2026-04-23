# ArtGene Archive — UI Migration Plan

**Branch:** `claude/migrate-design-reference-LlvYA`  
**Design source:** `design-reference/` (Babel-transpiled React prototype)  
**Target:** `apps/dashboard/` (Next.js 16, App Router, TypeScript, Tailwind CSS)

---

## New features introduced by the design

The following capabilities are **entirely absent** from the current app and must be added during migration:

| # | Feature | Design location | Notes |
|---|---------|----------------|-------|
| 1 | **GovStrip** top banner | `components.jsx:GovStrip` | "An independent scientific registry · Charter v1.2 · WHO observer" |
| 2 | **Live ticker** | `components.jsx:Ticker` + `page-home.jsx` | Scrolling strip of recent deposits; wire to real API |
| 3 | **Animated stat counters** | `components.jsx:Counter` + `page-home.jsx` | 1200ms ease-out cubic; wire to `/certificates/` count |
| 4 | **Helix SVG decoration** | `components.jsx:Helix` | Replaces current `DnaHelix` component |
| 5 | **CodonGrid** visualization | `components.jsx:CodonGrid` | 8×16 bit pattern; wire to `watermark_metadata.anchor_map.carrier_indices` |
| 6 | **CertSeal** rotating seal | `components.jsx:CertSeal` | 60s rotation; shown on record header and register success |
| 7 | **BrandGlyph** SVG logo | `components.jsx:BrandGlyph` | Replaces current double-helix inline SVG |
| 8 | **Mission / Editorial** section | `page-home.jsx` §01 | GenBank analogy editorial text |
| 9 | **Four Pillars** section | `page-home.jsx` §02 | Biosafety / Watermark / Certificate / Attribution cards |
| 10 | **Watermark showcase** | `page-home.jsx` §03 | CodonGrid + annotated codon sequence excerpt |
| 11 | **Biosafety pipeline steps** | `page-home.jsx` §04 | 5-step linear flow (Submit→α→β→γ→Certify) |
| 12 | **Certificate showcase** (dark ink section) | `page-home.jsx` §05 | CertSeal + CLI verify snippet on dark background |
| 13 | **Partner endorsements grid** | `page-home.jsx` §06 | 12-cell institution grid |
| 14 | **Registry text search** | `page-registry.jsx` | Free-text filter by AG-ID / name / org / model |
| 15 | **Registry filter buttons** | `page-registry.jsx` | All / Certified / Under review / Restricted / Protein / RNA / DNA |
| 16 | **Registry: Generating model column** | `page-registry.jsx` | From `CertificateSummary` — not yet exposed |
| 17 | **Registry: Type + Length columns** | `page-registry.jsx` | From `CertificateSummary` — not yet exposed |
| 18 | **Export CSV button** (registry) | `page-registry.jsx` | Trigger download of current filtered view |
| 19 | **Record: Abstract tab** | `page-record.jsx:AbstractTab` | Rich abstract, authors/ORCID, keywords, citation widget |
| 20 | **Record: Sequence tab** | `page-record.jsx:SequenceTab` | DNA/mRNA/Protein toggle, numbered rows, watermark highlights, feature map |
| 21 | **Record: Feature map** | `page-record.jsx:SequenceTab` | Linear track visualization (Start/domains/Stop) |
| 22 | **Record: Biosafety redesign** | `page-record.jsx:BiosafetyTab` | Greek-letter gates (α/β/γ), score bars, tier legend |
| 23 | **Record: Provenance watermark visual** | `page-record.jsx:ProvenanceTab` | CodonGrid + hex signature + chain of custody timeline |
| 24 | **Record: Certificate JSON** | `page-record.jsx:ProvenanceTab` | Formatted JSON in provenance tab (existing lives in Compliance tab) |
| 25 | **Record: References tab** | `page-record.jsx:ReferencesTab` | Citation list + version history table + related records sidebar |
| 26 | **Register: 4-step wizard UI** | `page-register.jsx:RegisterPage` | Step indicator strip + per-step card |
| 27 | **Register: Abstract field** | `page-register.jsx` step 2 | Free-text sequence description (new metadata field) |
| 28 | **Register: Step 4 certificate screen** | `page-register.jsx` step 4 | CertSeal + accession display + downloads |
| 29 | **About / Charter page** | `page-register.jsx:AboutPage` | New route `/about` — 5 charter items + signatories |
| 30 | **Docs page redesign** | `page-register.jsx:DocsPage` | Sidebar nav + CLI install/deposit/verify examples |

---

## Page migration table

### Home `/` → `page-home.jsx:HomePage`

| Preserve from existing | Add from design | Wire to |
|---|---|---|
| `client.health()` → DB/Vault status | `GovStrip` | `GET /health` |
| `client.listCertificates()` → stat counts | `Ticker` items (recent deposits) | `GET /certificates/?limit=6` → items |
| StepsCarousel (keep or replace) | `Counter` on stat numbers | `count` from `CertificateListResponse` |
| API key callout / demo key box | Hero + Helix SVG | — |
| Quick nav cards | Four Pillars section | — |
| Why ArtGene feature cards | Watermark showcase | — |
| — | Biosafety pipeline steps | — |
| — | CertSeal dark section | — |
| — | Partner endorsements | — |
| — | CTA section | — |

**Fallback values (if endpoint missing):**  
Ticker → placeholder items from prototype. Stat counters → `cert.count` from `listCertificates` or `0`.

---

### Registry `/registry` → `page-registry.jsx:RegistryPage`

| Preserve from existing | Add from design | Wire to |
|---|---|---|
| `client.listCertificates(PAGE_SIZE, offset)` pagination | Text search input | client-side filter on loaded data (or add `?search=` param if backend adds it) |
| `StatusBadge`, `TierBadge` | Filter buttons (All/Certified/etc.) | `status` field on `CertificateSummary` |
| Skeleton rows during load | Registry total count display | `data.count` |
| Error handling | Export CSV button | serialise `data.items` to CSV |
| API key warning | `RegistryPage` header with date/snapshot | — |
| CertRow → `/sequences/[id]` link | Two-line cell (name + org) | `cert.owner_id` as name fallback |
| Pagination controls | Generating model column | `cert.tier` as placeholder until API exposes model |
| — | Type column | `cert.sequence_type` (available on full `Certificate`, not `CertificateSummary`) |
| — | Length column | not in `CertificateSummary` — show `—` until API exposes it |

**Note:** Row click → `/sequences/${cert.registry_id}` (preserve existing URL pattern).

---

### Sequence detail `/sequences/[id]` → `page-record.jsx:RecordPage`

The existing page has 4 tabs: Gates · Provenance Tracing · Compliance · Synthesizer.  
The design has 5 tabs: Abstract · Sequence · Biosafety · Provenance & Watermark · References.  
**Resolution:** merge into a 7-tab layout (see below) or split Provenance into two logical sections.

| Tab (new) | Source | Backend data | Existing tab |
|---|---|---|---|
| **Abstract** | `page-record.jsx:AbstractTab` | `cert.*` fields; abstract/authors/keywords → show empty state if absent from API | _(new)_ |
| **Sequence** | `page-record.jsx:SequenceTab` | `cert.watermark_metadata.anchor_map.carrier_indices` for highlights; sequence from cert export | _(new)_ |
| **Biosafety** | `page-record.jsx:BiosafetyTab` + existing gate panels | `cert.consequence_report.gate{1,2,3,4}` | replaces "Gates" tab visually |
| **Provenance** | `page-record.jsx:ProvenanceTab` (watermark visual + custody) + existing `ProvenanceTab` (distribution issue) | `cert.watermark_metadata`, `cert.certificate_hash`, `cert.timestamp` + `listDistributions` / `issueDistribution` | merges "Provenance Tracing" tab |
| **References** | `page-record.jsx:ReferencesTab` | no current API field; show empty state | _(new)_ |
| **Compliance** | existing `ComplianceTab` unchanged | `client.getCompliance()` | keep |
| **Synthesizer** | existing `SynthesizerTab` unchanged | `client.getSynthesisAuth()`, `client.revokeCertificate()` | keep |

**Preserve from existing:**
- `useApiKey()` guard (redirect to API key prompt if absent)
- Export JSON button → `client.exportCertificate(id)`
- Revoke button → `client.revokeCertificate(id)`
- All gate panels (Gate1Panel, Gate2Panel, Gate3Panel, Gate4Panel) — keep, restyle
- DistributeModal → keep, surface inside new Provenance tab

**Add from design:**
- Top bar: breadcrumb + action buttons (Cite / FASTA / Certificate)
- Record header: display h1 + CertSeal + metadata grid
- Sticky tab bar with accent underline on active tab
- Biosafety: Greek letters α/β/γ/δ for gates 1/2/3/4; score bars; tier legend sidebar
- Provenance watermark: CodonGrid component wired to `cert.watermark_metadata.signature_hex` bits; chain of custody timeline from cert timestamps

---

### Register `/register` → `page-register.jsx:RegisterPage`

| Step | Preserve from existing | Add from design |
|---|---|---|
| **Step 1 — Sequence** | `FastaUploader` component | Design textarea style; "Browse file" + "Load example" buttons; residue counter |
| **Step 2 — Metadata** | `owner_id`, `ethics_code`, `host_organism`, `visibility` fields (zod schema) | Abstract/description textarea; license checkbox (maps to visibility=public); 2-col grid layout |
| **Step 3 — Biosafety** | `GateProgressTracker`, `ConsequenceReport`, `RegistrationResponse` | `GateRow` design with Greek letters; "● LIVE" badge; gate progress bars |
| **Step 4 — Certificate** | `CertificateCard` result; link to `/sequences/:id` | `CertSeal` SVG; accession display typography; "Download certificate" button |

**Stepper strip**: 4-step indicator (§01–§04) replaces the current single-page form layout. State: `step ∈ {1,2,3,4}`. Gate running is still triggered by the `client.register()` call on step 2 → step 3 transition.

**Preserve exactly:** API key guard, zod validation, `react-hook-form`, error messages, `qc.invalidateQueries(['certificates'])` on success.

---

### About `/about` (NEW ROUTE)

New page `apps/dashboard/app/about/page.tsx`.  
Source: `page-register.jsx:AboutPage`.  
Static content — no API calls.  
Add `/about` link to the new `SiteHeader` nav (label: "Charter").

---

### Docs `/getting-started` → `page-register.jsx:DocsPage`

| Preserve | Add from design |
|---|---|
| Content about biosafety gates | Sticky sidebar nav (Quick start / Deposit lifecycle / CLI reference / REST API / …) |
| API key instructions | CLI code blocks (install, deposit, verify) |
| — | `wrap-narrow` + `wrap` layout split |

---

## Shared components to create

Create `apps/dashboard/components/design/` directory with these files:

| File | Source | Props |
|---|---|---|
| `BrandGlyph.tsx` | `components.jsx:BrandGlyph` | `size?: number` |
| `GovStrip.tsx` | `components.jsx:GovStrip` | none |
| `SiteHeader.tsx` | `components.jsx:Header` | adapted for Next.js `<Link>` + `usePathname()` + apiKey button |
| `SiteFooter.tsx` | `components.jsx:Footer` | none |
| `Helix.tsx` | `components.jsx:Helix` | `animated?: boolean` |
| `CodonGrid.tsx` | `components.jsx:CodonGrid` | `rows?: number; cols?: number; highlights?: number[] \| null` |
| `CertSeal.tsx` | `components.jsx:CertSeal` | `size?: number` |
| `Counter.tsx` | `components.jsx:Counter` | `to: number; suffix?: string; dur?: number` |
| `Ticker.tsx` | `components.jsx:Ticker` | `items: {id:string; name:string; org:string; time:string}[]` |
| `PillarIcon.tsx` | `page-home.jsx:PillarIcon` | `kind: 'shield'\|'wm'\|'cert'\|'star'` |

`SiteHeader` adaptation notes:
- Replace `setRoute()` with Next.js `<Link href="…">` 
- Replace `route===k ? 'active':''` with `usePathname() === href`
- Keep the `nav-meta` LIVE dot; wire sequence count to `listCertificates` count
- Add the API key button (keep existing behaviour from `Nav`)

---

## Styling integration strategy

**Do not rip out Tailwind.** Integrate new tokens alongside it:

1. In `globals.css`, add the design's `:root` token block after the existing Tailwind `@layer base` block.
2. Add `.wrap`, `.wrap-narrow`, `.eyebrow`, `.display`, `.lede`, `.hr`, `.seq-block`, `.tbl`, `.gov-strip`, `.site-header`, `.site-footer`, `.footer-grid`, `.footer-bottom`, `.badge-verify`, `.badge-accent`, `.badge-warn`, `.badge-dot`, `.btn-ghost`, `.btn-accent`, `.btn-sm`, `.card-flat`, `.seal-ring`, `.helix-wrap`, `.route`, `.grid-12` classes from `styles.css` into a new `@layer components` section.
3. The existing `.btn`, `.btn-primary`, `.card`, `.input`, `.label`, `.badge`, `.badge-pass`, `.badge-fail`, `.badge-warn`, `.badge-skip` classes stay — new classes extend them.
4. Font loading: add `<link>` for Instrument Serif, Inter Tight, JetBrains Mono in `app/layout.tsx` `<head>`.

---

## Open questions (must resolve with user before Phase 2 begins)

See `context.md §7` for the full list. Critical path items:

1. **Dark mode**: Keep or drop? (design is light-only)
2. **Provenance tab split**: Keep distribution issue feature alongside new watermark visual?
3. **Abstract tab data**: show empty state, or derive from existing cert fields?
4. **API key button location** in new Header
5. **Sequence tab**: confirm `carrier_indices` from `watermark_metadata.anchor_map` for highlight positions

---

## Phase execution order

```
Phase 2 — Foundation  (after Q&A)
  2a. Font installation
  2b. globals.css token + utility class extension
  2c. Shared component files created (BrandGlyph … Ticker)
  2d. SiteHeader + SiteFooter replacing existing Nav + footer in layout.tsx
  2e. Review checkpoint ← STOP

Phase 3a — Home page
  3a-1. Port layout, typography, ticker, counters
  3a-2. Wire stats to API
  3a-3. Review checkpoint ← STOP

Phase 3b — Registry
  3b-1. Port table, filter bar, search
  3b-2. Wire search/filter/pagination to existing client.listCertificates()
  3b-3. Review checkpoint ← STOP

Phase 3c — Record
  3c-1. Port top bar, header, sticky tabs
  3c-2. Port Abstract tab (with empty-state fallbacks)
  3c-3. Port Sequence tab (wire carrier_indices)
  3c-4. Restyle Biosafety tab (keep existing gate panels)
  3c-5. Rebuild Provenance tab (watermark visual + existing distribution UI)
  3c-6. Add References tab (static for now)
  3c-7. Plug existing Compliance + Synthesizer tabs back in
  3c-8. Review checkpoint ← STOP

Phase 3d — Register
  3d-1. 4-step wizard shell + stepper strip
  3d-2. Wire existing form logic to new step layout
  3d-3. Review checkpoint ← STOP

Phase 3e — Charter + Docs
  3e-1. New /about page
  3e-2. Redesign /getting-started
  3e-3. Review checkpoint ← STOP
```
