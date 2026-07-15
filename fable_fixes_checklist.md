# ArtGene-Archive — Fable Review & Fixes Checklist

> A phased, exhaustive code review of the ArtGene-Archive / TINSEL monorepo.
> Covers correctness bugs, security flaws, "spaghetti"/maintainability issues,
> and suggested features. Written to be actioned incrementally — nothing in this
> file changes the codebase; it is advisory only.

**Reviewer:** Fable (automated review) · **Started:** 2026-07-15
**Scope agreed:** Full stack (all Python packages + Next.js dashboard) · Exhaustive depth · One phase at a time.

## How to read this

Each finding has:

- **ID** — stable handle, e.g. `CORE-01`, for tracking/commits.
- **Severity** — 🔴 Critical · 🟠 High · 🟡 Medium · 🔵 Low · ⚪ Nit.
  Severity reflects *this codebase's stated purpose* (a security/biosafety
  registry), so crypto-correctness and safety-decision bugs rank higher than
  they would in a typical CRUD app.
- **Type** — `bug` · `security` · `spaghetti` · `docs` · `feature`.
- **Location** — file and symbol/line.
- **Finding** — what's wrong.
- **Fix** — recommended change.

Severity ≠ certainty. Where a finding is latent (real inconsistency, not
currently exploitable) it is marked *(latent)*.

## Phase plan

| Phase | Area | Status |
|---|---|---|
| 1 | `tinsel-core` (crypto, watermark, models, compliance, sequence) | ✅ Done |
| 2 | `tinsel-api` (routes, auth, vault, DB models + migrations, rate limiting) | ✅ Done |
| 3 | `tinsel-gates` (pipeline + 4 gate adapters) | ⏳ Pending |
| 4 | `tinsel-demo`, `scripts/`, infra (Docker, CI, pyproject, railway) | ⏳ Pending |
| 5 | `apps/dashboard` (Next.js/React + API proxy) | ⏳ Pending |
| 6 | Cross-cutting: architecture, test coverage, feature roadmap, prioritized summary | ⏳ Pending |

---

# Phase 1 — `tinsel-core`

Package: `packages/tinsel-core/tinsel/` (~4,271 lines). This is the cryptographic
and watermarking heart of the system, so it gets the most scrutiny.

## 1.1 Critical / High — Cryptographic correctness & integrity

### CORE-01 · 🔴 Critical · security · WOTS+ one-time keypair is reused across signing events
**Location:** `tinsel/crypto/__init__.py` → `PQSigner.sign_certificate()`; `tinsel/crypto/wots.py` → `generate_keypair()`

`wots.py` is emphatic (module docstring + `generate_keypair` docstring) that
WOTS+ is a **one-time** signature: each keypair MUST sign at most one message,
and every signing *event* on the same registry record must pass a distinct
`event_nonce`. But `PQSigner.sign_certificate()` calls:

```python
sk, pk_chains, pub_seed = _wots.generate_keypair(self._seed, registry_id)
```

with **no `event_nonce`** — so it always defaults to `0`. The derivation is
`event_seed = HMAC(master_seed, f"wots:{registry_id}:event:0")`. Therefore any
two signatures produced for the same `registry_id` (re-issuance, correction,
embargo lift, distribution copy — all scenarios the docstring explicitly
anticipates) reuse the **same private key**. Two WOTS+ signatures under one key
let an attacker forge signatures on a range of other messages (this is the
defining failure mode of one-time schemes). The API surface literally has no
way to pass a nonce, so the safe path is unreachable.

**Fix:** Thread `event_nonce` through `PQSigner.sign_certificate()` (and
`verify_certificate`, which must know the nonce or store the derived pubkey).
Source the nonce from a monotonic per-record counter (the audit-log `seq_num`
is a natural fit) or a per-event UUID, persist it on the certificate/event row,
and refuse to sign twice with the same `(registry_id, nonce)`. Add a regression
test that signs the same `registry_id` twice and asserts the keypairs differ.

### CORE-02 · 🟠 High · security/bug · Certificate hash uses ambiguous, order-dependent serialization
**Location:** `tinsel/registry.py` → `HybridCertificate.compute_hash()`

```python
payload = "".join(str(v) for v in fields.values()).encode("utf-8")
return hashlib.sha3_512(payload).hexdigest()
```

This is the hash that is ultimately WOTS-signed, so it is the integrity anchor
of the whole certificate. Two problems:

1. **No field separators / canonicalization** — concatenating `str(v)` with no
   delimiter means distinct field sets can collide, e.g. `{"a":"12","b":"3"}`
   and `{"a":"1","b":"23"}` both hash `"123"`. An attacker with control over any
   two adjacent string fields can shift a boundary and preserve the hash.
2. **Order/format dependence** — relies on `dict` insertion order and Python's
   `str()` formatting of datetimes/floats/nested dicts, which is unstable across
   versions and callers. Re-serializing the "same" certificate can change the
   hash and break verification.

**Fix:** Canonicalize before hashing — e.g. `json.dumps(fields, sort_keys=True,
separators=(",",":"), default=str)` (or a typed, versioned canonical encoder),
then hash. Pin a `hash_scheme` version field so future changes are detectable.

### CORE-03 · 🟡 Medium *(latent)* · bug · Watermark capacity is over-counted vs. the 1-bit-per-carrier channel
**Location:** `tinsel/watermark/encoder.py` → `watermark_capacity()`; `tinsel/watermark/tinsel_encoder.py` → `_embed_bits`/`_extract_bits`; `tinsel/registry.py` → `select_tier`

`watermark_capacity()` returns `Σ floor(log2(pool_size))` over synonymous
positions (2 bits for pools of size 4/6). But encoding/decoding only ever use
**one bit per carrier** (`pool.index(codon) % 2`, the LSB — see `_embed_bits`
and `_extract_bits`). So the reported "capacity" (and the value fed to
`select_tier`) overstates the *actually recoverable* channel by up to 2×.
`CapacityReport.n_carrier_positions` is even assigned this bit count, despite
its name meaning "positions." Today the tier thresholds carry enough slack
(e.g. FULL needs 1792 "capacity" ≈ ≥896 real carriers for a 256-bit codeword)
that codewords still fit, so it's latent — but it is a real semantic mismatch
that will bite anyone who tightens tiers or trusts the reported numbers, and it
contradicts `spreading.py`'s own claim that "capacity equals the number of
synonymous carrier positions."

**Fix:** Decide on one model. Either (a) make capacity == count of pool-≥2
positions (matches the 1-bit channel and the spreading docstring), fixing the
`n_carrier_positions` field to hold positions not bits; or (b) actually embed
`floor(log2(pool))` bits per position and update the extractor to match. (a) is
simpler and matches current embedding.

## 1.2 Medium — Correctness & safety-decision logic

### CORE-04 · 🟡 Medium · bug · Leap-day crash computing certificate validity window
**Location:** `tinsel/synthesis_auth.py` → `build_synthesis_auth_document()`

```python
until_dt = from_dt.replace(year=from_dt.year + 1)
```

If `from_dt` is 29 Feb, `replace(year=+1)` raises `ValueError: day is out of
range for month`. A certificate issued on a leap day cannot produce a Synthesis
Clearance Document — a hard failure on the safety-critical path.

**Fix:** Use `dateutil.relativedelta(years=1)` or clamp: add 365/366 days, or
catch and fall back to 28 Feb / 1 Mar per policy.

### CORE-05 · 🟡 Medium · security/bug · `gate_mode` defaults to `"real"`
**Location:** `tinsel/consequence.py` → `ConsequenceReport.gate_mode: str = "real"`

The field's own comment says certificates with `gate_mode="mock"` "carry no real
biosafety assurance." Yet the default is `"real"`. Any code path that builds a
`ConsequenceReport` and forgets to set `gate_mode` silently mislabels a
mock/stub run as a real biosafety screen — exactly the wrong fail direction for
a safety attestation. Downstream (`synthesis_auth`, `compliance`) reads this
field into regulatory documents.

**Fix:** Make `gate_mode` required (no default) so construction forces an
explicit choice, or default to `"mock"`/`"unknown"` so the unsafe value must be
opted into. Add a validator restricting it to a known set.

### CORE-06 · 🟡 Medium · docs/bug · Chi-squared p-value docstring contradicts the code (covertness semantics)
**Location:** `tinsel/watermark/tinsel_encoder.py` → `_chi2_p_value()`

The docstring says it "Returns `P(χ² ≤ chi2)`, i.e. the CDF," but the code
computes the **survival function** `0.5*erfc(z/√2)` = `P(χ² > chi2)` (upper
tail). The *usage* (`is_covert = p_value > 0.05`) is actually correct **because**
it's the upper tail — but the docstring states the opposite, so the next person
who "fixes" it to match the docs will invert the covertness flag and start
reporting biased watermarks as covert.

**Fix:** Correct the docstring to say survival function / upper-tail
`P(χ² > chi2)`. Optionally rename to `_chi2_sf` for clarity, and add a unit test
pinning `is_covert` behavior.

## 1.3 Medium/Low — "Spaghetti", dead code, duplication

### CORE-07 · 🟡 Medium · spaghetti · Two coexisting, incompatible watermark schemes behind one `encode()`
**Location:** `tinsel/watermark/encoder.py` (`encode`) vs `tinsel/watermark/tinsel_encoder.py` (`encode_v1`/`encode_legacy`/`encode` dispatcher)

There are two embedding algorithms: the legacy `encoder.encode()` selects
`pool[keystream % len(pool)]` (full-pool index from a key stream), while v1
`_embed_bits` selects by `bits[i] % len(pool)` (payload LSB) with PRNG fill.
`TINSELEncoder.encode()` silently dispatches between them based on whether
`signing_key` was passed to `__init__`. `*args/**kwargs` with runtime
`TypeError`s replaces real signatures. This is a frequent source of
"why doesn't my watermark verify" confusion and makes the public API
untype-checkable.

**Fix:** Split into two explicitly named public methods (`encode_v1` /
`encode_legacy`) with real signatures; deprecate the magic `encode()`
dispatcher, or at minimum type it with `@overload`. Consider dropping the legacy
scheme entirely if nothing depends on it (grep first).

### CORE-08 · 🔵 Low · spaghetti · Bottom-of-file monkey-patch constant `TIER_SPECS_MIN`
**Location:** `tinsel/watermark/tinsel_encoder.py` (last line) used inside `encode_v1`

`encode_v1` references `TIER_SPECS_MIN` in an error message, but the name is
defined at the very bottom of the module with the comment
`# Fix the missing reference in encode_v1`. It works only because module-level
names resolve at call time; it reads as an unreverted hotfix and would
`NameError` if that error path ran during import. The message it builds
(`minimum {TIER_SPECS_MIN} bits`) is also just the DEMO sig-bit count, not the
true rejection threshold, so it's misleading.

**Fix:** Define the constant near the other `TIER_*` tables (in `registry.py`),
import it, and use the correct threshold (`MINIMUM_CARRIERS_ABSOLUTE`) in the
message.

### CORE-09 · 🔵 Low · spaghetti/DRY · `_gate_summary()` duplicated verbatim
**Location:** `tinsel/compliance.py` and `tinsel/synthesis_auth.py`

Identical helper copy-pasted in two modules; same for the
`{"1":"BSL-1","2":"BSL-2","4":"BSL-4"}` risk-group→containment map and the
`risk_group = "4" if any_fail else "2" if any_warn else "1"` logic. Divergence
risk if one copy is edited.

**Fix:** Extract to a shared `tinsel/_gate_report.py` (or into
`consequence.py`) and import from both.

### CORE-10 · 🔵 Low · dead code/docs · Ed25519 "fallback" advertised but not implemented; unused imports
**Location:** `tinsel/crypto/__init__.py`

The module docstring describes a graceful Ed25519 fallback "when the
`cryptography` package is unavailable," and defines `ALGORITHM_ED25519`, but
`PQSigner` contains no fallback code path at all. `import hmac as _hmac` and
`import os` are unused. This is misleading documentation on a security module
(readers may believe a fallback exists).

**Fix:** Either implement the fallback or delete the claim, `ALGORITHM_ED25519`,
and the unused imports.

## 1.4 Low / Nit — Robustness & polish

### CORE-11 · 🔵 Low · bug · License string mismatch
**Location:** `tinsel/__init__.py` (`__license__ = "MIT"`) vs repo `LICENSE` (Apache-2.0) and README badge (Apache-2.0)

The package advertises MIT while the repository ships Apache-2.0. Legal/notice
inconsistency.

**Fix:** Set `__license__ = "Apache-2.0"` (and align `pyproject.toml`).

### CORE-12 · 🔵 Low · bug · WOTS+ verify leaks first-differing-chain via early return
**Location:** `tinsel/crypto/wots.py` → `verify()`

Per-chain compare uses `hmac.compare_digest` (good), but the loop returns
`False` on the first mismatching chain, leaking *which* chain differed via
timing. Minor for signatures, but trivially avoidable.

**Fix:** Accumulate an `ok &= compare_digest(...)` across all chains and return
once, or note explicitly why early-exit is acceptable.

### CORE-13 · ⚪ Nit · spaghetti · RS-codec GF table build leaks loop vars into module namespace
**Location:** `tinsel/watermark/rs_codec.py` (module-level `_x`, `_i` loops)

`_x`, `_i` remain bound at module scope after the tables are built. Harmless but
untidy; also `_GF_EXP`/`_GF_LOG` are mutable module globals.

**Fix:** Wrap table construction in a `def _build_gf_tables(): ...` returning the
tables.

### CORE-14 · ⚪ Nit · efficiency · Spreading code wastes 7/8 of each HMAC block
**Location:** `tinsel/watermark/spreading.py` → `generate()`; also `encoder._key_stream`

One chip per byte (LSB only) means 8× more HMAC invocations than necessary.
Fine at current sizes, but wasteful and inconsistent (`_key_stream` uses whole
bytes). Consider `np.unpackbits` to use all 8 bits per byte if throughput ever
matters.

### CORE-15 · ⚪ Nit · bug · `detect_type` misclassifies short proteins as DNA/RNA
**Location:** `tinsel/sequence/fasta.py` → `detect_type()`

A protein whose letters happen to be a subset of `ACGTN` (e.g. `"GATTACA"`) is
detected as DNA. Inherent ambiguity, but worth a length/heuristic guard or an
explicit `seq_type` override on the API.

### CORE-16 · ⚪ Nit · docs · `_msg_hash` comment says "truncate" but re-hashes
**Location:** `tinsel/crypto/__init__.py` → `_msg_hash()`

Comment: "We truncate by taking SHA3-256 of the full hash" — it isn't truncation,
it's a fresh SHA3-256 (which is fine and preferable). Reword to avoid confusion.

## 1.5 Notes carried forward

- The WOTS+ checksum encoding uses 3 chains where the top chain (`c0`) is always
  `0` (max checksum 8160 < 2^16). Harmless/degenerate but wastes a chain; not a
  vulnerability because the digit is constant across all messages. (No action
  required; noted for completeness.)
- `fragment.parse_multi_fasta` enforces `max_fragments` only *after* parsing the
  whole input and has no per-fragment length cap — revisit alongside API input
  limits in Phase 2 (DoS surface).
- `test_security_properties.py` exists (good signal). Test *coverage adequacy*
  (does it exercise CORE-01/02/03?) is deferred to Phase 6.

---

*End of Phase 1.*

---

# Phase 2 — `tinsel-api`

Package: `packages/tinsel-api/sentinel_api/` (~4,161 lines). FastAPI service:
routes, API-key auth, secrets vault, async SQLAlchemy models + Alembic
migrations, slowapi rate limiting, plus bootstrap scripts.

**What's solid (worth keeping):** proper API-key hashing (raw keys never stored),
consistent 404-for-wrong-org to avoid existence leaks, `X-API-Key` never
client-spoofable `org_id`, the DB-level append-only trigger (migration 003),
HMAC key separation for spreading vs signing keys, and env-gated production
guards on the spreading key. The findings below are what to fix on top of that.

## 2.1 High — Integrity, auth, and abuse surface

### API-01 · 🟠 High · security · WOTS+ signatures are never verified anywhere (write-only crypto)
**Location:** whole package; `grep` shows `PQSigner.verify_certificate` has zero call sites. `certificates.py` → `verify_certificate()` only runs the *watermark* decoder.

Registration signs the certificate hash with WOTS+, but **no endpoint ever
verifies that signature**, and none recomputes `certificate_hash` from the
stored fields. `POST /certificates/{id}/verify` verifies a codon watermark
(which isn't even embedded at registration — see API-10), not the PQ signature.
So the system's headline claim ("cryptographically verifiable creator
attribution," "tamper-evident") has **no verification path** in the API — the
crypto is write-only. A tampered `certificate_hash`/fields row would pass every
read endpoint. Ties directly to CORE-01/CORE-02.

**Fix:** Add a real verification endpoint that (a) recomputes the canonical
certificate hash from stored fields and (b) calls `PQSigner.verify_certificate`
against the stored public key/signature; expose it publicly for third-party
(synthesizer) verification. Fold it into `/compliance/verify` and `export`.

### API-02 · 🟠 High · bug/security · Audit-log hash chain is not concurrency-safe
**Location:** `routes/register.py` → `_next_seq_num()`, `_prev_entry_hash()`, `register_sequence()`

`seq_num` is `SELECT count(*)+1` and `prev_hash` is "hash of current tip," both
read without any lock, then written. Two concurrent registrations read the same
`count`/tip, compute the same `seq_num` and both chain off the same
`prev_hash`. The `unique(seq_num)` constraint means one commit wins and the
other 500s (lost registration, generic error), and the design leans entirely on
that constraint to prevent a forked chain — there is no serialization of the
append itself. Under real concurrency this is both a correctness risk and an
availability bug.

**Fix:** Serialize the append — use a Postgres `SEQUENCE` (or `pg_advisory_xact_lock`
on a chain key, or `SERIALIZABLE` isolation) and retry-on-conflict, so `seq_num`
and `prev_hash` are read-and-appended atomically. Compute `registry_id` from the
sequence value, not `count(*)`.

### API-03 · 🟠 High · security · Revoke/publish bypass the tamper-evident audit log
**Location:** `routes/certificates.py` → `revoke_certificate()`, `publish_certificate()`

The audit chain only records *issuance*. Revocation (a safety-critical state
change that blocks synthesis) and publish (a visibility change) mutate
`certificates` directly via the ORM and commit — **nothing is appended to
`registry_audit_log`**. So the "tamper-evident" trail cannot prove when/why a
certificate was revoked or made public, and a DB actor could revoke/un-revoke
invisibly. Compounded by the inert ORM guard (API-07).

**Fix:** Append a signed audit-log entry for every state transition
(issue / revoke / publish), chained the same way as issuance.

### API-04 · 🟠 High · security (DoS/cost) · Unauthenticated demo endpoints fan out to the vault and real external gates
**Location:** `routes/analyse.py` (`/analyse`, `/analyse/fragments`), `routes/structure.py` (`/analyse/structure`)

All three are unauthenticated. In production they: fetch keys from the vault
(AWS Secrets Manager — a paid, throttled API) on every call; call ESMFold Atlas
(external); and `/analyse/fragments` runs the consequence pipeline **once per
fragment (up to 50) plus once for the assembly** — up to 51 pipeline invocations
per request. The only protection is per-IP `10/minute`, and that limiter is
in-memory (see API-05), so it is trivially bypassed from multiple IPs or resets
per worker/Lambda. This is a cost- and resource-amplification DoS on the
unauthenticated surface.

**Fix:** Require auth (or a scoped demo token) for anything that hits the vault
or external services; cap `/analyse/fragments` fan-out; cache vault reads
(API-12); move to a shared rate-limit store (API-05); consider a hard global
concurrency cap on external calls.

## 2.2 Medium — Correctness, privacy, and consistency

### API-05 · 🟡 Medium · security · Rate limiting is in-memory and per-process
**Location:** `rate_limit.py` (`Limiter(key_func=_key_func)` — no `storage_uri`)

Default slowapi storage is in-process memory. The app ships **both** a uvicorn
entrypoint and a `Mangum` Lambda handler; under multiple workers or serverless
cold-starts each process keeps its own counters, so global limits (esp. the
20/min write limit protecting `/register`) don't hold. Also the key bucket is
the **raw API key string** (`f"key:{api_key}"`) — using a live secret as a
cache key.

**Fix:** Configure a shared store (`storage_uri="redis://..."`). Key the bucket
on a hash of the API key or the resolved `org_id`, not the raw secret.

### API-06 · 🟡 Medium · bug · Dedup is TOCTOU with no DB uniqueness backstop
**Location:** `routes/register.py` (dedup `SELECT` then insert); `db/models.py` → `Certificate` (no unique constraint on `sequence_hash`)

The "already registered" check is a `SELECT` followed later by an `INSERT` with
no unique constraint on `sequence_hash`, so two concurrent identical submissions
both pass the check and both insert. The model docstring says "one per
sequence+owner pair" but no constraint enforces it.

**Fix:** Add a unique constraint/index (on `sequence_hash`, or `(sequence_hash,
owner_id)` per the stated policy) and convert the resulting `IntegrityError`
into the existing 409 response.

### API-07 · 🟡 Medium · security · `AppendOnlyMixin` is inert — false sense of protection
**Location:** `db/models.py` → `AppendOnlyMixin`; `_mark_committed()` has zero call sites

The mixin only raises after `_committed` is set, but `_mark_committed()` is
never called anywhere, and SQLAlchemy sets attributes on load via the
instrumentation layer (bypassing `__setattr__`), so the guard never fires. Both
the class docstring and the module header claim ORM-level append-only
enforcement that does not exist. Only the DB trigger (migration 003) actually
protects the table.

**Fix:** Either delete the mixin and rely on the trigger (documenting that
clearly), or wire it correctly (SQLAlchemy events: block `before_update`/
`before_delete` on the mapper). Don't advertise protection that isn't active.

### API-08 · 🟡 Medium · security/privacy · Full plaintext sequence is stored, contradicting the privacy claim
**Location:** `routes/register.py` (`watermark_metadata={"original_protein": protein}`)

The README and `FragmentKmerIndex` docstring emphasize that sequences are never
stored — "only their hashes." But registration stores the **entire original
protein in plaintext** in `certificates.watermark_metadata`, and `get_certificate`
returns it to the owner. A DB compromise exposes every registered sequence,
directly contradicting the stated privacy posture.

**Fix:** If the full sequence is genuinely needed (for distribution
re-encoding), store it encrypted at rest (envelope-encrypt with a vault key) or
document the change in posture explicitly. Otherwise store only what's required.

### API-09 · 🟡 Medium · bug · `verify-source` requires byte-identical DNA (defeats mutation tolerance)
**Location:** `routes/distributions.py` → `verify_source()`

Leak attribution is `result.dna_sequence.upper() == submitted_dna` — exact
string equality. Any re-synthesis artifact, single codon change, or trimming
yields "no match," despite the README's core promise that the watermark
"survives re-synthesis and is recoverable from re-sequenced DNA." The
mutation-tolerant `TINSELDecoder` exists but isn't used here.

**Fix:** Score each candidate with `TINSELDecoder` (BER / bit-recovery) and
match on best-score-below-threshold, not exact equality. Return a confidence.

### API-10 · 🟡 Medium · bug/docs · `tier` hardcoded, `chi_squared` unset, no watermark at registration
**Location:** `routes/register.py` (`tier="STANDARD"`, no `chi_squared`, no `TINSELEncoder` call)

Every certificate is written with `tier="STANDARD"` regardless of the sequence's
actual capacity, `chi_squared` is never populated, and no codon watermark is
embedded at registration (it happens only at distribution time). The README
states each deposited sequence "receives a TINSEL … watermark" at registration —
the implementation defers that entirely. At minimum the stored `tier` is wrong
for most sequences.

**Fix:** Compute `tier`/`chi_squared` from `check_capacity`/encoder output and
store them, and either embed the watermark at registration or correct the
public claims to match the distribution-time model.

### API-11 · 🟡 Medium · security (DoS) · No request-size limit; field caps applied post-parse
**Location:** `routes/register.py`, `routes/analyse.py`, `RegistrationRequest`

There is no global body-size limit; the `_MAX_AA`/demo caps are checked only
*after* `normalise()` builds the full string in memory. `owner_id`/`ethics_code`
have no pydantic `max_length` (DB columns are 255/100), so an oversized value
sails through validation and 500s at the DB.

**Fix:** Enforce a max request body size (reverse-proxy or ASGI middleware); add
`max_length` to string fields; reject oversized input before heavy parsing.

### API-12 · 🟡 Medium · bug/efficiency · AWS vault client blocks the event loop and re-fetches every call
**Location:** `vault/aws_secrets.py` → `AWSSecretsVaultClient`

`get_spreading_key` calls synchronous `boto3` (`client.get_secret_value`) inside
an `async def`, blocking the event loop for the whole network round-trip, and it
constructs a new client + fetches the secret **on every call** (every register,
every demo request via API-04). No caching, no error mapping (the interface
promises `KeyError`, but botocore raises its own exceptions).

**Fix:** Cache the secret in-process with a TTL; use `aioboto3` or
`run_in_executor`; map missing-secret to `KeyError`.

### API-13 · 🟡 Medium · security · The "never use in production" vault client *is* the production path
**Location:** `vault/__init__.py` → `get_vault_client()`; `vault/env_mock.py` header

When `sentinel_env == "production"` but `aws_account_id` is unset (the default
Railway deploy), `get_vault_client()` returns `EnvMockVaultClient` — whose own
module says "NEVER use in production: the key material is visible in the process
environment and any crash dump." So the documented production deployment keeps
the master key in an env var.

**Fix:** Decide the intended posture. If env-var keys are acceptable for Railway,
remove the scary warning and document it; if not, fail closed in production when
no real vault is configured.

### API-14 · 🟡 Medium · security (DoS/cost) · Public `/health` does DB + vault work every call
**Location:** `routes/health.py` → `health()` / `_connectivity()`

The unauthenticated, un-rate-limited `/health` runs a DB query **and** a vault
fetch on every request. In production that's a Secrets Manager call per health
hit — cost, throttling, and a cheap amplification vector.

**Fix:** Make the public probe cheap (process liveness only, or a cached
connectivity result with a short TTL); keep the deep check on the authenticated
`/health/detail`.

### API-15 · 🟡 Medium · bug · Route inputs aren't validated against allowed alphabets; DNA treated as protein
**Location:** `routes/register.py` (`protein = sequence`), `sequence/fasta.normalise` (no char validation); `validators.py` is unused by routes

`normalise()` only detects a type; it never validates characters. For non-DNA/RNA
input, everything is labelled PROTEIN and passed downstream, and DNA input is
fed to the pipeline **as if it were protein** ("placeholder until a translator is
wired"). Gates and capacity math then run on meaningless symbols, and unknown
letters surface as 500s deep in the encoder.

**Fix:** Call the existing `validators.py` in the request path; translate DNA→
protein before gating (the codon table already exists in `utils.translate`);
reject invalid alphabets with a 422 up front.

## 2.3 Low / Nit — Dead code, duplication, ops

### API-16 · 🔵 Low · dead code (latent bug) · Unused helpers in `analyse.py`, one that would crash
**Location:** `routes/analyse.py` → `_codon_diff` (unused), `_nussinov` + `_approx_mfe` (unused)

`_codon_diff` constructs `CodonDiff(control_codon=..., watermarked_codon=...)`
but the model's fields are `original_codon`/`fingerprinted_codon` — it would
raise a `ValidationError` if ever called (the live path uses `_codon_diff_pair`
with correct names). `_nussinov` (O(n³) RNA folder) and `_approx_mfe` are dead.

**Fix:** Delete the dead functions (or wire them and fix the field names).

### API-17 · 🔵 Low · security · Seed scripts print/ship credentials
**Location:** `scripts/seed_prod.py` (prints raw key to logs), `scripts/seed_dev.py` (hardcoded `tinsel-dev-key-00000000`)

`seed_prod` prints the generated API key to stdout (persisted in Railway logs).
`seed_dev` ships a well-known key that grants full API access whenever
`SENTINEL_ENV=development`. If an env is ever misconfigured to `development`
publicly, that key is a backdoor.

**Fix:** Deliver the prod key out-of-band (write to the vault, or print a
one-time retrieval token, not the key). Ensure dev seeding can never run in a
network-exposed deployment.

### API-18 · 🔵 Low · efficiency/security · Auth writes on every request; unsalted key hash
**Location:** `dependencies.py` → `require_api_key()`

Every authenticated request issues an `UPDATE api_keys SET last_used_at` (write
amplification, row contention on hot keys). Keys are hashed with a single
unsalted SHA3-256 — acceptable *only* if keys are high-entropy random tokens
(they are, via `secrets.token_urlsafe`); note it explicitly so nobody introduces
low-entropy keys later. No lockout/backoff on repeated invalid keys.

**Fix:** Throttle `last_used_at` writes (e.g. update at most once/minute per
key); document the high-entropy-key assumption; consider counting failed auths.

### API-19 · 🔵 Low · feature-gap · Pathway Merkle tree/proof are stubs
**Location:** `routes/pathways.py` → `create_pathway()` (root = `sha3_256` of joined IDs), `get_pathway_proof()` (`proof: {"not_implemented": True}`)

The advertised "Merkle pathway" is a single hash of concatenated IDs, and proofs
are unimplemented. `gene_count` counts duplicates if the same ID is passed twice.

**Fix:** Implement a real Merkle tree + inclusion proofs, or clearly label the
feature as preview. De-duplicate `certificate_ids`.

### API-20 · 🔵 Low · spaghetti/DRY · Repeated maps, loops, and scattered inline imports
**Location:** multiple

`_HOST_ORGANISM_ENUM` is redefined in `analyse.py` and `distributions.py`; the
k-mer hashing loop is duplicated (`_kmer_hashes` vs inline in
`_add_kmer_index_rows`); many modules do function-local imports
(`from ... import` inside handlers) mixing with top-level imports.

**Fix:** Hoist shared constants/helpers into a small `sentinel_api/_common.py`;
normalize imports to module top unless there's a genuine cycle to break.

### API-21 · ⚪ Nit · misc
- `main.py` uses the deprecated `@app.on_event("startup")` — migrate to the
  `lifespan` context manager.
- CORS `allow_credentials=True` is unnecessary for header-based (`X-API-Key`)
  auth and slightly widens exposure; drop it unless cookies are used.
- `structure.py` imports underscore-private helpers
  (`_compute_instability_index`, `_parse_plddt_from_pdb`) across the package
  boundary from `tinsel_gates` — promote them to public API or duplicate
  intentionally.

### API-22 · 🔵 Low · ops · `start.sh` masks seed failures; fragile DB-readiness parse
**Location:** `scripts/start.sh`

Runs `alembic upgrade head` **and** the prod seed on every container start;
`python seed_prod.py || true` swallows any seeding error silently. The readiness
probe reconstructs the DB URL by stripping `postgresql://`, which breaks if the
password contains `@` or `/`.

**Fix:** Don't `|| true` the seed (or log loudly on failure); gate migrations
behind an explicit release step for production; parse the URL with a real URL
parser.

### API-23 · 🔵 Low · security · Only the spreading key is guarded against dev defaults in production
**Location:** `config.py`

The model validator rejects the dev `spreading_key` in production, but nothing
guards the localhost `database_url` default (a prod deploy could silently run
against localhost), and the default `database_url` embeds a literal password.
`ncbi_*` creds default empty with no warning where required.

**Fix:** Extend the production guard to reject the default `database_url` (and
any obviously-local host) in `production`, and surface missing external creds
where those integrations are active.

---

*End of Phase 2. Phase 3 (`tinsel-gates`) pending your go-ahead.*
