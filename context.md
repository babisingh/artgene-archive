# ArtGene Archive — Deployment Review Context

> **Purpose**: Universal reference for all review/fix sessions. Update this file at the end of each session.
> **Branch**: `claude/review-artgene-deployment-WjhZP`
> **Review date**: 2026-04-22
> **Target**: Production-ready (8/10 by expert coders). UI work follows code review.

---

## Repository Layout

```
artgene-archive/
├── apps/dashboard/          Next.js 16 frontend (TypeScript, Tailwind, TanStack)
└── packages/
    ├── tinsel-core/         Core Python library — FASTA, Pydantic models, crypto, watermark
    ├── tinsel-gates/        Biosafety gate adapters (PRODUCTION: tinsel_gates/)
    │                        + LEGACY dead code (sentinel_gates/)
    ├── tinsel-api/          FastAPI backend (PRODUCTION: sentinel_api/)
    │                        + LEGACY dead code (tinsel_api/)
    └── tinsel-demo/         Demo runner + golden test vectors
```

## Technology Stack

| Layer | Tech |
|---|---|
| Backend | FastAPI 0.115, Python 3.12, SQLAlchemy 2 async, asyncpg, Alembic |
| Database | PostgreSQL 15 (Docker: supabase image) |
| Auth | API key (slowapi rate limiting, SHA3-256 hashed keys) |
| Crypto | HMAC-SHA3-256 spread-spectrum watermark + custom WOTS+ PQ signing |
| Config | pydantic-settings; secrets via AWS Secrets Manager (prod) or env vars (dev) |
| Lambda | Mangum adapter (optional AWS Lambda deployment) |
| Frontend | Next.js 16 App Router, React 18, Tailwind 3, TanStack Query/Table |
| CI | GitHub Actions (python lint/type/test + dashboard type/build) |
| Container | Docker Compose (api + dashboard + db) |

---

## Session Plan

### Session 1 — Security Critical Fixes (DONE)
**Goal**: Fix all High-severity security issues before anyone else sees the code.

- [x] S1-A: Fix AWS vault — `get_signing_key()` now derives via SHA3-256 (matches mock, TINSELEncoder no longer crashes)
- [x] S1-B: Added `@field_validator` (hex + length) + `@model_validator` (rejects dev key when `SENTINEL_ENV=production`)
- [x] S1-C: Deleted `tinsel_api/` (legacy app — wildcard CORS, no auth, no rate limiting)
- [x] S1-C: Deleted `sentinel_gates/` (legacy gate pipeline, only used by tinsel_api)
- [x] S1-C: Updated both `pyproject.toml` files — removed legacy packages from wheel exports
- [x] S1-D: Removed malformed `entrypoint`/`command` block from `docker-compose.yml`; Dockerfile CMD (`start.sh`) now handles startup
- [x] S1-D: Added idempotent dev seed to `start.sh` (runs only when `SENTINEL_ENV=development`)
- [x] S1-E: Removed broken `assert "env" in body` from health test
- [x] S1-F: Footer — replaced placeholder emails with `b@genethropic.com`, removed biosafety email + physical address

### Session 2 — Structural Cleanup
**Goal**: Remove dead code that confuses the codebase and inflates the image.

- [ ] S2-A: Delete `sentinel_gates/` from `tinsel-gates` package (legacy 3-adapter pipeline, only used by legacy tinsel_api)
- [ ] S2-B: Delete `tinsel_api/` from `tinsel-api` package (legacy v0.1 app, no auth, no tests)
- [ ] S2-C: Update `pyproject.toml` package exports for both packages after deletion
- [ ] S2-D: Update CI to run bandit security scan
- [ ] S2-E: Add npm audit to CI dashboard job

### Session 3 — Code Quality Hardening
**Goal**: Fix medium-severity gaps that affect correctness and auditability.

- [ ] S3-A: Update `api_keys.last_used_at` on every successful authentication in `dependencies.py`
- [ ] S3-B: Add `limit`/`offset` pagination to `GET /sequences/` in legacy routes (or confirm deletion covers this)
- [ ] S3-C: Add missing DB index on `fragment_kmer_index.org_id` (migration 006)
- [ ] S3-D: Upgrade `EnvMockVaultClient` key derivation from SHA3 concat to proper HKDF
- [ ] S3-E: Mark LWE and Merkle stubs explicitly in API responses (`"status": "not_implemented"`)

### Session 4 — UI Review
**Goal**: Review and fix the Next.js dashboard (post code-review).
*(Scope TBD with user)*

---

## Issues Registry

### HIGH — Must fix before release

| ID | File | Line | Issue |
|---|---|---|---|
| SEC-01 | `sentinel_api/vault/aws_secrets.py` | 34–35 | `get_signing_key()` returns same bytes as `get_spreading_key()` → encoder crashes in prod |
| SEC-02 | `sentinel_api/config.py` | 33 | Hardcoded `"aa" * 32` default spreading key — silent insecure fallback if env var missing |
| SEC-03 | `tinsel_api/main.py` | 19–22 | Wildcard CORS + `allow_credentials=True` + zero authentication |
| BRK-01 | `docker-compose.yml` | 17–26 | Malformed YAML command block — container startup will fail |
| BRK-02 | `tests/test_api.py` | 27 | Asserts `"env"` in health body — field not returned by public `/api/v1/health` |

### MEDIUM — Fix before release

| ID | File | Line | Issue |
|---|---|---|---|
| STR-01 | `packages/tinsel-gates/sentinel_gates/` | — | Entire legacy gate package, only used by dead tinsel_api app |
| STR-02 | `packages/tinsel-api/tinsel_api/` | — | Entire legacy API app, no auth, no rate limiting, dead code |
| AUD-01 | `sentinel_api/dependencies.py` | — | `last_used_at` column never written on API key auth |
| DB-01 | `db/migrations/` | — | Missing index on `fragment_kmer_index.org_id` |
| KEY-01 | `sentinel_api/vault/env_mock.py` | 29–36 | SHA3 concat key derivation — should use HKDF |

### LOW — Nice to have

| ID | File | Issue |
|---|---|---|
| STUB-01 | `sentinel_api/routes/pathways.py:97` | Merkle proof always `None` |
| STUB-02 | `sentinel_api/routes/register.py:349` | LWE commitment always zero-filled stub |
| CI-01 | `.github/workflows/ci.yml` | No bandit security scan |
| CI-02 | `.github/workflows/ci.yml` | No npm audit |
| PAG-01 | `tinsel_api/routes/sequences.py` | No pagination (moot if legacy app deleted) |

---

## Architecture — Registration Pipeline (8 steps)

1. Parse + normalise FASTA (protein / DNA / RNA detection)
2. SHA3-256 dedup check against existing certificates
3. Gate 1 — ESMFold structure prediction (blocks on failure)
4. Gates 2–4 — composition, codon bias, embedding fingerprint (concurrent after Gate 1)
5. Fragment k-mer cross-check against registry index
6. Fetch spreading + signing keys from vault
7. TINSEL watermark via HMAC-SHA3-256 spread-spectrum codon steganography
8. WOTS+ post-quantum signature over certificate hash
9. Atomic DB write: `certificates` + `registry_audit_log` + `fragment_kmer_index`

Audit log uses blockchain-style SHA3-256 chaining. DB trigger (migration 003) blocks UPDATE/DELETE on audit table.

---

## Production vs Legacy Code Map

| Package | PRODUCTION (use this) | LEGACY (delete) |
|---|---|---|
| `tinsel-gates` | `tinsel_gates/` | `sentinel_gates/` |
| `tinsel-api` | `sentinel_api/` | `tinsel_api/` |

---

## Key File Locations

| File | Purpose |
|---|---|
| `sentinel_api/main.py` | FastAPI app entry + Mangum Lambda handler |
| `sentinel_api/config.py` | pydantic-settings — all env vars |
| `sentinel_api/dependencies.py` | API key authentication |
| `sentinel_api/vault/aws_secrets.py` | Production secret fetcher (BROKEN — SEC-01) |
| `sentinel_api/vault/env_mock.py` | Dev/test secret fetcher |
| `sentinel_api/routes/register.py` | Core registration flow |
| `sentinel_api/db/models.py` | SQLAlchemy ORM (6 tables) |
| `sentinel_api/db/migrations/` | Alembic versions 001–005 |
| `tinsel/watermark/tinsel_encoder.py` | TINSELEncoder (requires spreading_key ≠ signing_key) |
| `apps/dashboard/lib/api.ts` | Typed frontend API client |
| `docker-compose.yml` | Local deployment (BROKEN — BRK-01) |
| `.env.example` | Required env var reference |

---

## Open Clarifications (Awaiting User Response)

1. **Legacy code removal**: Delete `tinsel_api/` and `sentinel_gates/` entirely, or move to an `archive/` folder?
2. **Stub features**: LWE commitments + Merkle proofs are Phase 4/7 stubs. Return them as `null` (current) or add explicit `"status": "not_implemented"` flags in the response?
3. **Deployment target**: Primary target is Docker Compose, AWS Lambda, or both? (Mangum is wired but no CDK infra exists)
4. **SPREADING_KEY default**: Make it required (crash on startup if missing), or allow a clearly-marked dev-only default in `.env.example` only?
5. **Dashboard contact emails**: `contact@artgene.bio` / `biosafety@artgene.bio` — real addresses or placeholder?

---

## Session Log

| Date | Session | Changes Made | Status |
|---|---|---|---|
| 2026-04-22 | Exploration | Full codebase audit, created context.md | Done |
| 2026-04-22 | Session 1 | SEC-01 AWS vault fix, SEC-02 prod key guard, SEC-03 delete tinsel_api+sentinel_gates, BRK-01 docker-compose fix, BRK-02 health test fix, footer contact fix | Done |
| — | Session 2 | Code quality hardening (AUD-01, DB-01, KEY-01, stubs) | Pending |
| — | Session 3 | CI hardening (bandit, npm audit) | Pending |
| — | Session 4 | UI review | Pending |
