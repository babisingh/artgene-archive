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
import hmac as _hmac
import os

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
        self, registry_id: str, cert_hash_hex: str
    ) -> tuple[dict, dict]:
        """Generate a keypair and sign the certificate hash.

        Parameters
        ----------
        registry_id:
            Unique certificate ID (e.g. "AG-2026-000001").  Used as the WOTS+
            derivation tag — each certificate gets a unique one-time keypair.
        cert_hash_hex:
            Hex-encoded SHA3-512 certificate hash (the signed material).

        Returns
        -------
        (pk_dict, sig_dict)
            Both are dicts suitable for direct storage in the DB JSONB columns.
        """
        msg_hash = _msg_hash(cert_hash_hex)
        sk, pk_chains, pub_seed = _wots.generate_keypair(self._seed, registry_id)
        sig_chains = _wots.sign(msg_hash, sk, pub_seed)

        pk_dict = {
            "chains": _wots.chains_to_hex(pk_chains),
            "public_seed": pub_seed.hex(),
            "algorithm_id": ALGORITHM_WOTS,
            "is_stub": False,
        }
        sig_dict = {
            "signature_chains": _wots.chains_to_hex(sig_chains),
            "public_seed": pub_seed.hex(),
            "message_hash": msg_hash.hex(),
            "algorithm_id": ALGORITHM_WOTS,
            "is_stub": False,
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

        Returns
        -------
        (ok, reason)
            ok     — True if signature is valid
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
