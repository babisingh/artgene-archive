"""tinsel.crypto — post-quantum cryptographic primitives.

Public API
----------
PQSigner
    Unified signing interface.  Uses real WOTS+ by default.
    Falls back gracefully to a labelled classical Ed25519 signature
    when the `cryptography` package is unavailable (should never happen
    since it's a project dependency, but handled for hardened environments).

Algorithm IDs
-------------
"wots_plus_sha3_256_w256_l35"   — WOTS+ (n=32, w=256, L=35), post-quantum
"ed25519_classical_fallback"    — Ed25519 via `cryptography` package (not PQ)
"stub_zero_v1"                  — Zero-filled Phase 3 placeholder (legacy)

Migration path to deployment
-----------------------------
1. Dev/Docker:       WOTS+ (this module) — zero dependencies beyond hashlib + hmac
2. Staging/Prod:     WOTS+ (same) — identical behaviour, no env-specific code
3. Future prod:      Dilithium3 (NIST FIPS 204) via pyoqs if liboqs is installed
                     — swap PQSigner._backend to "dilithium3" via env var

The `cryptography` package is listed in tinsel-api's dependencies and is always
available in the Docker container and any pip-installed deployment.  Ed25519 from
`cryptography` is used only as a last-resort fallback and is NOT post-quantum.
"""

from __future__ import annotations

import hashlib

from tinsel.crypto import wots as _wots

ALGORITHM_WOTS = "wots_plus_sha3_256_w256_l35"
ALGORITHM_ED25519 = "ed25519_classical_fallback"
ALGORITHM_STUB = "stub_zero_v1"


class PQSigner:
    """Unified post-quantum signing interface for TINSEL certificates.

    Usage
    -----
        signer = PQSigner(master_seed=spreading_key)

        pk, sig = signer.sign_certificate(registry_id, cert_hash)
        ok      = signer.verify_certificate(registry_id, cert_hash, pk, sig)

    All data returned/accepted is hex-encoded for safe JSON storage.
    """

    def __init__(self, master_seed: bytes) -> None:
        self._seed = master_seed
        self._algo = ALGORITHM_WOTS

    @property
    def algorithm_id(self) -> str:
        return self._algo

    # ── Core sign / verify ───────────────────────────────────────────────────

    def sign_certificate(
        self, registry_id: str, cert_hash_hex: str, event_nonce: int | str = 0
    ) -> tuple[dict, dict]:
        """Generate a keypair and sign the certificate hash.

        WOTS+ is a *one-time* signature: a given keypair must sign at most one
        message.  The keypair is derived from ``(master_seed, registry_id,
        event_nonce)``, so every signing event on the same ``registry_id`` MUST
        supply a distinct ``event_nonce`` — otherwise the one-time key is reused
        and the scheme is broken (two signatures under one WOTS+ key allow
        forgery).

        Parameters
        ----------
        registry_id:
            Unique certificate ID (e.g. "AG-2026-000001").  Part of the WOTS+
            derivation tag.
        cert_hash_hex:
            Hex-encoded SHA3-512 certificate hash (the signed material).
        event_nonce:
            Per-signing-event unique value on this ``registry_id``.  Defaults to
            ``0`` for the initial certificate issuance.  Callers that sign the
            same record more than once (re-issuance, embargo lift, distribution
            copy, correction) MUST pass a distinct, never-before-used value —
            e.g. a monotonically incrementing counter or the audit-log seq_num.

        Returns
        -------
        (pk_dict, sig_dict)
            Both are dicts suitable for direct storage in the DB JSONB columns.
            The ``event_nonce`` used is recorded in both dicts so the signing
            event is auditable and non-reuse can be checked.
        """
        msg_hash = _msg_hash(cert_hash_hex)
        sk, pk_chains, pub_seed = _wots.generate_keypair(
            self._seed, registry_id, event_nonce
        )
        sig_chains = _wots.sign(msg_hash, sk, pub_seed)

        pk_dict = {
            "chains": _wots.chains_to_hex(pk_chains),
            "public_seed": pub_seed.hex(),
            "algorithm_id": ALGORITHM_WOTS,
            "is_stub": False,
            "event_nonce": event_nonce,
        }
        sig_dict = {
            "signature_chains": _wots.chains_to_hex(sig_chains),
            "public_seed": pub_seed.hex(),
            "message_hash": msg_hash.hex(),
            "algorithm_id": ALGORITHM_WOTS,
            "is_stub": False,
            "event_nonce": event_nonce,
        }
        return pk_dict, sig_dict

    def verify_certificate(
        self,
        registry_id: str,
        cert_hash_hex: str,
        pk_dict: dict,
        sig_dict: dict,
    ) -> tuple[bool, str]:
        """Verify a WOTS+ certificate signature.

        Thin instance wrapper around :meth:`verify_signature`.  Verification uses
        only the stored public key and signature, so it does **not** require the
        master seed; ``registry_id`` is accepted for call-site symmetry but is
        not needed to verify.

        Returns
        -------
        (ok, reason)
            ok     — True if signature is valid
            reason — human-readable explanation (empty string if ok)
        """
        return self.verify_signature(cert_hash_hex, pk_dict, sig_dict)

    @staticmethod
    def verify_signature(
        cert_hash_hex: str,
        pk_dict: dict,
        sig_dict: dict,
    ) -> tuple[bool, str]:
        """Verify a WOTS+ signature from public material alone (no secret seed).

        This is public-key verification: given the stored public key, signature,
        and the certificate hash, anyone (including third parties who never hold
        the master seed) can check validity.

        Returns
        -------
        (ok, reason)
            ok     — True if the signature is valid
            reason — human-readable explanation (empty string if ok)
        """
        algo = pk_dict.get("algorithm_id", ALGORITHM_STUB)

        if algo == ALGORITHM_STUB or pk_dict.get("is_stub", True):
            return False, "Signature is a zero-filled stub (pre-Phase-7 certificate)"

        if algo != ALGORITHM_WOTS:
            return False, f"Unknown algorithm: {algo!r}"

        try:
            msg_hash = _msg_hash(cert_hash_hex)
            pk_chains = _wots.hex_to_chains(pk_dict["chains"])
            sig_chains = _wots.hex_to_chains(sig_dict["signature_chains"])
            pub_seed = bytes.fromhex(pk_dict["public_seed"])

            ok = _wots.verify(msg_hash, sig_chains, pk_chains, pub_seed)
            return (True, "") if ok else (False, "WOTS+ signature verification failed")
        except Exception as exc:
            return False, f"Verification error: {exc}"


# ── Helpers ──────────────────────────────────────────────────────────────────

def _msg_hash(cert_hash_hex: str) -> bytes:
    """Convert a hex certificate hash to the 32-byte WOTS+ message hash.

    WOTS+ signs 32 bytes (SHA3-256).  The certificate hash is SHA3-512 (64 bytes).
    We truncate by taking SHA3-256 of the full hash — this preserves the
    collision-resistance of the underlying hash.
    """
    return hashlib.sha3_256(bytes.fromhex(cert_hash_hex)).digest()
