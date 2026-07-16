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
| 3 | `tinsel-gates` (pipeline + 4 gate adapters) | ✅ Done |
| 4 | `tinsel-demo`, `scripts/`, infra (Docker, CI, pyproject, railway) | ✅ Done |
| 5 | `apps/dashboard` (Next.js/React + API proxy) | ✅ Done |
| 6 | Cross-cutting: architecture, test coverage, feature roadmap, prioritized summary | ✅ Done |

> **New here?** Jump to the [Executive Summary](#phase-6--cross-cutting-synthesis) and the
> [Prioritized "Fix First" list](#62-prioritized-fix-first-ordering) in Phase 6.
> ~90 findings total across 5 packages; the single most important one is the
> **claims-vs-reality gap** (§6.1).

---

# Phase 1 — `tinsel-core`

Package: `packages/tinsel-core/tinsel/` (~4,271 lines). This is the cryptographic
and watermarking heart of the system, so it gets the most scrutiny.

## 1.1 Critical / High — Cryptographic correctness & integrity

### CORE-01 · 🔴 Critical · security · WOTS+ one-time keypair is reused across signing events · ✅ FIXED
**Location:** `tinsel/crypto/__init__.py` → `PQSigner.sign_certificate()`; `tinsel/crypto/wots.py` → `generate_keypair()`

> **✅ Fixed** (commit on `claude/code-review-checklist-ydgp51`):
> `PQSigner.sign_certificate()` now takes an `event_nonce` and threads it into
> `generate_keypair(seed, registry_id, event_nonce)`; the nonce is persisted in
> both `pk_dict`/`sig_dict` (and the `WOTSPublicKey`/`WOTSSignature` models) for
> auditability. `register.py` passes the monotonic, globally-unique audit
> `seq_num` as the nonce, so no two signing events can derive the same one-time
> keypair. Added `TestWOTSOneTimeSignature` (6 tests) covering sign→verify
> roundtrip, tamper rejection, distinct-nonce→distinct-keypair, nonce
> persistence, determinism, and string (UUID) nonces. Also removed the two dead
> imports in `crypto/__init__.py` (**CORE-10** partial). Full core+gates suites
> (110 tests) pass; the 2 failing `TestHealth` API tests are pre-existing
> (connectivity 503, unrelated to this change).

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

### CORE-02 · 🟠 High · security/bug · Certificate hash uses ambiguous, order-dependent serialization · ✅ FIXED
**Location:** `tinsel/registry.py` → `HybridCertificate.compute_hash()`

> **✅ Fixed:** `compute_hash` now emits canonical JSON (`sort_keys=True`,
> `separators=(",",":")`, `default=str`) prefixed with a versioned scheme tag
> (`HASH_SCHEME = "tinsel-cert-hash-v1"`, a `ClassVar`), so field boundaries are
> unambiguous (no `"12"+"3"` vs `"1"+"23"` collision) and the hash is
> order-independent. Added a `canonical_timestamp()` helper (naive→UTC) used on
> both the signing and verification paths so field-integrity checks don't depend
> on DB timezone round-tripping. New `TestCertificateHashCanonicalization` (4
> tests: boundary-collision, order-independence, determinism, value-sensitivity).

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

### API-01 · 🟠 High · security · WOTS+ signatures are never verified anywhere (write-only crypto) · ✅ FIXED
**Location:** whole package; `grep` shows `PQSigner.verify_certificate` has zero call sites. `certificates.py` → `verify_certificate()` only runs the *watermark* decoder.

> **✅ Fixed:** Added a public, no-auth endpoint
> `GET /api/v1/certificates/{registry_id}/verify-signature` (for `public`
> certificates) that (a) verifies the WOTS+ signature over the stored
> certificate hash and (b) recomputes the canonical hash from the stored fields
> and compares it — returning `signature_valid`, `field_integrity`,
> `overall_verified`, `algorithm`, `is_stub`, and `event_nonce`. Verification
> uses a new seedless `PQSigner.verify_signature()` staticmethod (no master
> secret needed — genuine public-key verification, so third parties/synthesizers
> can verify). Regression tests: `TestVerifySignature` (register→verify happy
> path with `overall_verified is True`, plus 404). Full audit-chain (ledger)
> verification remains a separate follow-up (API-03).

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

*End of Phase 2.*

---

# Phase 3 — `tinsel-gates`

Package: `packages/tinsel-gates/tinsel_gates/` (~2,864 lines). The four-gate
biosafety pipeline and its adapters: Gate 1 (ESMFold structural), Gate 2
(chained composition + SecureDNA + IBBIS), Gate 3 (codon/HGT ecological),
Gate 4 (embedding functional-analogue).

**What's solid:** clean adapter/ABC structure with mock+real per gate, tidy
dependency-injection for tests, concurrent gate execution with fail-fast on
Gate 1, honest per-adapter docstrings that *do* disclose the mock/heuristic
nature (the code is more truthful than the README/certificates are — see the
theme below), and thoughtful audit metadata (`databases_queried`).

> **Overarching theme (safety-critical):** In `development`/`production` the
> pipeline reports `gate_mode="real"`, and certificates/compliance/synthesis
> docs carry that label — but the *actual* hazard screening that runs in prod
> is almost entirely heuristic or mock. The three High findings below are facets
> of one problem: **the system asserts a level of biosafety assurance it does
> not deliver.** For a registry whose entire value proposition is trustworthy
> screening, this is the most important cluster in the review.

## 3.1 High — "Real" gates aren't real

### GATE-01 · 🟠 High · security/safety · Production Gate 2 hazard-DB screening is always mock
**Location:** `pipeline.py` → `_build_gate2()` (hardcodes `ChainedGate2Adapter(use_mock_external=True)`); `adapters/gate2/secureDNA.py`, `adapters/gate2/ibbis.py`

Gate 2 is the toxin/pathogen screen. In every environment the pipeline builds it
with `use_mock_external=True`, so:
- **SecureDNA** = `_screen_doprf_mock`: an exact 30-mer match against **three
  fictional** demo hazard strings. Real hazards are never present, so it only
  ever returns PASS on real input.
- **IBBIS commec** = `_screen_hmm_mock`: substring match against fictional
  signature peptides.
- The real integrations (`mock=False`) simply `raise NotImplementedError`.

Only the offline composition heuristic actually evaluates real sequences. Yet
`ChainedGate2Adapter.mock_mode = False` (comment: "SecureDNA mock + IBBIS mock
still count as 'real'") and the report says `gate_mode="real"`. So a production
"CERTIFIED" certificate attests to SecureDNA/IBBIS screening that did not
meaningfully happen.

**Fix:** Don't hardcode `use_mock_external=True`; drive it from config and fail
closed in production when real screening isn't configured. Never label a run
`real` unless the external layers actually executed against real databases.
Record per-layer live/mock state on the certificate.

### GATE-02 · 🟠 High · security/safety · Gate 1 (ESMFold) fails **open** to a constant-PASS mock · ✅ FIXED
**Location:** `adapters/gate1/esmfold.py` → `ESMFoldGate1Adapter.run()`; `adapters/gate1/mock.py`

> **✅ Fixed:** All three silent mock-PASS fallbacks (sequence > limit, API
> error, unparseable PDB) now route through a new `_degraded_gate1()` helper that
> returns **WARN** with `plddt_* = None` — structural confidence is reported as
> *not assessed*, never a fabricated PASS (the old path returned a constant
> pLDDT 87.3). WARN doesn't trip Gate-1 fail-fast, so hazard gates still run and
> the certificate is flagged for review rather than silently certified. The
> `except` was narrowed to `(TimeoutError, httpx.HTTPError)` so unexpected
> (non-transport) errors propagate as a pipeline error instead of being masked;
> the now-unused `MockGate1Adapter`/`math` imports were removed. New
> `test_esmfold_failclosed.py` (5 tests: long-seq, transport error, timeout,
> unparseable PDB → WARN; unexpected error → propagates). Note: `gate_mode`
> labeling (GATE-08) is still separate — this fix stops the *silent PASS*.

On **any** exception — the clause is `except (httpx.HTTPError,
asyncio.TimeoutError, Exception)`, i.e. catch-all — or a malformed/empty PDB,
the adapter silently falls back to `MockGate1Adapter().run(...)`. That mock
**does not analyse the sequence**: with default args it returns a hardcoded
`pLDDT mean = 87.3`, `low_fraction = 0.05` → **PASS** for literally any input.
The public `api.esmatlas.com` endpoint is frequently slow/unavailable, so under
normal operation Gate 1 routinely degrades to "everything passes with fabricated
confidence," while `gate_mode` still reads `real` and the fail-fast filter waves
everything through to the other gates.

**Fix:** Fail **closed** — on ESMFold error, return `WARN`/`FAIL` or mark the
gate `indeterminate`, never a synthetic PASS. Narrow the `except` to real
network errors. If a fallback is unavoidable, stamp the result and the
certificate as degraded (not `real`) and don't let it satisfy the pass criteria.

### GATE-03 · 🟠 High · correctness/safety · Gate 4 runs an uncalibrated metric under an ESM-2 threshold
**Location:** `adapters/gate4/embedding.py` (`use_esm2=False` in prod via `pipeline._build_gate4`), `adapters/gate4/reference_db.py`

In prod Gate 4 uses the 420-D amino-acid+dipeptide **composition fingerprint**,
not ESM-2 — but keeps the `FAIL ≥ 0.85 / WARN ≥ 0.70` cosine thresholds that
were chosen for ESM-2 embedding space (the docstring even says "Threshold 0.85
retained"). Composition vectors live in the non-negative orthant, so cosine
similarity between *unrelated* proteins is systematically high and compressed
into a narrow band — 0.85 means something completely different here than in
ESM-2 space. The result is an essentially uncalibrated detector: likely to both
false-positive on benign proteins that share bulk composition with a toxin and
miss true functional analogues. The gate that's advertised as catching
"AI-designed variants that evade sequence screens" is the least trustworthy in
the mode that actually runs.

**Fix:** Calibrate separate thresholds for the composition space against a
labelled positive/negative set (or drop composition mode from "real" and require
ESM-2). Report an honest confidence and label the method on the certificate.

## 3.2 Medium — Coverage gaps, privacy, accuracy

### GATE-04 · 🟡 Medium · bug · Each gate only meaningfully screens one input type; the other is skipped or fed garbage
**Location:** `adapters/gate3/codon.py` → `run()` (`if not dna: return PASS`); ties to `register.py` (`dna="" ` for protein input, `protein=sequence` for DNA input) and API-15

Gate 3 auto-**PASSes** whenever `dna` is empty — and registration passes `dna=""`
for every protein submission, so **protein deposits never receive ecological/HGT
screening at all**. Conversely, DNA submissions are passed with `protein=<the DNA
string>`, so Gates 1/2/4 (which expect amino acids) run on nonsense. Net: for any
given submission, at least one gate is either skipped or operating on
meaningless input.

**Fix:** Translate DNA→protein (and keep the DNA) before the pipeline so all four
gates get correct inputs; don't silently PASS Gate 3 on missing DNA — mark it
`skip`/`indeterminate` and surface that in the certificate.

### GATE-05 · 🟡 Medium · security/privacy · Every registered sequence ≤400 AA is sent in plaintext to a third party
**Location:** `adapters/gate1/esmfold.py` (`POST https://api.esmatlas.com/...`); also `routes/structure.py`

Real-mode Gate 1 POSTs the raw protein to the public ESMFold Atlas API on every
registration. This directly conflicts with the platform's "sequences are never
stored / privacy-preserving" positioning — the sequence leaves the trust boundary
to an external service (subject to that service's logging/retention) for every
deposit and every public `/analyse/structure` call.

**Fix:** Disclose the external call, gate it behind consent/config, or run
ESMFold in-house; at minimum document the data-flow in the privacy notice.

### GATE-06 · 🟡 Medium · accuracy · Composition toxin heuristic will over-flag common benign proteins
**Location:** `adapters/gate2/composition.py` → `_toxin_probability`, `_screen_toxin_kmers`

The only layer that actually inspects real sequences in prod flags cationic/
hydrophobic composition as "toxin" (`toxin_probability ≥ 0.30 → FAIL`). Highly
basic proteins that are perfectly benign — histones, many ribosomal and
DNA/RNA-binding proteins — are K/R-rich and will trip this. The 9-mer screen
FAILs on *any* ≤1-mismatch hit against 15 motifs, another false-positive source.
High false-positive rates erode trust and push users to distrust/bypass the
screen.

**Fix:** Validate thresholds against a benign reference set (e.g. SwissProt
human proteome) and tune for a target FPR; treat heuristic hits as WARN pending a
real database confirmation rather than hard FAIL.

### GATE-07 · 🟡 Medium *(latent)* · efficiency · ESM-2 path recomputes all reference embeddings per request
**Location:** `adapters/gate4/embedding.py` → `_run_esm2()`

If ESM-2 mode is ever enabled, every screen makes `1 + len(REFERENCE_FAMILIES)`
HuggingFace API calls (reference embeddings recomputed on the fly — the code
admits "would normally be pre-cached"), plus O(n·dim) pure-Python mean-pooling.
That's ~6 external calls per registration and will be slow and rate-limited.

**Fix:** Pre-compute and cache reference embeddings at startup; batch/mean-pool
with numpy. (Dead today, but wire it before enabling `use_esm2`.)

## 3.3 Low / Nit

### GATE-08 · 🔵 Low · security/labeling · `gate_mode` reflects only `env`, not whether live screening ran
**Location:** `pipeline.py` → `_gate_mode()`

`_gate_mode` returns `"real"` purely from `env ∈ {development, production}`, with
no knowledge of GATE-01/02/03. There's no field distinguishing "real gates,
external layers mocked/failed-over" from "fully live." Downstream compliance and
synthesis-auth documents inherit the optimistic label.

**Fix:** Compute `gate_mode` from what actually executed (per-gate, per-layer
live flags); propagate a structured "assurance level" instead of a single
real/mock string.

### GATE-09 · 🔵 Low · spaghetti · Host organism injected via a private attribute + `type: ignore`
**Location:** `adapters/gate3/codon.py` → `make_codon_gate3_adapter()` sets `adapter._host_organism`; `run()` reads it via `getattr(self, "_host_organism", "ECOLI")`

The adapter `run(dna, protein)` signature can't carry the host, so it's bolted on
as an undeclared instance attribute by a factory. Works, but fragile and untyped.

**Fix:** Make host a constructor parameter of `CodonGate3Adapter.__init__`.

### GATE-10 · 🔵 Low · DRY · GC/instability/PDB helpers duplicated across packages
**Location:** GC content in `tinsel/utils.py`, `gate3/codon.py`, `routes/analyse.py` (and embedding); `_compute_instability_index`/`_parse_plddt_from_pdb` imported from `gate1.esmfold` into `routes/structure.py`

At least three separate GC-content implementations exist, and the API imports
underscore-private ESMFold helpers across the package boundary.

**Fix:** Centralize bioinformatics primitives in `tinsel.utils` (public) and
import everywhere; promote the ESMFold helpers to a public module.

### GATE-11 · ⚪ Nit · Over-broad `except`
**Location:** `adapters/gate1/esmfold.py`

`except (httpx.HTTPError, asyncio.TimeoutError, Exception)` — `Exception`
subsumes the others and swallows programming errors as "API unavailable." Narrow
it (and see GATE-02 for why the *handling* is the real problem).

### GATE-12 · ⚪ Nit · Advertised-but-absent signals
- `delta_mfe` is hardcoded `0.0` ("LinearFold/Nussinov not integrated") though
  Gate 1 is described as "pLDDT + ΔMFE"; the Nussinov code exists only as dead
  code in `routes/analyse.py` (API-16).
- Gate 1 fail-fast means legitimately disordered-but-safe proteins (low pLDDT)
  are FAILed and never toxin/pathogen-screened — reconsider whether structural
  confidence should gate hazard screening.

### GATE-13 · ⚪ Nit · Codon tables are approximate; no reading-frame validation
**Location:** `adapters/gate3/codon.py`

Some tables are self-described approximations (`CHO` "approximated from mammalian
consensus"), and `_compute_cai` assumes the DNA is in-frame and a multiple of 3
without checking. Fine for a heuristic, but document the provenance and validate
frame.

---

*End of Phase 3.*

---

# Phase 4 — `tinsel-demo`, `scripts/`, and infrastructure

Covers `packages/tinsel-demo/` (demo runner + golden fixtures),
`scripts/compute_real_gate_outputs.py`, and the deploy/build layer
(`Dockerfile`, `docker-compose.yml`, `railway.json`, root `pyproject.toml`,
`.github/workflows/ci.yml`, alembic `env.py`, `.env.example`).

**What's solid:** a genuine CI matrix (ruff + bandit + mypy-strict + pytest with
coverage, plus a dashboard type-check/build), pinned Postgres image and
healthchecks in compose, correct async alembic setup with `NullPool` and
`compare_type`/`compare_server_default`, a deterministic golden-file demo harness,
and an `.env.example` that documents the prod-key requirement.

## 4.1 Medium

### INFRA-01 · 🟡 Medium · security · API container runs as root
**Location:** `packages/tinsel-api/Dockerfile`

There is no `USER` directive, so `start.sh`/uvicorn run as **root** inside the
container. Combined with auto-running migrations and seeds on boot, any RCE or
container breakout starts with root. Standard hardening is missing.

**Fix:** Create and switch to a non-root user (`RUN adduser --system app`,
`USER app`), ensure file ownership/permissions are set, and drop capabilities in
the runtime platform.

### INFRA-02 · 🟡 Medium · docs/safety · `.env.example` (and config comments) misdescribe the env→gate mapping
**Location:** `.env.example` ("development — uses mock biosafety gates"; "production — uses real gates"); cross-ref `pipeline._REAL_ENVS`, GATE-08

The pipeline treats **both** `development` and `production` as real
(`_REAL_ENVS = {"development", "production"}`); only `test` is fully mocked. But
`.env.example` tells operators that `development` "uses mock biosafety gates."
An operator who trusts this will believe a `development` deployment is inert when
it is actually calling ESMFold, storing plaintext sequences, etc. — and,
conversely, may not realize `production` still mocks the external hazard DBs
(GATE-01). Safety-relevant documentation error.

**Fix:** Correct the description to reflect reality (`test` = mock, `development`/
`production` = real adapters with externally-mocked DB layers unless configured),
and align it with the honest per-adapter docstrings.

## 4.2 Low

### DEMO-01 · 🔵 Low · correctness/provenance · Heuristics reimplemented a third time; golden fixtures don't match the runner's adapters
**Location:** `scripts/compute_real_gate_outputs.py`; `packages/tinsel-demo/run_demo.py` (MANIFEST uses mock adapters); `packages/tinsel-demo/golden/*.json`

`compute_real_gate_outputs.py` re-implements the gate heuristics independently and
*differently* from `gate2/composition.py` — e.g. `toxin_probability = (K+R)/len`
and `allergen_probability = C/len`, versus composition.py's sigmoid features. So
the "real gate outputs" that feed the paper/README come from a **different
algorithm** than the deployed gates (third parallel copy after `composition.py`
and this script; see also GATE-10 on GC duplication). Separately, `run_demo.py`'s
MANIFEST drives the pipeline with **mock** adapters, yet the golden files carry
real-looking values and messages (`"plddt_mean": 77.6 … ESMFold API`,
`GRAVY -0.667`) that the mock adapters (default pLDDT 87.3) would not produce — so
`run_demo.py` (verify mode) appears unable to reproduce its own golden fixtures.

**Fix:** Have one source of truth for the heuristics (import from
`tinsel_gates`), and regenerate golden files from the exact adapters the runner
uses so `--generate` and verify are consistent. If goldens are meant to capture
*real* runs, make the runner run real adapters for generation.

### DEMO-02 · 🔵 Low · consistency · Demo signing-key derivation differs from the vault's
**Location:** `run_demo.py` (`DEMO_SIGNING_KEY = sha3_256(DEMO_KEY + b":tinsel-signing-key-v1")`) vs `vault/base.py` (`_derive_signing_key = HMAC(spreading, b"tinsel-signing-key-v1")`)

The demo derives the signing key with a plain SHA3-256 concatenation, while the
real vault path uses HMAC. Not a vulnerability, but it means demo-produced
watermarks/signatures are not reproducible by the production derivation and vice
versa — an avoidable inconsistency in a repo that emphasizes deterministic,
verifiable output.

**Fix:** Import and reuse `_derive_signing_key` in the demo.

### INFRA-03 · 🔵 Low · ci · Security gates in CI don't actually gate
**Location:** `.github/workflows/ci.yml`

- `npm audit --audit-level=high` has `continue-on-error: true` → advisory only.
- `bandit -ll` reports only High severity; Medium findings pass silently.
- Coverage is collected (`--cov`) but never enforced (`--cov-fail-under` absent).
- No dashboard tests; no secret-scanning/`detect-secrets` step.
- Triggers are `push`/`pull_request` to `main` only, so work on feature branches
  (including branches that never target `main` directly) gets no CI.

**Fix:** Make `npm audit` and bandit failing checks (or triage explicitly), add a
coverage floor, add secret scanning, and broaden trigger branches (or run on all
PRs regardless of base).

### INFRA-04 · 🔵 Low · security · Dockerfile supply-chain hardening
**Location:** `packages/tinsel-api/Dockerfile`

Base image `python:3.12-slim` is tag-pinned but not digest-pinned; `pip install`
runs without hash pinning; single-stage build ships build tooling into the
runtime image; no `HEALTHCHECK` in the image itself (only compose has one).

**Fix:** Pin the base by digest, use `uv`/pip with a locked+hashed requirement
set (a `uv.lock` already exists at the root — use it), consider a multi-stage
build, and add an image `HEALTHCHECK`.

### INFRA-05 · 🔵 Low · consistency · The insecure `"aa"*32` dev key is hardcoded in three places
**Location:** `config.py` (`spreading_key` default), `docker-compose.yml` (inline default), `run_demo.py` (`DEMO_KEY`)

The same weak dev key literal is repeated; a change in one won't propagate, and
its presence in compose means a stray `SENTINEL_ENV` other than `production`
would run with a known key (the prod guard only fires for `production`).

**Fix:** Centralize the dev-key default; ensure any non-`test`/non-local run
refuses known-weak keys, not just `production`.

## 4.3 Nit

### INFRA-06 · ⚪ Nit · lint/type config gaps
**Location:** root `pyproject.toml`

Ruff `select` omits `B` (bugbear) and `S` (flake8-bandit) which would catch some
of the issues in this review (broad excepts, etc.). Mypy is strict for core/gates
but broadly relaxed for `sentinel_api.*` — reasonable, but several route bugs
here (e.g. API-16's wrong Pydantic fields) are the kind stricter typing would
surface.

**Fix:** Add `B`/`S` to ruff; tighten the `sentinel_api` mypy overrides where
feasible.

---

*End of Phase 4.*

---

# Phase 5 — `apps/dashboard` (Next.js frontend)

App: `apps/dashboard/` (~10,385 lines TS/TSX). Next.js 14 App Router + React +
TanStack Query + Tailwind, with a server-side proxy route to the backend.

**What's solid:** the API key is deliberately kept in `sessionStorage` (not a
cookie/URL) and routed through a server-side proxy so the backend URL isn't
baked into the client; `CertificateCard` *does* surface `pq_is_stub` and a
`gate_mode==="mock"` warning; and the JSON viewer's `_syntaxHighlight` correctly
HTML-escapes `&/</>` **before** adding highlight spans, so both
`dangerouslySetInnerHTML` sites are not XSS-exploitable as written. Good typed
API client mirroring the Pydantic schemas.

> **Theme (continues Phases 1–3):** the frontend frequently presents
> mock/heuristic/stub backend output as authoritative — "● LIVE", "CERTIFIED",
> "WOTS+ SIGNATURE APPLIED", "anchored to the ledger" — without surfacing the
> `is_stub`/`gate_mode` reality. The trust-signal findings (FE-T*) are the
> user-facing face of GATE-01/02/08 and API-01. This is the phase where the
> gap becomes visible to end users and third parties.

## 5.1 High — Security surface

### FE-01 · 🟠 High · security · Proxy's shared-key fallback turns the dashboard into an open authenticated gateway
**Location:** `app/api/proxy/[...path]/route.ts:21` — `const apiKey = req.headers.get("x-api-key") || SERVER_API_KEY;`

When `API_KEY` is configured on the Next server, the proxy signs **every**
request that lacks a browser-supplied key with that shared server key. Any
anonymous visitor who can load the site can therefore call the backend as an
authenticated org — including `POST /register`, `/certificates/{id}/revoke`, and
the distribution endpoints. The backend's API-key auth (a real strength, per
Phase 2) is effectively nullified for anyone who reaches the dashboard.

**Fix:** Don't fall back to a privileged shared key for state-changing routes.
If a public read-only demo is desired, use a separate least-privilege key
restricted to safe GET endpoints, and require a real key for register/revoke/
distribute. Consider per-route allowlisting in the proxy.

### FE-02 · 🟠 High · security · `NEXT_PUBLIC_API_KEY` ships a working key to every browser
**Location:** `lib/providers.tsx:52-55` (prefers `process.env.NEXT_PUBLIC_API_KEY`); `app/sequences/page.tsx:348` and `app/sequences/[id]/page.tsx:2452` instruct users to set it

Any `NEXT_PUBLIC_*` var is inlined into the client bundle at build time. So a
deployment that sets `NEXT_PUBLIC_API_KEY` (which the UI explicitly tells users
to do) embeds a live API key in the JavaScript served to every visitor —
publicly extractable. Together with FE-01 there are two independent paths that
make the shared key public.

**Fix:** Never expose an API key via `NEXT_PUBLIC_*`. Keep keys server-side
(proxy) or require users to paste their own; update the on-screen guidance.

### FE-03 · 🟡 Medium · security · No security headers (CSP/HSTS/X-Frame-Options)
**Location:** `next.config.mjs` (no `headers()` config)

There's no Content-Security-Policy, `X-Frame-Options`/`frame-ancestors`,
`Referrer-Policy`, or HSTS. For a public site that holds an API key in
`sessionStorage` and uses `dangerouslySetInnerHTML` (safe today, but one refactor
from unsafe), a CSP is important defense-in-depth and would also mitigate key
exfiltration via injected script.

**Fix:** Add a `headers()` block (or middleware) with a strict CSP, `frame-
ancestors 'none'`, `Referrer-Policy: no-referrer`, and HSTS in production.

## 5.2 High — Trust / UX-safety (mock/stub presented as authoritative)

### FE-T1 · 🟠 High · trust · UI shows "● LIVE" and hides the mock reality of production gates
**Location:** `app/sequences/[id]/page.tsx:2362-2379` ("● LIVE" when `gate_mode==="real"`); `components/CertificateCard.tsx:251` (warning only when `gate_mode==="mock"`)

The detail page renders a green **"● LIVE"** badge whenever `gate_mode==="real"`,
and the only "no real biosafety assurance" warning fires solely on
`gate_mode==="mock"`. But per GATE-01/GATE-08 the backend reports `"real"` in
production even though SecureDNA/IBBIS are mocked and ESMFold silently falls back
to a constant-PASS mock. So the UI actively badges partially-mock screening as
LIVE, and the honest warning never appears in prod.

**Fix:** Drive trust badges off a truthful per-layer assurance signal (once the
backend provides it — GATE-08), not the single `real/mock` flag; show which
external databases actually ran.

### FE-T2 · 🟠 High · trust · `pq_is_stub` is not surfaced on the certificate detail page
**Location:** `app/sequences/[id]/page.tsx` — `pq_is_stub` only appears inside a JSON blob (`:1262`); visible UI shows a "Watermark present" badge (`:1307`), raw `signature_hex` (`:1313`), and "anchored to the ledger" custody wording (`:1252`)

Unlike `CertificateCard` (which shows a stub notice), the detail page presents a
signature and "anchored" ledger language with no human-readable stub/unsigned
disclaimer, even when `pq_is_stub` is true. Combined with API-01 (signatures are
never actually verified anywhere), the page implies cryptographic assurance that
may not exist.

**Fix:** Render a prominent "unsigned / stub signature" banner whenever
`pq_is_stub`; drop "anchored/ledger" wording until a real signed chain entry
exists and is verified.

### FE-T3 · 🟠 High · trust · The register wizard fabricates the biosafety analysis
**Location:** `app/register/page.tsx:43-47` (hard-coded gate durations), `:208` (`Promise.all([register, sleep(3400)])`), `:455` (`report?.[gateKey]?.status ?? "pass"`), `:523-550` (fabricated thresholds + unconditional "watermark embedded… anchored to the ledger"), `:533` (dead download button)

The registration flow simulates a "~90 second" multi-gate analysis with fixed
timers, defaults every gate badge to **PASS** when the report is missing/partial,
lists thresholds for tools that don't run (ESMFold pLDDT, ToxinPred2, DriftRadar)
that don't match the real composition heuristics, asserts a watermark was
embedded/anchored unconditionally, and offers a non-functional "Download
certificate" button.

**Fix:** Drive progress and gate badges from the real consequence report; default
unknown gates to a neutral state (not PASS); correct the tool/threshold labels to
what actually ran; gate the watermark/ledger copy on real data; wire or remove
the download button.

### FE-T4 · 🟠 High · trust · Showcase hard-codes CERTIFIED rows and stub crypto as authoritative
**Location:** `app/showcase/page.tsx:361` (every registry row labeled `CERTIFIED`), `:549` / `:883-884` ("WOTS+ / SHA3-512", "WOTS+ SIGNATURE APPLIED · IMMUTABLE LEDGER ENTRY CREATED"), `:150` ("Immutable audit ledger" = live) vs `:160` (LWE "currently stubbed")

The public showcase labels all rows `CERTIFIED` regardless of real status
(a REVOKED/FAILED sequence would show CERTIFIED), and states signatures/ledger as
applied/immutable/live in the same file that admits parts are stubbed.

**Fix:** Render each row's actual status; gate crypto/ledger claims on the real
`pq_is_stub`/`gate_mode` fields or clearly mark the showcase as an illustrative
mock.

### FE-T5 · 🟡 Medium · trust · Mock data is silently substituted for real registry/certificate data on error
**Location:** `app/registry/page.tsx:173` + `:358` ("Error state is suppressed when mock data is shown"), `app/sequences/[id]/page.tsx:2432-2440` (`MOCK_CERTIFICATE_DETAILS` fallback), `lib/mock-data.ts` imported into both

When the live registry errors *or* returns zero rows, the registry page shows
`lib/mock-data.ts` fixtures instead and suppresses the error; the detail page
serves mock certs for `AG-DEMO-*` and as a fallback when the API throws. There is
a demo banner on the registry, but a backend outage can make fabricated
certificates appear as real registry content, and the detail page won't flag
their stub-ness (FE-T2). `mock-data.ts` is thus in production render paths, not
just tests.

**Fix:** Never substitute mock data for a failed live query without an
unmistakable "DEMO DATA — backend unavailable" state; keep demo records strictly
behind `AG-DEMO-*` and always badge them.

### FE-T6 · 🟡 Medium · trust · Fabricated institution names shipped to the landing page
**Location:** `app/page.tsx:57-58` — ticker of `"WELLCOME TRUST-mock"`, `"NIH-mock"`, `"Anthropic-mock"`, etc.

The homepage renders a scrolling list of real institutions with a `-mock` suffix.
On a site presenting itself as live public-interest infrastructure, displaying
named organizations (even suffixed) reads as implied affiliation/endorsement and
is a credibility/integrity risk.

**Fix:** Remove real org names until there are genuine participants, or clearly
frame as "illustrative."

### FE-T7 · 🟡 Medium · trust · Gate count/labels are inconsistent across the product
**Location:** showcase "ALL FOUR GATES (α β γ δ)", detail renders Gate 4 (`:690`), but `CertificateCard`/`ConsequenceSummary` show only gates 1-3 and `register` says "three gates"

Users see three or four gates depending on the page, with α/β/γ vs "Gate 1/2/3"
naming mismatches.

**Fix:** Standardize the gate set and naming everywhere from one source.

## 5.3 High/Medium — Structural / spaghetti

### FE-S1 · 🟠 High · dead code/bug · Dead `nav.tsx` means dark mode is non-functional app-wide
**Location:** `app/nav.tsx` (never imported; `app/layout.tsx:4,31` uses `SiteHeader`); `tailwind.config.ts:4` (`darkMode:"class"`)

`nav.tsx` is the only code that toggles the `.dark` class, but it's dead —
`SiteHeader` replaced it and has no theme toggle. Since nothing sets `.dark`, the
hundreds of `dark:` variants across ~19 files never activate: the shipped app is
permanently light mode, and a large fraction of the styling code is inert.

**Fix:** Delete `nav.tsx`; either add a real theme toggle that sets `.dark` (and
persist it) or remove the dead `dark:` utilities.

### FE-S2 · 🟠 High · spaghetti · Two parallel, non-shared styling systems
**Location:** Tailwind `slate/dark:` utilities (`app/sequences/page.tsx`, `demo/page.tsx`, `verify/page.tsx`, `components/*`) vs CSS-variable + inline-style design system (`registry/page.tsx`, `register/page.tsx`, `sequences/[id]/page.tsx`, `components/design/*`)

Half the app is styled one way, half another, sharing nothing — double the
maintenance surface and inconsistent theming (compounds FE-S1).

**Fix:** Choose one system and migrate the other set of pages.

### FE-S3 · 🟠 High · spaghetti · 2,670-line single-file page mixing ~20 concerns
**Location:** `app/sequences/[id]/page.tsx`

One file holds the page plus StatusBadge, GateItem, ~8 gate panels, ProvenanceTab,
DistributionSection, DistributeModal, ComplianceTab, SynthesizerTab, a JSON
syntax-highlighter, and more.

**Fix:** Extract tabs/panels into `app/sequences/[id]/tabs/*` and
`components/gates/*`.

### FE-S4 · 🟡 Medium · DRY · Status/tier/gate badge helpers duplicated 3-5×
**Location:** `StatusBadge` in `CertBadges.tsx:17`, `registry/page.tsx:30`, `sequences/[id]/page.tsx:43`; tier-color map in `CertBadges.tsx:9`, `CertificateCard.tsx:22`, `CodonBiasChart.tsx:252`, `sequences/[id]/page.tsx:2499`; the `{pass,fail,warn,skip}→badge-*` map in 5+ spots

**Fix:** One shared `components/badges.tsx` keyed by status/tier.

### FE-S5 · 🔵 Low · dead code · Leftover scaffold/stub comments in shipped code
**Location:** `app/showcase/page.tsx:3-17` ("IMPLEMENTATION GUIDE… stubbed with a TODO… See HANDOFF.md"); `sequences/[id]/page.tsx:1648` ("Phase 3c — stubs filled in…"); `CertBadges.tsx:63` ("Phase 3" in user-facing text)

**Fix:** Remove scaffolding comments and internal phase references from shipped UI.

### FE-S6 · 🔵 Low · spaghetti · Message-substring branching couples UI to backend wording
**Location:** `CertificateCard.tsx:106-117` (`GATE_FIX_HINTS` branches on "k-mer"/"allergen"/"disordered" substrings)

**Fix:** Return a stable hint key from the API instead of matching prose.

## 5.4 Medium/Low — Correctness

### FE-C1 · 🟡 Medium · bug · Registry search/filter only sees the current 10-row page
**Location:** `app/registry/page.tsx:158-174` (`applyFilter` over one page of `listCertificates(PAGE_SIZE, offset)`)

Searching by AG-ID/institution or filtering by status only matches within the
current page, so real matches on other pages are missed ("No records match")
while `totalPages` still reflects the unfiltered total.

**Fix:** Push search/status filters to the API, or fetch the full set before
client-side filtering.

### FE-C2 · 🟠 High · test correctness · e2e tests are stale and intercept the wrong layer
**Location:** `e2e/sequences.spec.ts:125,134,143` (assert text absent from `app/page.tsx`), `:250-252` (gate titles that don't match the α/β/γ panels), `:10,100-113` (`page.route()` on `http://localhost:8000/api/v1/**` while the browser calls the relative `/api/proxy/...`)

The Playwright specs assert UI strings that no longer exist and mock a URL the
browser never calls directly (the proxy fetch is server-side, uncatchable by
page-level interception) — so these tests are likely passing vacuously or testing
nothing meaningful.

**Fix:** Update expected strings to the current UI and intercept `/api/proxy/**`.

### FE-C3 · 🟡 Medium · test correctness · e2e mock fixtures don't match `lib/api.ts` types
**Location:** `e2e/sequences.spec.ts:42-81` (`MOCK_CERT_DETAIL` missing `screening_method`, `secureDNA_checked`, `databases_queried`, `gate4`, `gate_mode`, `pq_algorithm`/`pq_is_stub`; `MOCK_HEALTH:83` includes `env` that `HealthResponse` intentionally omits)

**Fix:** Regenerate fixtures from the current types.

### FE-C4 · 🟡 Medium · bug/trust · Register gate badges default to PASS with no data
**Location:** `app/register/page.tsx:455` (`report?.[gateKey]?.status ?? "pass"`)

If the consequence report is missing/partial, every gate row renders ✓ PASS —
the wrong default for a safety UI (also part of FE-T3).

**Fix:** Default to unknown/neutral, never pass.

### FE-C5 · 🔵 Low · bug · `GateProgressTracker` combined β+γ status can mislabel
**Location:** `components/GateProgressTracker.tsx:184-201` (seeds the reducer with `"pass"`; non-done branch also defaults to `"pass"`)

A skipped/pending pair can render as PASS.

**Fix:** Seed from the actual worst status; default to pending/skip.

### FE-C6 · 🔵 Low · bug · Distribution refetch abuses queryKey instead of invalidation
**Location:** `app/sequences/[id]/page.tsx:1130-1138` (bumps a `refetchKey` into the queryKey)

Works, but bypasses React Query's intended `invalidateQueries`.

**Fix:** Use `queryClient.invalidateQueries`.

### FE-C7 · ⚪ Nit · pLDDT strip axis labels use bucket start, not midpoint
**Location:** `app/sequences/[id]/page.tsx:144,149` — "Residue ~N" is off by half a bucket. **Fix:** label with the bucket midpoint.

## 5.5 Low — Accessibility

- **FE-A1 · Low** — `registry/page.tsx:88` sets `cursor:pointer` on a `<tr>` that isn't itself clickable (only inner `<Link>`s). Make the row clickable or drop the cursor.
- **FE-A2 · Low** — Color-only status encoding in `PlddtResidueStrip` (`sequences/[id]/page.tsx:119-124`), `CodonBiasChart.tsx:352-359`, and StatCards. Add text/pattern cues.
- **FE-A3 · Low** — `InfoTooltip.tsx:58` tooltip is `pointer-events-none` and not associated via `aria-describedby`; not AT/keyboard-selectable. Associate via `aria-describedby`.
- **FE-A4 · Low** — Five metadata inputs in `register/page.tsx:337-343` lack `htmlFor`/`id` pairing. Add matching ids.

## 5.6 Low — Performance

- **FE-P1 · Low** — `CodonBiasChart.tsx:224` recomputes an O(protein×pool) scan every render; wrap in `useMemo` keyed on `[original_protein, dna_sequence]`.
- **FE-P2 · Low** — `app/sequences/page.tsx:282` fetches and renders 100 rows unvirtualized; fine now, add row virtualization if counts grow.
- **FE-P3 · Nit** — `sequences/[id]/page.tsx:1257` re-runs `JSON.stringify` each render; `useMemo` if desired.

---

*End of Phase 5.*

---

# Phase 6 — Cross-cutting synthesis

This phase steps back from individual files to the system. It consolidates the
recurring theme, gives a single prioritized "fix first" ordering across all
phases, assesses test coverage, and proposes features.

## Executive summary

ArtGene-Archive / TINSEL is an ambitious, genuinely interesting system with a
**strong foundation**: the WOTS+ and Reed-Solomon implementations are real and
well-tested at the primitive level, the spread-spectrum codon watermark is a
clever idea implemented cleanly, the API has thoughtful auth (hashed keys,
org-scoped 404s, non-spoofable `org_id`), a real DB-level append-only trigger,
proper HMAC key separation, and honest per-module docstrings. The engineering
quality of the *building blocks* is above average for a project this size.

The central risk is not a single bug — it is a **systematic gap between what the
system claims and what it does**. Certificates, the README, and the dashboard
assert cryptographic verification, watermarking-at-registration, mutation-tolerant
forensic tracing, an immutable ledger, and multi-database biosafety screening.
In the implementation, most of those are deferred, stubbed, mocked, or written
but never invoked — while the output is still labeled authoritative ("CERTIFIED",
"● LIVE", "WOTS+ SIGNATURE APPLIED", `gate_mode="real"`). For a system whose
entire purpose is *trustworthy provenance and biosafety*, that gap is the
headline finding: it's a governance/safety problem before it's a code problem.

None of this makes the project unsalvageable — the opposite. The primitives are
there; what's missing is (a) wiring verification and real screening into the live
paths, (b) failing *closed* instead of *open*, and (c) making every trust signal
tell the truth about its own assurance level. Concrete ordering below.

## 6.1 The core theme — claims vs. implementation reality

| Public claim (README / cert / UI) | Implementation reality | Findings |
|---|---|---|
| "Cryptographically verifiable creator attribution" | WOTS+ signs, but **nothing ever verifies** — `verify_certificate` has no call site; no endpoint recomputes the cert hash | API-01, FE-T2 |
| "WOTS+ post-quantum signed" (one-time signature) | `sign_certificate` never passes `event_nonce` → re-signing a registry_id **reuses the one-time key** (forgeable) | CORE-01 |
| "Tamper-evident SHA3-256-chained audit log" | Chain append is not concurrency-safe; revoke/publish **bypass the log entirely**; ORM append-only guard is inert (trigger is the only real protection) | API-02, API-03, API-07 |
| "Every sequence receives a TINSEL watermark" (at registration) | Registration embeds **no watermark**; `tier` hardcoded `STANDARD`; watermarking happens only at distribution | API-10, FE-T3 |
| "Watermark survives re-synthesis and mutation" | `verify-source` uses **exact string equality**; the mutation-tolerant decoder isn't used | API-09 |
| "Four-gate automated biosafety screen" (real) | Prod Gate 2 (SecureDNA/IBBIS) is **always mock**; Gate 1 **fails open to a constant-PASS mock**; Gate 4 uses an uncalibrated metric; Gate 3 skipped for protein input — yet `gate_mode="real"` | GATE-01, GATE-02, GATE-03, GATE-04, GATE-08, FE-T1 |
| "Immutable ledger entry created" / "anchored" (UI) | Shown unconditionally, including for stub signatures; Merkle pathways are stubs | FE-T2, FE-T4, API-19 |
| "Sequences are never stored — only hashes" | Full plaintext protein stored in `watermark_metadata`; every ≤400 AA seq POSTed to a third-party API | API-08, GATE-05 |
| "CERTIFIED" (showcase/registry rows) | Hardcoded regardless of real status; mock data substituted on backend error | FE-T4, FE-T5 |

**The fix pattern is consistent:** either implement the claim on the live path,
or make the claim tell the truth about its assurance level. A single structured
`assurance_level` field (propagated from gates → certificate → compliance doc →
UI badge) would resolve most of the row-by-row mismatches.

## 6.2 Prioritized "fix first" ordering

Ordered by (safety/security impact × how misleading the current state is). This
is the recommended work sequence, not just severity.

### P0 — Do before this is used for anything real
1. **GATE-01 / GATE-02** — Stop labeling mock/failed-open screening as `real`.
   Fail *closed* on ESMFold errors; don't hardcode `use_mock_external=True`;
   gate the `real` label on real external screening actually running.
2. **CORE-01** — Thread `event_nonce` through WOTS+ signing; forbid key reuse per
   registry_id. (One-time-signature key reuse is a break, not a bug.)
3. **API-01** — Implement and expose real certificate verification (recompute
   hash + `PQSigner.verify_certificate`); wire it into the UI and a public
   verifier. Without this the crypto is decorative.
4. **FE-01 / FE-02** — Remove the proxy shared-key fallback for write/revoke and
   never expose an API key via `NEXT_PUBLIC_*`.
5. **FE-T1 / FE-T2 / FE-T3 / FE-T4 / FE-T5** — Make every trust signal honest:
   no "● LIVE"/"CERTIFIED"/"anchored" over stub/mock data; no silent mock-data
   substitution.

### P1 — Correctness & integrity, before scale
6. **CORE-02** — Canonicalize the certificate hash (separators + sorted keys +
   versioned scheme).
7. **API-02 / API-06** — Serialize the audit-chain append (sequence/advisory
   lock/retry) and add a DB unique constraint for dedup.
8. **API-03** — Record revoke/publish in the audit chain.
9. **API-10 / GATE-04** — Store the real tier/chi-squared; translate DNA→protein
   so each gate screens correct input; don't auto-PASS Gate 3 on empty DNA.
10. **API-04 / API-05** — Auth-gate (or scope) the vault/external-hitting demo
    endpoints; move rate limiting to a shared store.
11. **API-08 / GATE-05** — Reconcile the "never stored" claim: encrypt sequences
    at rest and/or disclose the ESMFold third-party data flow.
12. **CORE-04 / CORE-05** — Leap-day validity crash; make `gate_mode` default safe.

### P2 — Hardening, hygiene, maintainability
13. **INFRA-01** — Non-root container user.
14. **API-13 / INFRA-02** — Reconcile the prod vault posture and fix the
    `.env.example` env→gate description.
15. **FE-S1 / FE-S2 / FE-S3** — Dead nav/dark-mode; unify styling; split the
    2.6k-line page.
16. **FE-C1 / FE-C2 / FE-C3** — Server-side registry search; fix the stale e2e
    tests that currently protect nothing.
17. Everything else (dedup helpers, dead code, DRY, a11y, perf, CI gates).

## 6.3 Recurring engineering patterns (root causes)

These show up across packages; fixing the *pattern* prevents recurrence:

- **Fail-open instead of fail-closed.** ESMFold→constant-PASS mock (GATE-02),
  Gate 3 auto-PASS on empty DNA (GATE-04), register gate badges default PASS
  (FE-C4), `gate_mode` defaults `"real"` (CORE-05). A safety system should
  degrade to WARN/FAIL/indeterminate, never to PASS.
- **"Real" is a binary that hides partial mocking.** `gate_mode`/`mock_mode`
  conflate "not the test double" with "actually screened." Replace with a
  structured per-layer assurance level (GATE-08) that propagates to the UI.
- **Write-only / never-invoked security code.** WOTS+ verify (API-01), the
  append-only ORM mixin (API-07), the real SecureDNA/IBBIS/ESM-2 paths
  (`NotImplementedError`). Code that exists but is never called reads as a
  guarantee that isn't there.
- **TOCTOU / missing serialization.** Audit chain (API-02) and dedup (API-06)
  both check-then-act without a lock or DB constraint.
- **Duplication of load-bearing logic.** Heuristics (composition vs
  `compute_real_gate_outputs.py`), GC content (×4), status/tier badges (×5),
  `_gate_summary` (×2), signing-key derivation (demo vs vault). Divergence risk
  on exactly the code that determines outcomes.
- **Docs/labels drift from behavior.** `.env.example` gate mapping, Ed25519
  "fallback", `__license__` MIST vs Apache, "Phase 3c/7" leftovers, p-value
  docstring inversion. Individually minor; collectively they erode trust in the
  docs.

## 6.4 Test coverage assessment

**Well covered (keep it up):** RS codec (systematic encoding, syndromes,
correction at exactly *t* errors, over-*t* raises), spreading code (balance,
determinism, roundtrip), watermark clean roundtrip + wrong-key BER, HMAC
signature determinism/uniqueness, chi-squared covertness, validators, utils. The
`test_security_properties.py` suite is a genuine asset.

**Critical gaps — the highest-severity findings have no tests:**
- **No WOTS+ tests at all** — not keypair uniqueness per nonce (CORE-01), not
  sign→verify roundtrip, not tamper-detection. `TestSignatureUnforgeability`
  tests the *HMAC watermark* signature, not the WOTS+ certificate signature.
- **No certificate-hash canonicalization test** (CORE-02).
- **No audit-chain concurrency test** — `test_register_sequential_ids_increment`
  is serial and won't catch API-02.
- **Real gate paths are never exercised** — the whole suite runs `env=test`
  (all mocks), so GATE-01/02/03/04 (ESMFold fallback, mock-external labeling,
  Gate-4 calibration, DNA-as-protein) are untested. Add tests that run adapters
  with `env="production"`-style wiring and assert fail-closed behavior.
- **No leap-day (CORE-04), dedup-race (API-06), or verify-endpoint (API-01)
  tests.**
- **Frontend has no unit/component tests**, and the e2e specs are stale and
  mock the wrong layer (FE-C2/C3) — effectively zero real frontend coverage.

**Recommendation:** add a `--cov-fail-under` floor, write the WOTS+ and
audit-chain tests first (they guard P0/P1 items), and add a small set of
"assurance/labeling" tests that assert a mock/failed gate never yields a `real`,
PASS certificate.

## 6.5 Suggested features / enhancements

Beyond fixing findings, these would materially strengthen the platform (roughly
high→low leverage):

**Trust & verification**
- **Public, keyless verification endpoint + verifier UI** — recompute cert hash,
  verify WOTS+, walk and verify the audit chain; this is the product's core value
  and is currently absent (API-01).
- **Structured `assurance_level`** on every certificate (which gates ran live vs
  heuristic vs mock, signature real vs stub), surfaced end-to-end.
- **Revocation status endpoint (CRL/OCSP-style)** so synthesizers can check
  live status, plus audit-logged revocations (API-03).
- **Real Merkle pathway trees + inclusion proofs** (API-19), and periodic
  published chain checkpoints (e.g., a signed root) for external anchoring.

**Biosafety depth**
- **Config-gated real integrations** (SecureDNA API, IBBIS `commec`, ESM-2) with
  fail-closed defaults and calibrated thresholds (GATE-01/03).
- **Calibration harness** — evaluate gate FPR/FNR against a benign proteome +
  known-hazard set; publish the operating point (GATE-06).
- **DNA↔protein translation in the pipeline** so all four gates apply to both
  input types (GATE-04).

**Platform / ops**
- Redis-backed rate limiting (API-05); **key rotation & versioning** for
  spreading/signing keys; sequence **encryption at rest** (API-08); request-ID
  logging, metrics, and tracing; SBOM + secret-scanning + enforced `npm
  audit`/bandit in CI (INFRA-03).
- Scoped/role-based API keys (read vs write vs admin) so a public demo key can't
  register/revoke (ties to FE-01).
- Cursor pagination + server-side search on the registry (FE-C1).

**Frontend**
- Working theme toggle (FE-S1), unified design system (FE-S2), real certificate
  download, list virtualization, and an accessibility pass (FE-A*).

## 6.6 What's genuinely good (keep these)

So the report isn't only a defect list — deliberate strengths worth preserving:
real WOTS+/RS/spreading primitives with property tests; hashed, org-scoped API
keys with existence-non-leaking 404s; the DB-level append-only trigger; HMAC key
separation between spreading and signing keys; production guard on the dev
spreading key; honest per-adapter docstrings; a clean adapter/ABC gate
architecture with DI; a typed API client mirroring the backend schemas; correct
HTML-escaping in the JSON viewer; and a real CI matrix (ruff + bandit + mypy-
strict + pytest + dashboard build). The bones are good.

## 6.7 Review stats

- **Scope reviewed:** all 4 Python packages (~11.9k LOC) + the Next.js dashboard
  (~10.4k LOC) + infra/CI/docker/migrations.
- **Findings:** ~90 total — Phase 1 (16), Phase 2 (23), Phase 3 (13), Phase 4 (8),
  Phase 5 (~30).
- **Severity mix:** a handful of Critical/High concentrated in crypto invocation,
  audit-chain integrity, gate authenticity, and frontend trust signals; the
  majority are Medium/Low correctness, DRY, and hygiene items.
- **One-line takeaway:** *Solid primitives; the work now is to make the live
  paths and every trust signal actually deliver — and honestly label — what the
  system claims.*

---

*End of review. All six phases complete. This document is advisory only — no
application code was modified.*
