# ArtGene Archive

> **Cryptographic provenance and automated biosafety certification for synthetic gene sequences.**

ArtGene Archive is a full-stack platform that lets synthetic biology researchers register protein and DNA sequences against a tamper-evident public registry. Every registration runs a four-gate biosafety pipeline, embeds a covert **TINSEL watermark** inside codon choices (invisible to translation, detectable by the platform), signs the certificate with a post-quantum key, and appends an immutable blockchain-style audit log entry — all in one atomic transaction.

Built as an open research platform. Forkable and self-hostable with Docker Compose.

---

## How it works

```
Researcher submits FASTA
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ArtGene Registry API                         │
│                                                                 │
│  1. Parse + normalise FASTA  (protein / DNA / RNA detection)    │
│  2. SHA3-256 deduplication   (prevent re-registration)          │
│                                                                 │
│  3. ┌── Gate 1: ESMFold pLDDT ─────────────────────────────┐   │
│     │   Structural stability — must pass to proceed         │   │
│     └────────────────────────────────────────────────────── ┘   │
│                          │  (concurrent below)                  │
│  4. ┌── Gate 2: Off-Target Screening ────────────────────── ┐   │
│     │   Composition check + SecureDNA DOPRF + IBBIS commec  │   │
│     └────────────────────────────────────────────────────── ┘   │
│     ┌── Gate 3: Ecological Risk ──────────────────────────── ┐   │
│     │   Codon adaptation index + horizontal gene transfer    │   │
│     └────────────────────────────────────────────────────── ┘   │
│     ┌── Gate 4: Embedding Fingerprint ───────────────────── ┐   │
│     │   Composition fingerprint + ESM-2 sequence embedding  │   │
│     └────────────────────────────────────────────────────── ┘   │
│                                                                 │
│  5. Fragment k-mer cross-check  (assembly risk detection)       │
│  6. Fetch spreading + signing keys from Vault                   │
│  7. TINSEL watermark            (HMAC-SHA3-256 spread-spectrum) │
│  8. WOTS+ post-quantum signature over certificate hash          │
│  9. Atomic DB write:  certificate  +  audit log  +  k-mer index │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
Certificate issued  →  AG-2026-000001
```

The biosafety gates run **concurrently** after Gate 1 passes, keeping the wall-clock latency low even with four checks.

---

## What makes it interesting

### TINSEL — codon steganography
The watermark hides provenance bits inside synonymous codon choices. Methionine has no synonyms; leucine has six. The encoder uses HMAC-SHA3-256 to spread a structured bitstring across the available synonymous positions — invisible to ribosomes, detectable by the registry, and survivable across a single-base error thanks to Reed-Solomon coding.

| Tier     | Min carrier codons | Watermark bits | RS code   | Error tolerance |
|----------|:------------------:|:--------------:|:---------:|:---------------:|
| FULL     | 1,792              | 128-bit        | (32, 16)  | 8 bytes         |
| STANDARD |   896              |  64-bit        | (16,  8)  | 4 bytes         |
| REDUCED  |   320              |  32-bit        | ( 8,  4)  | 2 bytes         |
| MINIMAL  |    96              |  16-bit        | ( 4,  2)  | 1 byte          |
| DEMO     |    24              |   8-bit        | none      | 0               |
| REJECTED |  < 24              |  —             | —         | too short       |

The tier is determined automatically from the number of synonymous carrier codons in the submitted sequence. Shorter sequences get weaker watermarks; the REJECTED tier means the sequence cannot carry a detectable watermark at all.

### Tamper-evident audit log
Every registration appends a row to `registry_audit_log` using blockchain-style SHA3-256 chaining:

```
entry_hash = SHA3-256( seq_num || prev_entry_hash || certificate_hash )
```

A PostgreSQL trigger (migration 003) blocks any `UPDATE` or `DELETE` on this table at the database level. The ORM model has a second guard layer: `AppendOnlyMixin` raises `RuntimeError` if any field is mutated after the first commit.

### Fragment assembly risk detection
When a sequence is registered, its 20-mer subsequences are SHA3-256-hashed and stored in `fragment_kmer_index`. Future registrations check their k-mers against this index to detect sequences that could be assembled from previously registered fragments — without storing any raw sequence data.

### Post-quantum cryptography (partial)
WOTS+ (Winternitz One-Time Signature Scheme) signs the certificate hash with a keypair derived deterministically from `(spreading_key, registry_id)` — so the private key is never stored. **LWE lattice commitments are a planned feature** (clearly flagged in API responses with `"not_implemented": true`). The spread-spectrum HMAC watermark provides provenance today; the PQ layer provides forward-looking non-repudiation.

---

## Dashboard

The Next.js dashboard provides a full UI for the registry:

- **Register** — drag-and-drop FASTA upload, host organism selector, ethics code, visibility control (public / embargoed). Live biosafety gate progress tracker while the pipeline runs.
- **Public Registry** — paginated browse of all public certificates across all organisations.
- **My Sequences** — your organisation's certificates with sortable columns, inline quick-register modal, and one-click export.
- **Certificate Detail** — biosafety gate accordion, watermark metadata, χ² codon bias chart, compliance manifest download, synthesizer auth document, certificate export to `.artgene.json`.
- **Demo** — run the full watermark + biosafety analysis directly in the browser without registering.
- **Fragment Screen** — check whether a sequence's k-mers overlap with the registry.
- Dark mode, responsive layout, TanStack Query for data freshness.

---

## What's implemented vs. planned

### Implemented and production-ready
- [x] Four-gate biosafety pipeline (mock in dev, real adapters in prod)
- [x] TINSEL codon watermark (HMAC-SHA3-256 spread-spectrum, Reed-Solomon)
- [x] WOTS+ post-quantum signature (keypair derived per certificate, never stored)
- [x] Tamper-evident audit log with DB-level trigger
- [x] Fragment k-mer cross-check with privacy-preserving hashed index
- [x] SHA3-256 sequence deduplication
- [x] API key authentication with SHA3-256 hashed key storage, `last_used_at` tracking
- [x] Rate limiting (slowapi) — 10/20/100 req/min per endpoint class
- [x] Visibility control (public / embargoed) with publish workflow
- [x] Certificate export to `.artgene.json` (signed canonical bundle)
- [x] Compliance manifest with framework selector (US DURC, EU Dual-Use)
- [x] Synthesizer auth document generation
- [x] Idempotent dev seed (org + API key on first `docker compose up`)
- [x] Docker Compose with health-checked service dependencies and idempotent seed
- [x] Full Next.js dashboard with dark mode

### Planned / stubbed
- [ ] **LWE lattice commitments** — zero-filled stub; flagged with `"not_implemented": true` in responses (Phase 4)
- [ ] **Merkle inclusion proofs** for pathways — returns `{"not_implemented": true}` (Phase 7)
- [ ] **CDK / Terraform infra** — Mangum Lambda adapter is wired, no deployment manifests yet (Phase 5)
- [ ] **IBBIS + SecureDNA live mode** — adapters are implemented, mock used in dev

---

## Quick start (local)

### Requirements
- Docker 24+ and Docker Compose v2

### Run with Docker Compose

```bash
git clone https://github.com/babisingh/artgene-archive.git
cd artgene-archive

docker compose up --build
```

| Service   | URL                       |
|-----------|---------------------------|
| Dashboard | http://localhost:3000     |
| API       | http://localhost:8000     |
| API docs  | http://localhost:8000/docs |
| Database  | localhost:5432            |

On first start the container runs `alembic upgrade head` and seeds a development organisation. Your dev API key is:

```
tinsel-dev-key-00000000
```

Paste it into the **Set API Key** button in the dashboard nav, or pass it as `X-API-Key` in curl requests.

---

## API reference

All endpoints require `X-API-Key` except `/api/v1/health`.

### Register a sequence

```bash
curl -s -X POST http://localhost:8000/api/v1/register \
  -H "X-API-Key: tinsel-dev-key-00000000" \
  -H "Content-Type: application/json" \
  -d '{
    "fasta": ">MyProtein\nMAKTIIALSYIFCLVFADASHAAAAAAAAAAAAAAAAAAAAAA",
    "owner_id": "researcher@example.org",
    "ethics_code": "ETH-2026-001",
    "host_organism": "ECOLI",
    "visibility": "public"
  }'
```

Response `201`:
```json
{
  "status": "CERTIFIED",
  "registry_id": "AG-2026-000001",
  "tier": "STANDARD",
  "chi_squared": 1.234567,
  "message": "Sequence certified — AG-2026-000001",
  "consequence_report": { ... }
}
```

If any gate fails, `status` is `"FAILED"` with no `registry_id` and the full gate report attached.

### Fetch a certificate

```bash
curl -s http://localhost:8000/api/v1/certificates/AG-2026-000001 \
  -H "X-API-Key: tinsel-dev-key-00000000"
```

### Verify the watermark

```bash
curl -s -X POST http://localhost:8000/api/v1/certificates/AG-2026-000001/verify \
  -H "X-API-Key: tinsel-dev-key-00000000"
```

Response:
```json
{
  "registry_id": "AG-2026-000001",
  "verified": true,
  "bit_error_rate": 0.0,
  "tier": "STANDARD",
  "failure_reason": null
}
```

### Endpoints

| Method | Path | Rate limit | Auth | Description |
|--------|------|:----------:|:----:|-------------|
| GET | `/api/v1/health` | — | No | Liveness probe |
| POST | `/api/v1/register` | 20/min | Yes | Register sequence + run biosafety pipeline |
| GET | `/api/v1/certificates/` | 100/min | Yes | List certificates (paginated) |
| GET | `/api/v1/certificates/{id}` | 100/min | Yes | Fetch certificate |
| POST | `/api/v1/certificates/{id}/verify` | 20/min | Yes | Verify embedded watermark |
| POST | `/api/v1/certificates/{id}/publish` | 20/min | Yes | Lift embargo |
| GET | `/api/v1/certificates/{id}/export` | 100/min | Yes | Download `.artgene.json` bundle |
| POST | `/api/v1/pathways` | 20/min | Yes | Create multi-gene pathway bundle |
| GET | `/api/v1/pathways/{id}` | 100/min | Yes | Fetch pathway + Merkle root |
| POST | `/api/v1/analyse` | 10/min | No | Demo — watermark analysis without registering |
| POST | `/api/v1/structure` | 10/min | No | Demo — ESMFold structure prediction |

Interactive API docs (Swagger): `http://localhost:8000/docs`

---

## Environment variables

| Variable | Required in prod | Default (dev) | Description |
|---|:---:|---|---|
| `DATABASE_URL` | Yes | postgres://…@db:5432/artgene | PostgreSQL DSN |
| `SPREADING_KEY` | **Yes** | `aa…aa` (64 hex chars) | HMAC spreading key — **must be changed in production** |
| `SPREADING_KEY_ID` | Yes | `local-dev-key` | Key identifier for vault lookup |
| `SENTINEL_ENV` | Yes | `development` | `production` enables real biosafety gates and rejects the dev spreading key |
| `ALLOWED_ORIGINS` | Yes | `http://localhost:3000` | CORS allowlist (comma-separated) |
| `LOG_LEVEL` | No | `INFO` | Uvicorn log level |
| `AWS_REGION` | Prod only | `eu-west-1` | AWS region for Secrets Manager |
| `NCBI_EMAIL` | Prod only | — | Email for NCBI API calls |
| `ESMFOLD_API_URL` | Prod only | ESMAtlas URL | Override ESMFold endpoint |
| `NEXT_PUBLIC_API_URL` | Yes | `http://localhost:8000` | Browser-side API base URL |

> **Security note**: Setting `SENTINEL_ENV=production` without a custom `SPREADING_KEY` causes the API to refuse startup. Generate a key with:
> ```bash
> python -c "import secrets; print(secrets.token_hex(32))"
> ```

---

## Local development

### API (Python)

```bash
# Install the full monorepo with uv
uv sync

export DATABASE_URL="postgresql://postgres:tinsel_local_password@localhost:5432/artgene"
export SPREADING_KEY="$(python -c 'import secrets; print(secrets.token_hex(32))')"
export SPREADING_KEY_ID="local-dev-key"
export SENTINEL_ENV="development"

cd packages/tinsel-api
alembic upgrade head
python scripts/seed_dev.py
uvicorn sentinel_api.main:app --reload
```

### Dashboard (Node.js)

```bash
cd apps/dashboard
npm install
NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev
```

### Tests

```bash
# Python — unit + integration (SQLite in-memory, no Postgres needed)
pytest packages/ -v --import-mode=importlib

# Dashboard — type check + build
cd apps/dashboard
npm run type-check
npm run build
```

---

## Repository layout

```
artgene-archive/
├── apps/
│   └── dashboard/              Next.js 16 dashboard
│       ├── app/                App Router pages (register, registry, sequences, demo)
│       ├── components/         Shared UI components (CertBadges, CodonBiasChart, …)
│       └── lib/                Typed API client + React Query providers
├── packages/
│   ├── tinsel-core/            Core Python library
│   │   ├── tinsel/models.py    Pydantic registry models
│   │   ├── tinsel/watermark/   TINSEL encoder + decoder + Reed-Solomon codec
│   │   └── tinsel/crypto/      WOTS+ signer
│   ├── tinsel-gates/           Four-gate biosafety pipeline
│   │   └── tinsel_gates/       Production adapters (ESMFold, SecureDNA, IBBIS, …)
│   ├── tinsel-api/             FastAPI backend
│   │   └── sentinel_api/
│   │       ├── routes/         register, certificates, pathways, analyse, health
│   │       ├── db/             SQLAlchemy models + Alembic migrations (001–006)
│   │       └── vault/          AWS Secrets Manager + env-var mock vault
│   └── tinsel-demo/            Golden test vectors + demo runner
├── docker-compose.yml          Local development / self-hosting
├── pyproject.toml              uv monorepo workspace root
└── context.md                  Deployment review session log
```

---

## Tech stack

| Layer | Technology |
|---|---|
| API framework | FastAPI 0.115 + Uvicorn |
| Lambda adapter | Mangum (AWS Lambda compatible) |
| Database | PostgreSQL 15 (asyncpg + SQLAlchemy 2.0 async) |
| Migrations | Alembic 1.13 |
| Config | pydantic-settings 2.2 |
| Cryptography | hmac / hashlib (stdlib) + custom WOTS+ |
| Rate limiting | slowapi 0.1.9 |
| Python | 3.12+ |
| Dashboard | Next.js 16 (App Router, standalone output) |
| Styling | Tailwind CSS 3 |
| Data fetching | TanStack Query 5 |
| Tables | TanStack Table 8 |
| Charts | Recharts 2 |
| Forms | React Hook Form 7 + Zod 3 |
| UI primitives | Headless UI 2 |
| E2E tests | Playwright |
| CI | GitHub Actions (ruff + mypy + bandit + pytest / tsc + build) |

---

## Contributing

1. Fork and branch off `main`.
2. Run `uv run pytest` and `npm run type-check` before pushing.
3. Tests use `SENTINEL_ENV=development` (mock pipeline) — do not call live external APIs from tests.
4. Open a PR — CI (lint, types, security scan, tests) must pass before review.

---

## License

MIT — see `packages/tinsel-core/pyproject.toml`.

---

## Contact

Questions and bug reports: [b@genethropic.com](mailto:b@genethropic.com) · [GitHub Issues](https://github.com/babisingh/artgene-archive/issues)
