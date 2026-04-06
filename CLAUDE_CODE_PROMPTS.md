# ArtGene — Claude Code Prompts (Phase 2 → 6)

This file contains the full prompt scripts for each development phase.
Paste the relevant block into Claude Code at the start of each phase.

---

## Phase 2 — Gate Adapter Integration & Real Backend Wiring

```
Context: packages/tinsel-gates/ contains mock adapters for ESMFold,
NCBI BLAST, and ToxinPred. All GateResult schemas live in
tinsel/models.py (tinsel-core package).

Tasks:
1. Replace MockESMFoldAdapter with a real ESMFoldAdapter that calls the
   ESMFold REST API at $ESMFOLD_API_URL (env var). POST /predict with
   {"sequence": "<aa_seq>"} and parse pLDDT scores from the JSON response.
   Implement exponential-backoff retry (max 3 attempts, base 2 s).

2. Replace MockNCBIBlastAdapter with a real NCBIBlastAdapter using the
   NCBI E-utilities API (api_key from $NCBI_BLAST_API_KEY).
   Run blastp with database=nr, hitlist_size=10, expect=1e-5.
   Parse BlastHit objects from the XML response (use xml.etree.ElementTree).

3. Replace MockToxinPredAdapter with a real ToxinPredAdapter that POSTs
   to $TOXINPRED_API_URL/predict and parses the JSON toxicity_score.

4. Add USE_MOCK_ADAPTERS env-var toggle in sentinel_gates/pipeline.py so
   the pipeline factory returns mock adapters when the flag is true (default
   in dev/CI) and real adapters in production.

5. Write pytest-asyncio tests in packages/tinsel-gates/tests/ for all
   three real adapters using responses (HTTP mocking). Target: 30+ tests.

6. Update .github/workflows/ci.yml to remove continue-on-error from the
   tinsel-gates job and add the NCBI_BLAST_API_KEY secret.

Constraints:
- Python 3.12, pydantic>=2.7, httpx for async HTTP.
- No new dependencies beyond httpx and responses.
- Keep backward-compatible with existing GateResult schema.
```

---

## Phase 3 — Persistent Storage & Job Queue

```
Context: tinsel-api currently uses an in-memory dict for sequences
(tinsel_api/routes/sequences.py). Gate runs are synchronous (blocking
the request). We need async job execution and durable storage.

Tasks:
1. Add PostgreSQL via asyncpg. Create tinsel_api/db.py with:
   - async engine / sessionmaker (SQLAlchemy 2.0 async style)
   - SequenceORM model (id, sequence, seq_type, description, created_at)
   - PipelineResultORM model (id, sequence_id FK, overall_status, created_at,
     gates JSONB)
   Use Alembic for migrations (alembic init alembic inside tinsel-api).

2. Wire DATABASE_URL env var (from .env.example) into tinsel_api/db.py.

3. Replace in-memory _store in routes/sequences.py with DB-backed CRUD
   using asyncpg. Add GET /sequences?limit=50&offset=0 pagination.

4. Add ARQ (async Redis queue) for gate runs:
   - tinsel_api/worker.py: ARQ WorkerSettings with run_gates task
   - POST /gates/run enqueues the job and returns {"job_id": "...", "status": "queued"}
   - GET /gates/jobs/{job_id} returns current status + result when done

5. Add Alembic migration for the two new tables.

6. Write tests in packages/tinsel-api/tests/ using pytest-asyncio +
   httpx AsyncClient + SQLite (aiosqlite) as the test DB. Target: 25+ tests.

7. Update docker-compose.yml:
   - Add postgres:16-alpine service
   - Set DATABASE_URL in api and worker services
   - Add volume for postgres data

8. Update CI: add postgres service container to test-tinsel-api job.

Constraints:
- SQLAlchemy 2.0+ async only (no synchronous ORM usage).
- Alembic autogenerate from ORM models.
- ARQ >= 0.25, asyncpg >= 0.29.
```

---

## Phase 4 — Dashboard Feature Build-out

```
Context: apps/dashboard has a Next.js 14 skeleton (app router) with a
single page that calls POST /gates/run synchronously. The API now has
async jobs (Phase 3). Time to build the real UI.

Tasks:
1. Create a Sequence Library page at app/sequences/page.tsx:
   - Fetch GET /sequences and display in a sortable table (react-table v8).
   - Add "New Sequence" modal (react-hook-form + zod validation).
   - Delete row with confirmation dialog.

2. Create a Gate Run page at app/sequences/[id]/gates/page.tsx:
   - On mount, POST /gates/run for the sequence and poll
     GET /gates/jobs/{job_id} every 2 s until status is complete.
   - Display per-gate results in an accordion (headless-ui Disclosure).
   - Show pLDDT score as a sparkline chart (recharts).

3. Create a shared API client at lib/api.ts using fetch with typed
   responses matching the Pydantic schemas from tinsel-api.

4. Add Tailwind CSS (tailwindcss 3, postcss, autoprefixer).
   Replace all inline styles with Tailwind classes.

5. Add dark-mode support (class strategy in tailwind.config.ts).

6. Add loading.tsx and error.tsx for each route segment.

7. Write Playwright e2e tests in apps/dashboard/e2e/:
   - sequences CRUD flow
   - gate run polling flow (mock the API with msw)
   Target: 10+ tests.

8. Update CI: add a build-dashboard job that runs next build.

Constraints:
- Next.js 14 App Router only (no pages/ dir).
- No Redux; use React Query (tanstack-query v5) for server state.
- All components must be typed (no `any`).
```

---

## Phase 5 — AWS Deployment & Infrastructure

```
Context: The stack runs locally via docker-compose. Now deploy to AWS:
API → Lambda (Mangum), Dashboard → CloudFront + S3 static export,
jobs → ECS Fargate worker, DB → RDS Aurora Serverless v2 (Postgres).

Tasks:
1. Add infra/ directory with AWS CDK v2 (Python) stacks:
   - infra/stacks/api_stack.py: Lambda function URL + API Gateway HTTP API
   - infra/stacks/dashboard_stack.py: S3 bucket + CloudFront distribution
   - infra/stacks/data_stack.py: Aurora Serverless v2 cluster, ElastiCache Redis
   - infra/stacks/worker_stack.py: ECS Fargate task definition + service
   - infra/app.py: CDK app wiring all stacks

2. Add infra/pyproject.toml (aws-cdk-lib>=2.140, constructs>=10.3).

3. Containerise tinsel-api:
   - packages/tinsel-api/Dockerfile (multi-stage, python:3.12-slim base)
   - packages/tinsel-api/.dockerignore

4. Containerise the worker:
   - Reuse tinsel-api Dockerfile with CMD override in docker-compose.yml.

5. Next.js static export:
   - Set output: "export" in next.config.ts for production builds.
   - apps/dashboard/Dockerfile for local container (serve via nginx:alpine).

6. Add GitHub Actions deployment workflow .github/workflows/deploy.yml:
   - Trigger on push to main.
   - Jobs: cdk-diff (PR) and cdk-deploy (main).
   - Use OIDC for AWS credentials (no long-lived keys).

7. Add infra/tests/ with CDK snapshot tests (aws-cdk-lib assertions).

Constraints:
- CDK v2 Python only.
- Aurora Serverless v2 pauses when idle (cost saving).
- All secrets via AWS Secrets Manager (no env vars with real creds in CI).
- VPC with private subnets for RDS + Redis; Lambda in the same VPC.
```

---

## Phase 6 — Production Hardening & Observability

```
Context: The platform is deployed on AWS (Phase 5). Now harden it for
production: auth, rate limiting, structured logging, metrics, tracing.

Tasks:
1. Authentication:
   - Add AWS Cognito user pool via CDK (infra/stacks/auth_stack.py).
   - Protect all /sequences and /gates endpoints with JWT validation
     (python-jose or PyJWT). Add GET /auth/me endpoint.
   - Dashboard: add sign-in / sign-up pages using AWS Amplify Auth.

2. Rate limiting:
   - Add slowapi middleware to tinsel-api (10 req/s per IP on gate runs,
     100 req/s per IP on sequences).
   - Return 429 with Retry-After header.

3. Structured logging:
   - Replace all print/logging calls with structlog (JSON output).
   - Include request_id (UUID injected by middleware), sequence_id,
     gate_name, duration_ms in every log line.
   - Ship logs to CloudWatch via the Lambda/ECS log driver.

4. Metrics & tracing:
   - Instrument tinsel-api with OpenTelemetry (opentelemetry-sdk,
     opentelemetry-instrumentation-fastapi).
   - Export traces to AWS X-Ray (opentelemetry-exporter-otlp-proto-grpc).
   - Add custom metrics: gate_duration_seconds (histogram per gate_name),
     gate_status_total (counter per gate_name + status).
   - Dashboard: add /admin/metrics page showing P50/P95 gate latencies
     (fetch from CloudWatch Metrics via tinsel-api proxy endpoint).

5. Alerting:
   - CDK: CloudWatch alarms for error rate > 1%, gate P95 > 30 s,
     Lambda throttles > 0.
   - SNS topic → email for on-call.

6. Security hardening:
   - Enable AWS WAF on API Gateway (managed rules: AWSManagedRulesCommonRuleSet).
   - Add Content-Security-Policy, X-Frame-Options headers in CloudFront.
   - Enable RDS encryption at rest, enforce SSL connections.
   - Run bandit on Python packages in CI (add to lint-python job).
   - Run npm audit in lint-dashboard job.

7. Load testing:
   - Add locust/locustfile.py targeting POST /gates/run.
   - Document p95 < 5 s target at 50 concurrent users in README.

Constraints:
- Zero secrets in source code or environment variables visible in logs.
- All CDK changes must pass cdk diff with no destructive actions in CI.
- OpenTelemetry SDK must not add > 50 ms overhead to p50 gate latency.
```
