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
| 2 | `tinsel-api` (routes, auth, vault, DB models + migrations, rate limiting) | ⏳ Pending |
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

*End of Phase 1. Phase 2 (`tinsel-api`) pending your go-ahead.*
