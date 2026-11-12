# Deploy runbook

Written to be executed by a person with Railway access, in order, because the
steps are not independent. Claude cannot reach Railway, so steps marked **you**
are yours; steps marked **verify** are commands whose output tells you whether
the previous step worked.

The service has been unreachable since roughly 2026-07 and the registry has
never held a record, so there is no data to lose and no users to disrupt.

## The ordering that matters

Restoring the API brings back the **unfixed** dashboard proxy, which lends its
API key to anonymous callers, until the fixed build is deployed. The window is
small and the registry is empty, so the practical risk is low, but do these in
one sitting rather than leaving step 1 running overnight:

1. Restore the API service.
2. Deploy the fixed dashboard and API.
3. Only then link the registry anywhere public or point reviewers at it.

## Step 0, preconditions

- The branch `claude/ingest-architecture` is merged or deployed. It contains the
  proxy allowlist, the client key removal, the development-mode guard and the
  integrity fixes.
- You have decided the repository stays public. The paper's Code and Data
  Availability section names the public URL, and Table 3's footnote says
  "public GitHub repository", so making it private would contradict a
  submission.

## Step 1, find out why the API is down (you)

Open the Railway project, the API service, Deployments, the most recent one,
and read the logs. The likely messages, in order of probability:

| What you see | What it means | Fix |
|---|---|---|
| `DB not ready` repeatedly, then `Database not reachable after 10 attempts` | The Postgres plugin is gone or no longer linked, so `DATABASE_URL` is absent or stale | Step 2 |
| `ERROR: SENTINEL_ENV is not set.` | The new guard is working. The variable was never set and the old code silently defaulted to development | Step 3 |
| A pydantic validation error naming `SPREADING_KEY` | Production mode with the development default key | Step 3 |
| `postmaster`, `FATAL`, or nothing at all | The service was stopped or exhausted `restartPolicyMaxRetries: 10` | Redeploy after step 3 |

`start.sh` exits non-zero after ten failed database attempts, `/api/v1/health`
returns 503 when the pool is unreachable, and `railway.json` health-checks that
path with ten retries. A database that went away would therefore crash-loop the
service ten times and then stay down, which matches the symptoms exactly:
dashboard up, every proxied call 500.

## Step 2, the database (you)

Confirm a PostgreSQL instance exists in the project and is linked to the API
service, so `DATABASE_URL` is injected. If the old one is gone, create a new
one: the schema is rebuilt by `alembic upgrade head` on every start, and there
are no records to restore.

## Step 3, environment variables (you)

On the **API** service:

| Variable | Value | Why |
|---|---|---|
| `SENTINEL_ENV` | `production` | Not defaulted any more. Development mode uses mock biosafety gates and seeds a known key. |
| `SPREADING_KEY` | 64 hex characters | Generate with `python -c "import secrets; print(secrets.token_hex(32))"`. Production refuses the development default. |
| `SPREADING_KEY_ID` | any stable label | Recorded in watermark metadata so a certificate names the key it used. |
| `ALLOWED_ORIGINS` | `https://artgene-archive.org` | Never `*`, since requests carry credentials. |
| `ARTGENE_API_KEY` | a fresh random token | Rotate on restore. The old value never leaked, but the proxy made its authority public. |
| `DATABASE_URL` | injected by the plugin | Do not set by hand. |

On the **dashboard** service:

| Variable | Value | Why |
|---|---|---|
| `API_URL` | the API service's URL | Server-side only. The proxy resolves the backend at runtime. |
| `PUBLIC_READ_API_KEY` | a key with public read only | What the proxy attaches to allowlisted public GET paths. Falls back to `API_KEY` if unset, which the allowlist makes safe, but a dedicated key is better. |
| `NEXT_PUBLIC_API_URL` | the API service's URL | Build variable, used for server-side rendering only. |

Do **not** set `NEXT_PUBLIC_API_KEY`. Next compiles `NEXT_PUBLIC_*` variables
into the bundle it serves to every visitor. `scripts/check_no_client_secrets.py`
fails the build if you do.

## Step 4, deploy and verify

Redeploy the API service, then the dashboard.

```bash
curl -s https://<api-host>/api/v1/health | jq
```

**verify** Expect `{"status":"ok","db":"connected","vault":"connected"}`. A 503
with `"db":"disconnected"` means step 2 is not done.

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://artgene-archive.org/api/proxy/register
```

**verify** Expect `401`. A `201` or `422` means the proxy is still lending its
key to anonymous callers, so the fixed dashboard is not deployed.

```bash
curl -s "https://artgene-archive.org/api/proxy/certificates/?limit=5" | jq '.count'
```

**verify** Expect `0` on a fresh database. This path is on the allowlist, so it
works without a caller key.

Then open `https://artgene-archive.org/registry` in a browser, not curl, because
the page is client rendered. **verify** Expect "The registry holds no records
yet", and no `AG-DEMO-*` rows. Ten fabricated records attributed to real named
institutions used to appear here whenever the API was unreachable.

## Step 5, the first deposit (you)

`packages/tinsel-demo/sequences/01_glp1_pass.fasta` should become
`AG-2026-000001`: a first-party certificate on your own sequence, deposited
before any catalogue record exists. `tasks.md` lists obtaining a live
verifiable AG-ID as fatal for the paper.

```bash
curl -s -X POST https://<api-host>/api/v1/register \
  -H "X-API-Key: $ARTGENE_API_KEY" \
  -H "Content-Type: application/json" \
  -d @- <<'JSON' | jq
{
  "fasta": "<contents of 01_glp1_pass.fasta>",
  "owner_id": "<your institution>",
  "ethics_code": "<your approval code>",
  "host_organism": "ECOLI",
  "visibility": "public"
}
JSON
```

**verify** Expect `"status": "CERTIFIED"` and `"registry_id": "AG-2026-000001"`,
then that the record resolves at `https://artgene-archive.org/sequences/AG-2026-000001`
in a browser with no API key, since published records are now publicly readable.

Afterwards, `tasks.md` requires replacing every placeholder `AG-2026-000001` in
the paper and the showcase page with the real value, and regenerating the
certificate hash in Figure 2. That hash will differ from any earlier draft of
the figure, because the hashing scheme changed: the old one joined field values
with no delimiter, so distinct field sets could collide.

## Step 6, after the first green deploy

- Turn on GitHub secret scanning and push protection. Free for public repos,
  and only you can flip it.
- Set up a backup schedule, and run one restore to prove it works.
- Add an uptime check on `/api/v1/health` that notifies a person. This outage
  lasted months, and the service was already reporting itself degraded.

## Rollback

Redeploy the previous deployment from the Railway UI. The migrations in this
release are additive: `008` adds a column, `009` adds a table, and both have
tested `downgrade()` functions. To roll the schema back as well:

```bash
cd packages/tinsel-api && alembic downgrade 007
```
