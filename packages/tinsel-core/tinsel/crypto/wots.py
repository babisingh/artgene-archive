"""WOTS+ one-time signature scheme (hash-based, post-quantum secure).

Parameters
----------
n       = 32  — security parameter in bytes; SHA3-256 output size
w       = 256 — Winternitz parameter (trade-off: higher w = fewer chains, bigger sigs)
len1    = 32  — chains for the message   : ceil(8*n / log2(w)) = ceil(256/8) = 32
len2    = 3   — chains for the checksum  : floor(log2(len1*(w-1)) / log2(w)) + 1 + 1
               (one extra chain vs minimal, providing ~8-bit extra checksum coverage)
WOTS_L  = 35  — total chains (len1 + len2)

Each chain is a SHA3-256 value (32 bytes), so the public key and signature
are each 35 × 32 = 1120 bytes.

Security
--------
Post-quantum secure under the assumption that SHA3-256 is a one-way function.
The bitmask XOR in the chain hash prevents multi-target attacks (WOTS → WOTS+).
This is a one-time signature scheme: each keypair MUST sign at most one message.
Deterministic keypair derivation ensures the one-time property is maintained by
design — every (registry_id, master_seed) pair produces a unique keypair.

References
----------
Hülsing (2013) "W-OTS+ – Shorter Signatures for Hash-Based Signature Schemes"
Bernstein et al. (2019) "SPHINCS+ — Stateless Hash-Based Signatures" (NIST)
"""

from __future__ import annotations

import hashlib
import hmac
import secrets

# ── WOTS+ parameters ─────────────────────────────────────────────────────────

N       = 32    # hash output bytes (SHA3-256)
W       = 256   # Winternitz parameter
LOG2_W  = 8     # log2(256)
LEN1    = 32    # message chains: ceil(8*N / LOG2_W) = ceil(256/8) = 32
LEN2    = 3     # checksum chains (one more than minimal for security margin)
WOTS_L  = 35    # total chains: LEN1 + LEN2


# ── Primitives ────────────────────────────────────────────────────────────────

def _sha3(data: bytes) -> bytes:
    return hashlib.sha3_256(data).digest()


def _prf(seed: bytes, idx: int) -> bytes:
    """Pseudorandom function: SHA3-256(seed ‖ idx as 4 bytes)."""
    return _sha3(seed + idx.to_bytes(4, "big"))


def _chain(x: bytes, start: int, steps: int, pub_seed: bytes, chain_idx: int) -> bytes:
    """Apply (steps) WOTS+ chain hash iterations starting from position (start).

    Each step:
      1. Generate bitmask B = PRF(pub_seed, chain_idx * W + position)
      2. XOR input with bitmask
      3. SHA3-256(result)

    The bitmask XOR prevents the multi-target attacks that would break plain WOTS.
    """
    result = x
    for position in range(start, start + steps):
        bitmask = _prf(pub_seed, chain_idx * W + position)
        xored = bytes(a ^ b for a, b in zip(result, bitmask))
        result = _sha3(xored)
    return result


# ── Keypair generation ────────────────────────────────────────────────────────

def generate_keypair(master_seed: bytes, tag: str) -> tuple[list[bytes], list[bytes], bytes]:
    """Generate a WOTS+ keypair deterministically from (master_seed, tag).

    The per-certificate seed is:
        cert_seed = HMAC-SHA3-256(key=master_seed, msg=f"wots:{tag}")

    Returns
    -------
    (sk_chains, pk_chains, pub_seed)
        sk_chains: WOTS_L × N-byte private key chains
        pk_chains: WOTS_L × N-byte public key chains (top of each hash chain)
        pub_seed:  N-byte seed used for bitmask generation (public)
    """
    # Derive per-tag seed + public seed
    cert_seed = hmac.new(
        master_seed, f"wots:{tag}".encode(), "sha3_256"
    ).digest()
    pub_seed = _prf(cert_seed, 0xFFFFFFFF)  # public seed from a distinguished index

    # Private key chains: each is PRF(cert_seed, i)
    sk_chains = [_prf(cert_seed, i) for i in range(WOTS_L)]

    # Public key chains: hash each SK chain W-1 times (from pos 0 to W-1)
    pk_chains = [_chain(sk, 0, W - 1, pub_seed, i) for i, sk in enumerate(sk_chains)]

    return sk_chains, pk_chains, pub_seed


# ── Message encoding ──────────────────────────────────────────────────────────

def _msg_to_digits(msg_hash: bytes) -> list[int]:
    """Convert 32-byte message hash to LEN1+LEN2 base-W digits.

    First LEN1=32 digits: each byte of the hash (already base-256).
    Last LEN2=3  digits:  base-256 encoding of the 2-byte checksum
                           (zero-padded to 3 digits).
    """
    assert len(msg_hash) == N
    msg_digits = list(msg_hash)                                       # 32 digits

    checksum = sum(W - 1 - d for d in msg_digits)                    # ≤ 32*255 = 8160
    # Encode checksum in 3 base-256 digits (big-endian; top digit always 0)
    c2 = checksum & 0xFF
    c1 = (checksum >> 8) & 0xFF
    c0 = 0  # max checksum is 8160 < 2^16; third digit always 0
    checksum_digits = [c0, c1, c2]

    return msg_digits + checksum_digits  # 35 digits


# ── Sign ─────────────────────────────────────────────────────────────────────

def sign(
    msg_hash: bytes,
    sk_chains: list[bytes],
    pub_seed: bytes,
) -> list[bytes]:
    """Sign a message hash with WOTS+ private key chains.

    For each chain i: compute chain from position 0 to digit[i]-1.
    The signature chain is at position (digit[i]) in the hash chain.
    """
    digits = _msg_to_digits(msg_hash)
    return [
        _chain(sk, 0, digits[i], pub_seed, i)
        for i, sk in enumerate(sk_chains)
    ]


# ── Verify ────────────────────────────────────────────────────────────────────

def verify(
    msg_hash: bytes,
    sig_chains: list[bytes],
    pk_chains: list[bytes],
    pub_seed: bytes,
) -> bool:
    """Verify a WOTS+ signature.

    For each chain i: compute chain from position digit[i] to W-1.
    If the result equals pk_chains[i], the signature is valid.
    """
    if len(sig_chains) != WOTS_L or len(pk_chains) != WOTS_L:
        return False

    digits = _msg_to_digits(msg_hash)
    for i, (sig, pk) in enumerate(zip(sig_chains, pk_chains)):
        remaining = W - 1 - digits[i]
        expected_pk = _chain(sig, digits[i], remaining, pub_seed, i)
        if not hmac.compare_digest(expected_pk, pk):
            return False
    return True


# ── Helpers for serialisation ─────────────────────────────────────────────────

def chains_to_hex(chains: list[bytes]) -> list[str]:
    """Encode chain list as hex strings."""
    return [c.hex() for c in chains]


def hex_to_chains(hex_chains: list[str]) -> list[bytes]:
    """Decode hex strings to chain bytes list."""
    return [bytes.fromhex(h) for h in hex_chains]
