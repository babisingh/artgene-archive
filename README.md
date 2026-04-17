# ArtGene Archive

A biosafety watermarking registry for synthetic biology sequences. ArtGene Archive
ingests protein and DNA sequences, runs a three-gate biosafety pipeline, embeds a
covert TINSEL watermark via spread-spectrum codon-choice steganography, and issues
a tamper-evident certificate stored in PostgreSQL.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client / Browser                        │
│                    Next.js 16 Dashboard (port 3000)             │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTP / REST
┌───────────────────────────▼─────────────────────────────────────┐
│                     FastAPI (port 8000)                         │
│  POST /api/v1/register                                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Step 1 │ Parse & normalise FASTA  → detect seq type     │   │
│  │  Step 2 │ Three-gate biosafety pipeline (tinsel-gates)   │   │
│  │         │   Gate 1 — ESMFold pLDDT structural stability  │   │
│  │         │   Gate 2 — composition heuristic / toxin screen│   │
│  │         │   Gate 3 — HGT risk / codon adaptation index   │   │
│  │  Step 3 │ Deduplication check (SHA3-256 sequence hash)   │   │
│  │  Step 4 │ Fetch spreading key from Vault                 │   │
│  │  Step 5 │ TINSELEncoder.encode_v1() — codon watermark    │   │
│  │  Step 6 │ Build HybridCertificate + stub WOTS+/LWE       │   │
│  │  Step 7 │ Write Certificate row → PostgreSQL             │   │
│  │  Step 8 │ Append tamper-evident RegistryAuditLog entry   │   │
│  └──────────────────────────────────────────────────────────┘   │
│  GET  /api/v1/certificates/{id}                                 │
│  GET  /api/v1/certificates/                                     │
│  POST /api/v1/certificates/{id}/verify                          │
│  POST /api/v1/certificates/{id}/publish                         │
│  GET  /api/v1/certificates/{id}/export                          │
└───────────────────────────┬─────────────────────────────────────┘
                            │ asyncpg / SQLAlchemy 2.0
┌───────────────────────────▼─────────────────────────────────────┐
│              PostgreSQL 15 (supabase/postgres image)            │
│   tables: certificates · organisations · registry_audit_log    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Features

- **TINSEL watermarking** — spread-spectrum codon-choice steganography using
  HMAC-SHA3-256. Watermark capacity is tiered by synonymous carrier positions:

  | Tier     | Min carriers | Signature | RS codec  | Correctable bytes |
  |----------|:------------:|:---------:|:---------:|:-----------------:|
  | FULL     | 1,792        | 128-bit   | (32, 16)  | 8                 |
  | STANDARD |   896        |  64-bit   | (16,  8)  | 4                 |
  | REDUCED  |   320        |  32-bit   | ( 8,  4)  | 2                 |
  | MINIMAL  |    96        |  16-bit   | ( 4,  2)  | 1                 |
  | DEMO     |    24        |   8-bit   | none      | 0                 |
  | REJECTED |   < 24       |  —        | —         | not embeddable    |

- **Three-gate biosafety pipeline**
  - Gate 1: ESMFold pLDDT structural stability score
  - Gate 2: Composition heuristic — toxin / allergen sequence screening
  - Gate 3: Horizontal gene transfer (HGT) risk + codon adaptation index

- **Certificate statuses**: `CERTIFIED`, `CERTIFIED_WITH_WARNINGS`, `FAILED`, `PENDING`

- **Visibility control**: `public` (globally visible) or `embargoed` (private to the
  owning organisation until explicitly published)

- **Tamper-evident audit log**: blockchain-style chained SHA3-256 hashes across all
  registry entries

- **Deduplication**: SHA3-256 of the normalised protein sequence prevents re-registration
  without leaking the existing certificate identity

- **Sequence length cap**: 5,000 AA per submission

- **Rate limiting** (via slowapi):
  - Demo endpoints: 10 req/min
  - Write endpoints: 20 req/min
  - Read endpoints: 100 req/min

- **Post-quantum crypto stubs**: WOTS+ one-time signatures and LWE lattice commitments
  are Phase 7 placeholders; the HMAC-SHA3-256 codon watermark provides provenance now

---

## Tech Stack

### API (`packages/tinsel-api`)
| Component      | Library                              |
|----------------|--------------------------------------|
| Framework      | FastAPI 0.115+                       |
| ASGI server    | Uvicorn (standard)                   |
| Lambda adapter | Mangum 0.17                          |
| Database       | PostgreSQL 15 via asyncpg + SQLAlchemy 2.0 (async) |
| Migrations     | Alembic 1.13                         |
| Config         | pydantic-settings 2.2                |
| Rate limiting  | slowapi 0.1.9                        |
| AWS secrets    | boto3 1.34                           |
| Python         | 3.12+                                |

### Core library (`packages/tinsel-core`)
- Pydantic v2 registry models (`HybridCertificate`, `WatermarkResult`, etc.)
- `TINSELEncoder` / `TINSELDecoder` — spread-spectrum codon steganography
- Reed-Solomon codec per tier

### Biosafety gates (`packages/tinsel-gates`)
- `run_consequence_pipeline()` — async three-gate pipeline
- Mock mode available for `development` / `test` environments

### Dashboard (`apps/dashboard`)
| Component        | Library                   |
|------------------|---------------------------|
| Framework        | Next.js 16 + React 18     |
| Styling          | Tailwind CSS 3            |
| Data fetching    | TanStack Query 5          |
| Tables           | TanStack Table 8          |
| Charts           | Recharts 2                |
| Forms            | React Hook Form 7 + Zod 3 |
| UI primitives    | Headless UI 2             |
| E2E tests        | Playwright                |
| Language         | TypeScript 5              |

---

## Getting Started

### Prerequisites
- Docker and Docker Compose
- (Local dev only) Python 3.12+, Node.js 20+, `uv`

### Docker Compose (recommended)

```bash
git clone <repo-url> artgene-archive
cd artgene-archive

# Optional: override defaults
cp .env.example .env   # if present; otherwise env vars have sane defaults

docker compose up --build
```

Services started:

| Service   | URL                          |
|-----------|------------------------------|
| API       | http://localhost:8000        |
| Dashboard | http://localhost:3000        |
| Database  | localhost:5432               |

On first start the API container runs `alembic upgrade head` and
`scripts/seed_dev.py` to create the schema and seed an initial organisation.

**Demo API key**: `tinsel-dev-key-00000000`

### Local Development

#### API

```bash
cd packages/tinsel-api

# Install all packages in the monorepo
uv sync

# Start a local PostgreSQL instance (or point DATABASE_URL at an existing one)
export DATABASE_URL="postgresql://postgres:tinsel_local_password@localhost:5432/artgene"
export SPREADING_KEY_ID="local-dev-key"
export SPREADING_KEY="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
export SENTINEL_ENV="development"

alembic upgrade head
python scripts/seed_dev.py
uvicorn sentinel_api.main:app --reload
```

#### Dashboard

```bash
cd apps/dashboard
npm install
NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev
```

#### Run tests

```bash
# API unit + integration tests
cd packages/tinsel-api
uv run pytest

# Dashboard E2E (requires running stack)
cd apps/dashboard
npx playwright test
```

---

## API Endpoints

All endpoints are prefixed `/api/v1/` and require an `X-Api-Key` header unless
noted otherwise. The health endpoint is public.

### Health

| Method | Path              | Description          |
|--------|-------------------|----------------------|
| GET    | `/api/v1/health`  | Liveness probe       |

### Registration

| Method | Path                  | Rate limit  | Description                              |
|--------|-----------------------|-------------|------------------------------------------|
| POST   | `/api/v1/register`    | 20 req/min  | Register a sequence; runs biosafety pipeline and issues certificate |

**Request body:**

```json
{
  "fasta": ">MyProtein\nMAKTII...",
  "owner_id": "researcher@example.org",
  "ethics_code": "ETH-2026-001",
  "host_organism": "ECOLI",
  "visibility": "public"
}
```

`host_organism` options: `HUMAN`, `ECOLI`, `YEAST`, `CHO`, `INSECT`, `PLANT`

`visibility` options: `public`, `embargoed`

**Response (201):**

```json
{
  "status": "CERTIFIED",
  "registry_id": "AG-2026-000001",
  "tier": "STANDARD",
  "chi_squared": 1.234,
  "consequence_report": { ... },
  "message": "Sequence certified — AG-2026-000001"
}
```

If any biosafety gate returns `FAIL`, the response has `status: "FAILED"` with no
`registry_id` and the full consequence report attached.

### Certificates

| Method | Path                                    | Rate limit  | Description                            |
|--------|-----------------------------------------|-------------|----------------------------------------|
| GET    | `/api/v1/certificates/`                 | 100 req/min | List certificates (paginated, `limit`/`offset`) |
| GET    | `/api/v1/certificates/{id}`             | 100 req/min | Fetch a single certificate             |
| POST   | `/api/v1/certificates/{id}/verify`      | 20 req/min  | Verify the embedded TINSEL watermark   |
| POST   | `/api/v1/certificates/{id}/publish`     | 20 req/min  | Lift embargo — make certificate public |
| GET    | `/api/v1/certificates/{id}/export`      | 100 req/min | Download canonical signed JSON (`*.artgene.json`) |

Registry IDs follow the pattern `AG-{year}-{seq:06d}`, e.g. `AG-2026-000001`.

**Embargoed certificates** are only visible to the owning organisation. The `GET /`
list endpoint returns own certs plus all public certs; embargoed certs from other
organisations are hidden entirely (no 403, just absent).

### Quick start with curl

```bash
API=http://localhost:8000
KEY=tinsel-dev-key-00000000

# Register a sequence
curl -s -X POST "$API/api/v1/register" \
  -H "X-Api-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "fasta": ">test\nMKTIIALSYIFCLVFA",
    "owner_id": "demo@example.org",
    "ethics_code": "ETH-DEMO",
    "host_organism": "ECOLI",
    "visibility": "public"
  }'

# Fetch the certificate
curl -s "$API/api/v1/certificates/AG-2026-000001" \
  -H "X-Api-Key: $KEY"

# Verify the watermark
curl -s -X POST "$API/api/v1/certificates/AG-2026-000001/verify" \
  -H "X-Api-Key: $KEY"
```

---

## Environment Variables

| Variable            | Default (docker-compose)                       | Description                              |
|---------------------|------------------------------------------------|------------------------------------------|
| `DATABASE_URL`      | `postgresql://postgres:tinsel_local_password@db:5432/artgene` | PostgreSQL DSN |
| `SPREADING_KEY_ID`  | `local-dev-key`                                | Key ID looked up in Vault                |
| `SPREADING_KEY`     | 64-char hex string                             | Raw HMAC spreading key (dev only)        |
| `SENTINEL_ENV`      | `development`                                  | `development` enables mock biosafety gates |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000`                      | Browser-side API base URL (dashboard)    |

---

## Repository Layout

```
artgene-archive/
├── packages/
│   ├── tinsel-core/     # Core Pydantic models, encoder/decoder, tier logic
│   ├── tinsel-api/      # FastAPI application (sentinel_api), DB models, routes
│   ├── tinsel-gates/    # Three-gate biosafety pipeline
│   └── tinsel-demo/     # Demo notebooks / scripts
├── apps/
│   └── dashboard/       # Next.js 16 web dashboard
├── docker-compose.yml
└── pyproject.toml       # Monorepo uv workspace root
```

---

## Cryptographic Notes

- The **TINSEL codon watermark** (HMAC-SHA3-256 spread-spectrum) is the primary
  provenance mechanism and is production-ready in this release.
- **WOTS+ one-time signatures** and **LWE lattice commitments** are Phase 7
  placeholders. Certificates exported via `/export` carry a machine-readable notice
  that these fields are stubs and provide no post-quantum cryptographic guarantee.
- Certificate hashes use SHA3-512 over all certificate fields.
- The audit log uses SHA3-256 chained entries (seq_num | prev_hash | cert_hash).

---

## Contributing

1. Fork the repository and create a branch off `main`.
2. Make changes; run `uv run pytest` (API) and `npx playwright test` (dashboard)
   before pushing.
3. Open a pull request — CI must pass before review.
4. All sequence registrations in tests must use the `SENTINEL_ENV=development` mock
   pipeline; do not call live ESMFold or HGT services from tests.

---

## License

MIT — see `packages/tinsel-api/pyproject.toml`.
