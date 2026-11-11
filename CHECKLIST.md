# ArtGene Archive: product readiness

Status at 2026-11-12. Checked items have evidence named beside them. Unchecked
items are not done, and a few are called out as deliberately deferred rather
than forgotten.

Companion documents: `ARCHITECTURE.md` for the design and the phase plan,
`DEPLOY.md` for the runbook that restores and ships the service.

## What this is, in one paragraph

A registry of AI designed protein and nucleic acid sequences, holding two kinds
of record that are never conflated. An `AG-` certificate says a depositor
registered a sequence they made, accepted an ethics declaration, passed the
biosafety gates, and the registry signed the result. An `AGC-` catalogue record
says a published paper reported AI generated sequences that were built and
tested, and the archive read it and recorded what it found, with attribution and
a license decision. The second kind is fed daily by the Genome Watch agent.

## The daily loop, end to end

1. **06:47 Europe/Madrid.** The Genome Watch agent wakes in its own private
   repository, reads `AGENT_INSTRUCTIONS.md` and `state/seen.json`, and looks
   back two days.
2. **Pass one** gathers candidates from arXiv, bioRxiv, medRxiv, PubMed and the
   Nature, Science and Cell families.
3. **Pass two** opens each candidate and answers seven gates in writing:
   generated, novel, built and tested, worked, read in the original, pushes a
   boundary, safety. Gates 1 to 6 must all pass. At most one item per day, and
   most days none.
4. The agent writes a draft, stages any deposited sequences into
   `staging/<date>-<slug>/` with a manifest, validates with
   `tools/check_draft.py`, commits, and opens one private issue.
5. **A person reads it.** Babita edits the draft and pastes it into the Genome
   Watch section of her Substack herself. Nothing is ever published or emailed
   on her behalf; there is no send path in the code.
6. Once the catalogue ingest exists, a reviewed draft is replayed into this
   archive as an `AGC-` record in `draft` status, using a key scoped to
   `catalogue:draft`. Only a person can move it to `published`.

The agent cannot publish, in either system. That is a permission, not a
convention.

## Security

- [x] **Dashboard proxy no longer lends its key to anonymous callers.** It
      attaches a server key only to an allowlist of public GET paths, and
      forwards a caller key untouched otherwise. Was reachable by anyone for
      `POST /register` and `POST /certificates/{id}/revoke`.
- [x] **No key is read on the client.** `NEXT_PUBLIC_API_KEY` is gone from
      `providers.tsx` and from the record page copy that told operators to set
      it. Next inlines such variables into the bundle at build time.
- [x] **Verified no key is currently public.** Every script chunk referenced by
      six pages of the live site was downloaded and scanned; the bundle holds
      the variable as a runtime property read, which proves it was never set at
      build time. Full git history across all branches holds no committed
      `.env` and no production key.
- [x] **Regression guard in CI.** `scripts/check_no_client_secrets.py`, four
      checks, run standalone and again inside the dashboard build where the
      build environment is visible. Tested against a fixture reproducing both
      original defects.
- [x] **Development mode cannot reach a real database.** `SENTINEL_ENV`
      defaulted to `development`, which runs mock biosafety gates and seeded an
      organisation whose key was a constant in this public repository. The
      settings validator now refuses development against a non-local database,
      verified across ten `DATABASE_URL` shapes, and `start.sh` refuses to boot
      with the variable unset.
- [x] **No credential constant in the repository.** `seed_dev.py` generates a
      key or takes `ARTGENE_DEV_API_KEY`, and refuses to run outside local
      development.
- [x] **Published records readable without a key; sequences are not.**
      `GET /certificates/{id}` serves a published record to any authenticated
      caller and withholds `watermark_metadata.original_protein` from everyone
      but the owner. Embargoed records answer 404, not 403.
- [ ] **Scoped API keys.** `api_keys` still has no `scopes`, `expires_at` or
      `created_by`. Needed before the agent gets a key of its own, because
      `catalogue:draft` is what stops it publishing. `ARCHITECTURE.md` section 3.
- [ ] **Database roles.** The API connects as the table owner, so it could drop
      the append-only trigger it relies on. Needs a role with no `DELETE` and
      `INSERT` only on `registry_audit_log`.
- [ ] **Security headers.** No HSTS, CSP, `X-Content-Type-Options` or
      `Referrer-Policy` on either service.
- [ ] **`/docs` and `/redoc` gated in production.** Currently public.
- [ ] **GitHub secret scanning and push protection.** Free for public repos, and
      a settings toggle only you can flip. It catches committed secrets, which
      the script above deliberately does not try to.
- [ ] **Rotate `ARTGENE_API_KEY`** on restore. The value never leaked, but the
      proxy made its authority public while the service was up.

## Data integrity

- [x] **Certificate hashing is unambiguous.** The old scheme joined field values
      with no delimiter, so `{"owner_id": "ab", "ethics_code": "c"}` and
      `{"owner_id": "a", "ethics_code": "bc"}` collide. That collision is now a
      passing test, with a pinned digest vector. Migration 008 records the
      scheme per row and backfills old rows as `concat-v1`.
- [x] **Accession numbers cannot race.** `count(*) + 1` replaced by a counter row
      under `SELECT ... FOR UPDATE`, which also makes the chain head read safe.
      A PostgreSQL sequence would be wrong here: values are consumed on
      rollback, and the chain needs contiguous numbers to be auditable.
- [x] **The append-only trigger is real.** Verified against PostgreSQL 16 for the
      first time: `UPDATE` and `DELETE` on `registry_audit_log` both raise.
- [x] **Migrations apply and round-trip.** All nine run on an empty PostgreSQL
      16, `downgrade 007` then `upgrade head` succeeds, and the counter reseeded
      correctly from an existing audit row.
- [x] **The public registry shows only real records.** The fallback that
      displayed ten fabricated `AG-DEMO-*` certificates attributed to ETH
      Zürich, the Broad Institute, Institut Pasteur, GSK Vaccines, Kyoto
      University, the Wyss Institute, UCSF, MIT and the Arc Institute, one of
      them revoked, is removed. An empty registry now says it is empty.
- [ ] **External chain checkpoints.** The chain is hash chained and trigger
      protected, but anyone with owner rights can drop a trigger. Publishing the
      chain head daily somewhere the API cannot write turns a promise into
      something checkable.

## Catalogue and ingest, Phase 2 and 3

- [ ] `records`, `sources`, `source_authors`, `licenses`, `catalogue_records`,
      `design_metadata`, `external_accessions`, `sequence_blobs`,
      `record_gate_results`, `ingest_runs`, `takedown_requests`, and the
      `registry_entries` view. Migration 010.
- [ ] License gate enforced by a database trigger, so no code path can store
      data a license does not cover. `UNSTATED` seeded as non redistributable.
- [ ] `license_enquiries` and `do_not_contact`, so an unstated license opens an
      author enquiry instead of closing the question.
- [ ] `POST /api/v1/catalogue` and the draft to published state machine.
- [ ] Nucleotide handling. `protein = sequence` for DNA means gate α runs
      ESMFold against a nucleotide string, and the 5,000 residue cap rejects any
      designed genome. This blocks the archive's headline subject.
- [ ] Metadata only records, for the common case where a paper deposits nothing.
- [ ] `restricted` state, so a sequence failing screening keeps its citation.

## Dashboard

- [x] Mock certificate fixtures removed, along with both fallbacks.
- [x] Record page works without a key for published records.
- [ ] Wire the fields the deposit form already collects and discards: sequence
      name, molecule type, generating model, design method, institution,
      abstract. The record page renders empty states for all of them.
- [ ] A key entry control. Deposits from the browser now need an operator key
      in `sessionStorage` and there is no UI to put one there, so deposits are
      currently a CLI action. That is arguably correct, and `DEPLOY.md` uses
      curl, but it should be a decision rather than an accident.

## CI

- [x] Migrations run against a real PostgreSQL 16 service container, and the
      last two are round-tripped.
- [x] `pip-audit` added, advisory, matching the existing `npm audit` step.
- [x] Client credential guard job.
- [x] Health tests fixed. They failed on `main` because `/health` reaches for
      the module-level session factory rather than the `get_db` dependency,
      deliberately, so that it can answer 503 when the pool is unreachable.
- [x] Rate limiter disabled under `SENTINEL_ENV=test`. Every test shares one key,
      so the write tier counted the whole suite as one client and the suite was
      one test away from flaking.
- [ ] **CI is still red on `main` for two pre-existing reasons.** `ruff` reports
      60 errors and `mypy` 49, none in any file touched so far. Not mass-fixed on
      purpose: `ruff --fix` would apply `N815` and rename `A_seed` in
      `LWECommitmentData`, which is serialised into every certificate. This wants
      its own careful pass.

## Operations

- [ ] Restore the API. See `DEPLOY.md`. It has been down since roughly
      2026-07 and the registry has never held a record.
- [ ] Backups with a tested restore. An archive whose restore has never been
      run is not an archive.
- [ ] Uptime check that pages a person. `/health` already returns 503 when the
      database is unreachable, so nothing new is needed on the service side.
      This outage lasted months unnoticed.
- [ ] Managed PostgreSQL with point in time recovery, `ARCHITECTURE.md` phase 6.

## Licensing and privacy

- [x] License policy settled: host only what the license permits, record the
      decision per record, treat unstated as non redistributable.
- [ ] Privacy notice, and a documented Article 6(1)(f) balancing test for
      holding author names, ORCIDs and affiliations.
- [ ] Attribution component on the record page: author list, title, source link,
      license name with link, and whether anything was modified. This is both the
      CC-BY requirement and what makes the attribution gate testable.
- [ ] Collection license stated, separately from per record licenses.

## Running it locally

```bash
# Python 3.12 workspace and the test suite, SQLite, no services needed
uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python -e "packages/tinsel-core[test]" \
  -e "packages/tinsel-gates[test]" -e "packages/tinsel-api[dev]" aiosqlite
SENTINEL_ENV=test .venv/bin/python -m pytest packages/ -q --import-mode=importlib
```

```bash
# A local PostgreSQL for migration work. Unix sockets are disabled because the
# scratch path exceeds the 103 byte sockaddr limit, and LC_ALL is set because
# the macOS postmaster goes multithreaded without a locale.
export LC_ALL=C LANG=C
PGBIN=/opt/homebrew/opt/postgresql@16/bin
$PGBIN/pg_ctl -D "$PGDATA" -l "$PGDATA/server.log" start
```

```bash
# Apply every migration to that instance
cd packages/tinsel-api
DATABASE_URL=postgresql://postgres@127.0.0.1:5433/artgene_test \
SENTINEL_ENV=production SPREADING_KEY=$(python -c "import secrets;print(secrets.token_hex(32))") \
  ../../.venv/bin/alembic upgrade head
```

```bash
# The guard that stops a credential reaching the browser
python3 scripts/check_no_client_secrets.py
```
