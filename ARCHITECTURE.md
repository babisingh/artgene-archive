# ArtGene Archive: ingest architecture and security design

Status: proposed, 2026-11-12. Nothing in here is built yet.

This document covers what the archive needs in order to hold records of
AI designed sequences published by other groups, alongside the first party
certificates it already issues, and to do so with a defensible security and
licensing posture. It replaces `context.md` and `MIGRATION.md`, which were
working notes from the UI migration and have been removed.

## Decisions taken

| # | Decision | Consequence |
|---|---|---|
| 1 | Two record classes, two accession prefixes | `AG-YYYY-NNNNNN` for first party certificates, `AGC-YYYY-NNNNNN` for catalogued third party work. A bare id tells the reader which kind of claim it is. |
| 2 | Host only what the license permits | Sequence data is stored when its license allows redistribution, and recorded as accession plus checksum otherwise. The decision is enforced in the database, not in application code. |
| 3 | Closed service accounts | Only the operator and the Genome Watch agent can write, through separately scoped keys. The agent can draft; it cannot publish or revoke. |
| 4 | Stay on Railway for now | Restore the existing deployment, then harden. A move to managed Postgres with point in time recovery is Phase 6, not a blocker for the paper. |

## 1. What the archive is

Two different claims live here, and the whole design follows from keeping them
apart.

**A certificate** says: this depositor registered this sequence, accepted an
ethics declaration for it, passed the biosafety gates, and the registry signed
the result. It is a provenance claim about an object the depositor made.

**A catalogue record** says: this paper, by these authors, under this license,
reported these AI generated sequences, and the archive read it and recorded what
it found. It is a bibliographic and factual claim about someone else's work. The
archive signs nothing on their behalf, asserts no ethics approval, and claims no
provenance.

Conflating the two would destroy the only property that makes a registry worth
citing. Hence separate prefixes, separate tables, separate lifecycles, and a
shared identity space so that one registry page can list both.

## 2. Current state, honestly

What is sound: CORS is restricted and never wildcarded with credentials, the
production spreading key is guarded against the dev default, `ruff`, `mypy` and
`bandit` run in CI, errors are structured and logged, the audit log is append
only at the database level through a trigger installed by migration `003`, and
`/health` already returns 503 when the database is unreachable. W-OTS+ keypairs
derive deterministically from `HMAC-SHA3-256(master_seed, "wots:{tag}:event:{nonce}")`
with the one time invariant documented, and only `register.py` signs.

What is broken or missing:

1. **Credential handling in the dashboard, now fixed.** Two independent
   weaknesses in how the dashboard handled its API key were found and corrected
   on this branch: the server-side proxy attached a credential too broadly, and
   the client could read one from a build-time variable. Both are closed here,
   and `scripts/check_no_client_secrets.py` runs in CI as a regression guard, so
   either class of mistake now fails the build rather than reaching a
   deployment.

   The specifics are deliberately not written out while the fixed build has yet
   to reach production. They are in the commit history on this branch for a
   reviewer, and the guard script documents the shape of both by testing for
   them. Once the fixed dashboard and API are deployed, this entry can be
   expanded into the full post mortem it deserves.

   One related change belongs in the same phase and is a design fault rather
   than a weakness: `get_certificate` returns 404 unless the caller's
   organisation owns the record, which conflates "may know this record exists"
   with "may read its sequence". A published record should be visible to any
   caller, with `watermark_metadata` restricted to the owning organisation.
2. **The API service is down.** `artgene-archive.org` serves the dashboard, but
   every proxied call returns 500 and `/registry` renders its error state. See
   `DEPLOY.md` for the diagnosis and the ordered runbook. This is the only item
   here that still blocks everything else, and it is the one thing on this list
   that code on this branch cannot fix by itself.
3. **No home for catalogue metadata.** *Fixed, migration 010.* The deposit
   endpoint accepted five fields and had nowhere to put a DOI, an author, a
   licence, a model, an assay or an accession. The catalogue schema adds all of
   them, as typed tables rather than a JSON blob.
4. **Nothing represents a license.** *Fixed, migrations 010 and 013.*
   Redistribution is now a recorded decision, with `license_resolution`
   separated from `hosting_decision`, enforced by a database trigger rather
   than by application code, and `UNSTATED` seeded as non permissive.
5. **A failing sequence leaves no record.** *Fixed.* A `restricted` state keeps
   the citation when screening withholds the sequence, which is right for a
   catalogue: the paper exists whether or not the archive likes the sequence.
6. **Nucleotide handling is a placeholder.** *Fixed.* Nucleotide submissions are
   classified and routed rather than run through the protein gates as a string,
   with six frame ORF screening where there is no single reading frame, and a
   screen that cannot complete degrades to a warning instead of a pass.
7. **One shared, unscoped, non expiring API key.** *Fixed, migration 012.* Keys
   now carry explicit scopes, a description and an optional expiry, and the
   deposit agent holds a key that cannot publish.
8. **`_next_seq_num` used `count(*) + 1`.** *Fixed, migration 009.* Sequence
   numbers are allocated from a counter row under `SELECT ... FOR UPDATE`, so
   concurrent registrations no longer compute the same number. Contiguity is
   what makes the hash chain auditable: a gap is indistinguishable from a
   removed entry.
9. **`HybridCertificate.compute_hash` concatenated field values without
   delimiters.** *Fixed, migration 008.* Ambiguous field boundaries meant
   distinct field sets could hash identically, which for a certificate hash is
   a genuine integrity weakness. Hashing is now versioned by scheme id with
   domain separation, and existing rows are backfilled with the original scheme
   so their digests stay verifiable.
10. **No database role separation.** *Outstanding.* The API connects as the
    table owner, which can drop the append only trigger that protects the audit
    log. Tracked in `CHECKLIST.md`.

Most of this list is now marked fixed because this branch fixed it. The entries
are kept rather than deleted: a registry asks to be trusted, and the useful
evidence for that is a legible record of what was wrong and when it was put
right, not a clean page.

One piece of good luck runs through all of it: the registry holds zero records
and has never issued a live AG-ID, so restructuring costs nothing today. Once a
paper cites an AG-ID the same changes would mean migrating signed, cited
objects.

## 3. Identity and access

Replace the single shared key with scoped keys on the existing `api_keys` table.

```sql
ALTER TABLE api_keys
    ADD COLUMN scopes      text[] NOT NULL DEFAULT '{}',
    ADD COLUMN expires_at  timestamptz,
    ADD COLUMN created_by  text,
    ADD COLUMN description text;
```

| Scope | Granted to | Allows |
|---|---|---|
| `read:public` | the dashboard proxy | GET on published records only |
| `read:embargoed` | operator | GET on the owning organisation's unpublished records |
| `catalogue:draft` | Genome Watch agent | create and update catalogue records in `draft` |
| `catalogue:publish` | operator only | move a record to `published` |
| `registry:deposit` | operator, partner labs later | `POST /register` |
| `registry:revoke` | operator only | revoke a certificate |
| `admin` | operator only | key issuance, takedowns |

Three rules follow:

1. **The browser never holds a write capable key.** The proxy carries a
   `read:public` key and nothing else, and forwards only allowlisted GET paths.
   Everything else returns 401 and requires the caller's own key.
2. **The agent cannot publish.** It drafts; a human moves a record to
   `published`. This is the editorial control, expressed as a permission rather
   than as a convention.
3. **Every write records the key id** that authorised it, so the audit log
   answers "who" and not only "what".

Keys are high entropy random tokens, stored as `SHA3-256` hashes, looked up by
hash equality. A slow KDF is not needed and would be a cost on every request.
Rotation works by issuing a new key, overlapping validity, then setting
`revoked_at`; `require_api_key` already honours revocation.

## 4. Data model

A thin shared identity table, two class tables, and typed satellites. This is
class table inheritance, and it lets every satellite carry one foreign key
instead of two nullable ones.

```sql
-- The accession namespace. One row per record of either class.
CREATE TABLE records (
    id           text PRIMARY KEY,
    record_class text NOT NULL CHECK (record_class IN ('certificate','catalogue')),
    created_at   timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT prefix_matches_class CHECK (
        (record_class = 'certificate' AND id LIKE 'AG-%') OR
        (record_class = 'catalogue'   AND id LIKE 'AGC-%')
    )
);
```

`AGC-2026-000001` does not match `AG-%`, so the constraint is exact. Accession
numbers come from a Postgres sequence per class, not from `count(*)`.

```sql
-- Controlled vocabulary. SPDX identifiers where one exists.
-- 'UNSTATED' is a first class value with allows_redistribution = false:
-- an unstated license is not a permissive one.
CREATE TABLE licenses (
    spdx_id               text PRIMARY KEY,
    name                  text NOT NULL,
    url                   text,
    allows_redistribution boolean NOT NULL,
    allows_derivatives    boolean NOT NULL,
    allows_commercial     boolean NOT NULL,
    requires_attribution  boolean NOT NULL,
    notes                 text
);

-- One row per publication. The DOI is the canonical key when there is one.
CREATE TABLE sources (
    id               uuid PRIMARY KEY,
    doi              text UNIQUE,
    title            text NOT NULL,
    container        text,                 -- journal or preprint server
    published_on     date,
    peer_reviewed    boolean NOT NULL,
    version          text,                 -- 'v1' for a preprint
    url              text NOT NULL,
    article_license  text REFERENCES licenses(spdx_id),
    data_license     text REFERENCES licenses(spdx_id),
    retrieved_at     timestamptz NOT NULL,
    retrieved_from   text NOT NULL,        -- the exact URL read
    content_sha3_256 text                  -- hash of what was read, so later revision is detectable
);

-- Ordered, because author position carries meaning.
CREATE TABLE source_authors (
    source_id        uuid REFERENCES sources(id) ON DELETE CASCADE,
    position         smallint NOT NULL,
    full_name        text NOT NULL,
    orcid            text,
    affiliation      text,
    is_corresponding boolean NOT NULL DEFAULT false,
    PRIMARY KEY (source_id, position)
);

CREATE TABLE catalogue_records (
    id               text PRIMARY KEY REFERENCES records(id),
    source_id        uuid NOT NULL REFERENCES sources(id),
    title            text NOT NULL,
    molecule_type    text NOT NULL,   -- protein | dna | rna | genome
    status           text NOT NULL,   -- draft|staged|reviewed|published|restricted|withdrawn
    visibility       text NOT NULL DEFAULT 'private',
    hosting_decision text NOT NULL,   -- hosted | metadata_only | withheld
    hosting_reason   text NOT NULL,
    biosafety_class  text NOT NULL,   -- none | elevated | restricted
    ingest_run_id    uuid REFERENCES ingest_runs(id),
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),
    published_at     timestamptz
);

-- Shared by both classes, which is why it keys on records(id).
CREATE TABLE design_metadata (
    record_id          text PRIMARY KEY REFERENCES records(id),
    generating_model   text NOT NULL,
    model_version      text,
    model_availability text,          -- open | api | closed | not stated
    design_method      text,
    design_target      text,
    n_designed         integer,
    n_tested           integer,
    n_functional       integer,
    assays             text[] NOT NULL DEFAULT '{}',
    expression_host    text,
    wet_lab_validated  boolean NOT NULL DEFAULT false
);

-- Where the authors put their data. A record can be useful with nothing else.
CREATE TABLE external_accessions (
    id          uuid PRIMARY KEY,
    record_id   text NOT NULL REFERENCES records(id),
    database    text NOT NULL,        -- pdb | genbank | uniprot | zenodo | figshare | other
    accession   text NOT NULL,
    url         text NOT NULL,
    resolved_at timestamptz,
    resolves    boolean,
    UNIQUE (record_id, database, accession)
);

-- Sequence data, present only when the license allows it.
CREATE TABLE sequence_blobs (
    id             uuid PRIMARY KEY,
    record_id      text NOT NULL REFERENCES records(id),
    accession_id   uuid REFERENCES external_accessions(id),
    molecule_type  text NOT NULL,
    length         integer NOT NULL,
    sha3_256       text NOT NULL,
    data           text,              -- NULL for a metadata only record
    license_spdx   text NOT NULL REFERENCES licenses(spdx_id),
    stored_because text NOT NULL,     -- the license decision, in words
    stored_at      timestamptz NOT NULL DEFAULT now()
);
```

The license gate is enforced by a trigger on `sequence_blobs`, not in Python, so
no future code path can store data the license does not cover:

```sql
CREATE FUNCTION enforce_license_gate() RETURNS TRIGGER AS $$
DECLARE ok boolean;
BEGIN
    IF NEW.data IS NULL THEN RETURN NEW; END IF;
    SELECT allows_redistribution INTO ok FROM licenses WHERE spdx_id = NEW.license_spdx;
    IF NOT COALESCE(ok, false) THEN
        RAISE EXCEPTION
            'license % does not permit redistribution: store accession and checksum only',
            NEW.license_spdx;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

Remaining tables:

```sql
-- Every gate answer, for both families, including failures. Auditable filter.
CREATE TABLE record_gate_results (
    id           uuid PRIMARY KEY,
    record_id    text NOT NULL REFERENCES records(id),
    gate_family  text NOT NULL,   -- editorial | biosafety | license | attribution | integrity
    gate_key     text NOT NULL,   -- '1'..'7' | 'alpha'..'delta' | 'redistribution' | ...
    outcome      text NOT NULL,   -- pass | fail | warn | skip | advisory
    detail       text,
    evaluated_at timestamptz NOT NULL DEFAULT now(),
    evaluated_by text NOT NULL    -- key id, 'agent:genome-watch', or 'human:<name>'
);

-- Provenance of the catalogue itself: which run, under which instructions.
CREATE TABLE ingest_runs (
    id                    uuid PRIMARY KEY,
    agent                 text NOT NULL,
    instructions_sha3_256 text,
    started_at            timestamptz NOT NULL,
    finished_at           timestamptz,
    candidates_seen       integer,
    records_created       integer,
    log_url               text
);

-- License complaints, privacy requests, biosafety concerns, factual corrections.
-- Records are withdrawn by status change. Rows are never hard deleted.
CREATE TABLE takedown_requests (
    id           uuid PRIMARY KEY,
    record_id    text REFERENCES records(id),
    kind         text NOT NULL,   -- license | privacy | biosafety | accuracy | other
    requested_by text,
    received_at  timestamptz NOT NULL,
    detail       text NOT NULL,
    outcome      text,            -- upheld | declined | partial
    action_taken text,
    resolved_at  timestamptz
);
```

`certificates` keeps its current shape, gains `id text REFERENCES records(id)`
and a `CHECK (id LIKE 'AG-%')`, and loses nothing. The export schema, the paper's
figure 2 and the showcase page are unaffected.

One read view serves the registry page and search:

```sql
CREATE VIEW registry_entries AS
SELECT r.id, r.record_class, ... FROM records r
LEFT JOIN certificates       c  ON c.id  = r.id
LEFT JOIN catalogue_records  cr ON cr.id = r.id
LEFT JOIN design_metadata    d  ON d.record_id = r.id;
```

## 5. Gates

Three gate families, with different authority. Keeping them distinct matters,
because they answer different questions and only one of them may block.

**Editorial gates 1 to 7** (Genome Watch, applies to catalogue records only):
generated, novel, built and tested, worked, read in the original, pushes a
boundary, safety. Gates 1 to 6 must pass for a record to exist at all. These are
judgements made by reading the paper, recorded with their reasoning.

**Biosafety gates α β γ δ** (existing `tinsel-gates`, applies to sequences):
structural confidence, off target homology, ecological risk, functional analogue.

**Ingest gates** (new, applies to catalogue records):

| Gate | Question | On failure |
|---|---|---|
| License | Is the data license known, and does it permit redistribution? | `metadata_only` |
| Attribution | Do we have authors, title, DOI, venue, date, license and link? | cannot leave `draft` |
| Integrity | Does the fetched sequence match its recorded checksum, and does the accession resolve? | `metadata_only`, flagged |
| Dedup | Already present by DOI, accession or sequence hash? | merge, do not duplicate |

The lifecycle:

```
candidate
  -> editorial gates 1..6 pass            -> draft
  -> attribution + license + dedup gates  -> staged
  -> biosafety classification (advisory)  -> reviewed
  -> human approval                       -> published
                                          -> restricted   (metadata kept, sequence withheld)
                                          -> withdrawn    (takedown, reason recorded)
```

**For catalogue records the biosafety gates are advisory, never blocking.** A
sequence that fails screening yields `restricted`: the record and its citation
survive, the data does not. This is the opposite of the certificate path, where a
failure must refuse the deposit, and it is deliberate. An archive that silently
omits the results most relevant to biosecurity is worse than useless, because its
absence of coverage looks like an absence of risk.

Two rules no code path may bend: nothing classed `restricted` is ever stored or
served as sequence data, whatever its license, and nothing is hard deleted.

## 6. Integrity

1. **Canonical hashing.** Replace the delimiter free concatenation in
   `HybridCertificate.compute_hash` with RFC 8785 JSON canonicalization, or
   length prefixed fields. Version the scheme in the certificate so old hashes
   stay verifiable.
2. **Accession allocation.** Postgres sequences per class, and a transaction
   advisory lock around the audit chain append, replacing `count(*) + 1`.
3. **Transparency checkpoints.** The audit log is hash chained and the trigger
   from `003` blocks mutation, but anyone with database owner rights can drop a
   trigger. Publish the chain head daily to somewhere the API cannot write:
   a commit in a separate repository is enough, and costs nothing. This is the
   Certificate Transparency pattern, reduced to its useful minimum, and it is the
   difference between "we promise we did not edit it" and "you can check".
4. **Database roles.** The API role gets `SELECT, INSERT, UPDATE` on data tables,
   `INSERT` only on `registry_audit_log`, and no `DELETE` anywhere. Migrations run
   as a separate owner role. This is what makes control 3 meaningful.

## 7. Security controls

| Control | Why it matters here | Where |
|---|---|---|
| Proxy path allowlist, read only key | closes the live authentication bypass | `app/api/proxy` |
| Scoped, expiring API keys | the agent must not be able to publish or revoke | `api_keys`, `dependencies.py` |
| Database roles, no `DELETE` | an archive should be structurally incapable of losing a record | migration |
| Append only audit log plus trigger | already present, keep and extend to both classes | `003`, new migration |
| External chain checkpoints | detects tampering by someone who controls the database | ops |
| Canonical certificate hashing | removes field boundary ambiguity | `tinsel-core` |
| License gate in the database | no code path can store data the license forbids | trigger |
| Request size caps per endpoint | sequence payloads are an easy memory exhaustion vector | middleware |
| Hard limits on demo endpoints | `/analyse` calls ESMFold and BLAST, so abuse costs third parties, not just us | `rate_limit.py` |
| Fragment oracle limits | repeated probing of the k-mer index can map archived sequences | `register.py` |
| Security headers, HSTS, CSP | standard, currently absent | dashboard and API |
| `/docs` and `/redoc` behind a key in production | do not advertise the full surface | `main.py` |
| Structured logs with request ids, no secrets | the spreading key must never reach a log line | `main.py` |
| `pip-audit` and Dependabot in CI | `ruff`, `mypy`, `bandit` are there; dependency CVEs are not covered | CI |
| Migration tests against real Postgres | SQLite tests cannot exercise JSONB, triggers or constraints | CI service container |
| Daily backups plus a restore test | an archive with an untested restore is not an archive | ops |

The fragment oracle deserves a note. `_check_fragment_assembly_risk` tells a
caller that their sequence, combined with something already archived, assembles
into a screened failure. It carefully does not say which record, but it is still
an oracle, and iterative probing narrows the archived content. Mitigations: keep
the per key write limits low, log and alert on repeated 422s from one key, and
treat it as a review trigger rather than an immediate hard rejection.

## 8. Privacy, licensing and author enquiry

The archive processes personal data: author names, ORCIDs and affiliations.
Operating from the EU, that needs a stated basis and a route for complaints.

- **Lawful basis**: legitimate interest in scholarly attribution, Article 6(1)(f),
  with a short documented balancing test. Attribution is also a charter promise,
  which strengthens the case.
- **Data minimisation**: authors, ORCID, affiliation and corresponding status.
  Nothing else. `sequence_distributions.recipient_email` should stay optional and
  be purged when a distribution is revoked.
- **Rectification and erasure**: through `takedown_requests`, with a published
  contact address and a recorded outcome. Author names in a citation are
  ordinarily not erasable without defeating attribution, so expect correction
  rather than removal, and record the reasoning either way.
- **Privacy notice**: a short page saying what is collected, why, and how to
  object.

On licensing, three separate things, kept separate:

1. **The source article's license** governs quoting and summarising. Summaries
   are the archive's own writing, so this mostly constrains verbatim text.
2. **The source data's license** governs whether sequence data may be rehosted.
   It is frequently different from the article's, and frequently unstated. The
   CheMoDesign paper is the typical case: a CC-BY-NC-ND article with no data
   license, and no deposited constructs. Unstated means `metadata_only`.
3. **The archive's own output.** The structured metadata and summaries the archive
   creates can be CC-BY-4.0, as the charter says. The collection itself attracts
   the EU database right, so state the collection license explicitly. Hosted third
   party data keeps its original license, displayed per record. Never relicense
   someone else's data.

For CC-BY compliance the record page must render author list, title, source link,
license name with link, and an indication of whether anything was modified. That
is a required component, not a nicety, and it is the same component that makes
the attribution gate testable.

### Resolving an unstated license

An unstated license is the commonest case and the most wasteful one, because the
data may well be shareable and nobody has been asked. So `UNSTATED` raises a flag
and opens an enquiry rather than closing the question.

Two columns on `catalogue_records`, kept deliberately separate, because they
answer different things:

- `hosting_decision`: what the archive does. `hosted`, `metadata_only`,
  `withheld`.
- `license_resolution`: how the archive knows. `stated_permissive`,
  `stated_restrictive`, `unstated`, `ambiguous`, `author_confirmed`,
  `author_declined`.

Only `unstated` and `ambiguous` are enquiry candidates. `stated_restrictive` is
settled: the authors have already answered, in their license, and asking again
would be pestering them to change their mind.

```sql
-- One enquiry per source, not per record: a paper with forty designs gets one
-- email. Opened automatically, sent by a human, never by an agent.
CREATE TABLE license_enquiries (
    id               uuid PRIMARY KEY,
    source_id        uuid NOT NULL REFERENCES sources(id),
    reason           text NOT NULL,   -- unstated | ambiguous | conflicting | no_data_deposited
    status           text NOT NULL,   -- queued | drafted | sent | reminded | replied | no_response | closed
    contact_name     text,
    contact_orcid    text,
    contact_email    text,            -- held only while the enquiry is open, then purged
    detected_at      timestamptz NOT NULL DEFAULT now(),
    sent_at          timestamptz,
    reminded_at      timestamptz,
    replied_at       timestamptz,
    response_license text REFERENCES licenses(spdx_id),
    response_note    text,
    response_evidence text,           -- how we know, e.g. 'email of 2026-11-20, quoted verbatim'
    opt_in           boolean,         -- did they want the sequences included
    closed_at        timestamptz,
    UNIQUE (source_id)
);

-- Survives record withdrawal and enquiry purging. Keyed on ORCID where there is
-- one, otherwise on a peppered hash of the address, so suppression works without
-- retaining the address itself.
CREATE TABLE do_not_contact (
    id          uuid PRIMARY KEY,
    orcid       text UNIQUE,
    email_hmac  text UNIQUE,
    reason      text NOT NULL,
    recorded_at timestamptz NOT NULL DEFAULT now()
);
```

When an author answers, their reply becomes the permission the archive cites.
`sequence_blobs.stored_because` records it in words, for example
`enquiry 4f2a, corresponding author confirmed CC-BY-4.0 by email of 2026-11-20`,
so every hosted byte traces to a specific statement by a specific person.
`license_resolution` moves to `author_confirmed`, the license on `sources` is
updated, and the hosting decision is re-evaluated. An author who declines moves
the record to `author_declined`, which is permanent and suppresses future
enquiries.

Four rules, in descending order of how much they matter:

1. **No agent ever sends an email.** The pipeline detects, queues and drafts. A
   human reads the draft and sends it from their own mail client. This is not a
   configuration setting; there is no send path in the codebase to disable.
2. **Never enquire about a record whose `biosafety_class` is `elevated` or
   `restricted`.** Writing to a group to ask for a hazardous sequence under a
   friendlier license is the wrong letter to send, and the archive would not host
   the answer anyway.
3. **One enquiry per paper, one reminder, then stop.** `UNIQUE (source_id)` makes
   the first mechanical. The second is a matter of discipline, and the schema
   records `reminded_at` so it is visible when it slips.
4. **Declining never costs the authors their citation, and never costs the index
   its coverage.** An objection reduces a record to a bare citation: title,
   authors, DOI, link. That is what any literature review contains, so there is
   nothing to object to, and the archive does not become a biased sample of
   agreeable laboratories. Full removal stays available for a legal or privacy
   claim through `takedown_requests`.

On the lawful basis for the enquiry itself: writing to a corresponding author
about their own published paper, at the address they published for
correspondence, is ordinary scholarly contact under Article 6(1)(f). It stays
that way only while the volume stays low and the letter stays specific. One
paper a day, one email per paper, no follow up marketing. The address is held
while the enquiry is open and purged when it closes; the name and ORCID stay,
because attribution needs them regardless.

The draft letter says what was recorded, what was not copied, and how to say no:

```
Subject: ArtGene Archive record for <short title>

Dear <name>,

I am writing about <title>, <venue>, <date>.

ArtGene Archive is a public index of AI designed protein and nucleic acid
sequences that have been built and tested in a laboratory. Your paper is
recorded as <AGC-id>, crediting you and your co-authors, with a link to the
original. We have not copied your sequence data: the paper states no license
for it, so the record holds accessions, lengths and checksums only.

Two questions, if you have a moment.

1. Under what license may the designed sequences from this work be
   redistributed? If the answer is that they may not, the record stays as it
   is, metadata only.
2. Would you like the sequences themselves included? A deposited record keeps
   your attribution and a permanent identifier, under whichever license you
   choose, and you can ask for it to be withdrawn at any time.

If you would rather not be involved, reply saying so and the record will be
reduced to a plain citation, title, authors and a link, and you will not be
contacted again.

<sender>
ArtGene Archive, artgene-archive.org
```

## 9. Phases

**Phase 0, restore and stop the bleeding.** No schema work.

The outage diagnosis: `start.sh` exits non zero if Postgres is unreachable after
ten attempts, `/api/v1/health` returns 503 when the database is down, and
`railway.json` sets `healthcheckPath` to it with `restartPolicyMaxRetries: 10`.
So a database that went away would crash loop the API service ten times and then
stay down, which is exactly what the symptoms show: dashboard up, every proxied
call 500. Since the registry is empty, there is nothing to recover.

Checklist, in the Railway dashboard:

1. API service, Deployments, latest, logs. Expect `DB not ready`,
   `Database not reachable after 10 attempts`, or a pydantic validation error
   naming `SPREADING_KEY`.
2. Confirm the Postgres plugin still exists and is linked to the API service, so
   `DATABASE_URL` is injected.
3. On the API service confirm `SPREADING_KEY` (64 hex characters),
   `SPREADING_KEY_ID`, `SENTINEL_ENV=production`, and
   `ALLOWED_ORIGINS=https://artgene-archive.org`.
4. On the dashboard service confirm `API_URL` points at the API service and
   `NEXT_PUBLIC_API_URL` is set as a build variable.
5. Redeploy the API, then `curl https://<api-host>/api/v1/health` and expect
   `{"status":"ok"}`.

In parallel, in code: the proxy allowlist and read only key, request size caps,
security headers, and `/docs` gated in production.

Done when: `/api/v1/health` returns ok, `/registry` renders, and an anonymous
`POST` through the proxy returns 401.

**Phase 1, integrity and hardening.** Canonical hashing with a version field,
accession sequences and the advisory lock, database roles, `pip-audit`,
Dependabot, a CI job running migrations against a real Postgres service
container, backups with a restore test, chain checkpoints.

Done when: migrations apply cleanly to an empty Postgres in CI, the API role
cannot `DELETE`, and a restore has been performed once from a real backup.

**Phase 2, the catalogue schema.** Migration `010` (`008` and `009` are now the hash scheme column and the counter table): `records`, `licenses` seeded
with the common SPDX set, `sources`, `source_authors`, `catalogue_records`,
`design_metadata`, `external_accessions`, `sequence_blobs` with the license
trigger, `record_gate_results`, `ingest_runs`, `takedown_requests`, the
`registry_entries` view, and the backfill of `certificates` into `records`.

Done when: a catalogue record can be created, moved through the lifecycle and
published by SQL alone, and the license trigger refuses a non redistributable
blob in a test.

**Phase 3, the ingest API.** `POST /api/v1/catalogue` and the state transitions,
each scope enforced, each gate answer persisted. Nucleotide handling: translate
before gate α or route nucleotide records to a different screen, and raise the
length cap for them.

Done when: the CheMoDesign record can be created end to end from its draft front
matter, lands as `metadata_only` with a recorded reason, and a designed genome of
40 kb is accepted.

**Phase 4, the UI.** Wire the fields the dashboard already collects and already
renders as empty states: abstract, authors, ORCID, keywords, license, model,
method. Add the attribution block, the record class badge, and the restricted
state. Registry search by model, DOI and author.

**Phase 5, the Genome Watch connector.** Replay a reviewed draft into the ingest
API using a `catalogue:draft` key. The agent's `archive:`, `credit:` and
`sources:` blocks are already a superset of what Phase 2 asks for.

**Phase 6, infrastructure.** Managed Postgres with point in time recovery,
secrets in a real manager through the existing `vault/` abstraction, uptime
alerting that pages a human.

## 10. Open questions

1. **Partner labs.** Decision 3 closes writes for now. When labs are invited,
   identity becomes ORCID based and moderation becomes necessary. Worth designing
   the key scopes with that in mind, which this document does, and deferring the
   rest.
2. **The first AG-ID.** `01_glp1_pass.fasta` should be `AG-2026-000001`, a first
   party certificate, deposited before any catalogue record exists. `tasks.md`
   lists this as fatal for the paper.
3. **Preprint versioning.** A preprint that becomes a peer reviewed paper is the
   same work with a new DOI. Proposal: one `sources` row per version, linked, and
   one catalogue record that points at the newest, so the citation updates without
   duplicating the record.
4. **Whether `certificates` should be renamed.** It now holds one of two record
   classes. Renaming is free today and awkward later, but it touches the export
   schema and the paper.
