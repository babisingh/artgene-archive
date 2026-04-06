"""
TINSEL spreading-key watermark encoder (Phase 0 scaffold).

This module implements the core synonymous-codon spreading that embeds a
traceable watermark into a protein-coding DNA sequence.  The cryptographic
binding layer (W-OTS+, LWE commitment, Merkle pathway) is implemented in
Phase 1 (tinsel.crypto).

Algorithm overview
------------------
1. For each amino acid in the protein sequence, look up the pool of
   synonymous codons.
2. Derive a per-position key stream from HMAC-SHA3-256(spreading_key,
   watermark_id) via a counter-mode expansion.
3. Select the codon whose index into the pool equals key_stream[i] % len(pool).
4. The resulting DNA string is the watermarked sequence.  Recovery is
   deterministic given the same key and watermark_id.

One-time property
-----------------
The watermark_id MUST be unique per registration.  Reusing (key, id)
produces identical codon choices and destroys the one-time property needed
for later forensic attribution.  In production the registry counter
(registry_audit_log.seq_num) is used to derive a unique id per certificate.
"""

from __future__ import annotations

import hashlib
import hmac
from typing import Final

# ---------------------------------------------------------------------------
# Synonymous codon pools
# All 20 standard amino acids + stop (*) mapped to their NCBI standard codons.
# Single-codon AAs (M, W) have pool size 1 and carry no watermark information.
# ---------------------------------------------------------------------------
CODON_POOLS: Final[dict[str, list[str]]] = {
    "A": ["GCT", "GCC", "GCA", "GCG"],
    "C": ["TGT", "TGC"],
    "D": ["GAT", "GAC"],
    "E": ["GAA", "GAG"],
    "F": ["TTT", "TTC"],
    "G": ["GGT", "GGC", "GGA", "GGG"],
    "H": ["CAT", "CAC"],
    "I": ["ATT", "ATC", "ATA"],
    "K": ["AAA", "AAG"],
    "L": ["TTA", "TTG", "CTT", "CTC", "CTA", "CTG"],
    "M": ["ATG"],
    "N": ["AAT", "AAC"],
    "P": ["CCT", "CCC", "CCA", "CCG"],
    "Q": ["CAA", "CAG"],
    "R": ["CGT", "CGC", "CGA", "CGG", "AGA", "AGG"],
    "S": ["TCT", "TCC", "TCA", "TCG", "AGT", "AGC"],
    "T": ["ACT", "ACC", "ACA", "ACG"],
    "V": ["GTT", "GTC", "GTA", "GTG"],
    "W": ["TGG"],
    "Y": ["TAT", "TAC"],
    "*": ["TAA", "TAG", "TGA"],
}

_CODON_TO_AA: dict[str, str] = {
    codon: aa for aa, pool in CODON_POOLS.items() for codon in pool
}


def _key_stream(spreading_key: bytes, watermark_id: str, length: int) -> list[int]:
    """Expand (spreading_key, watermark_id) into *length* pseudo-random bytes.

    Uses counter-mode HMAC-SHA3-256 so every byte is unpredictable without
    the key, and the stream is fully deterministic given the same inputs.
    """
    label = watermark_id.encode("utf-8")
    stream: list[int] = []
    counter = 0
    while len(stream) < length:
        msg = label + counter.to_bytes(4, "big")
        block = hmac.new(spreading_key, msg, hashlib.sha3_256).digest()
        stream.extend(block)
        counter += 1
    return stream[:length]


def encode(protein: str, spreading_key: bytes, watermark_id: str) -> str:
    """Encode *protein* to a watermarked DNA string.

    Parameters
    ----------
    protein:
        Single-letter amino acid sequence (upper-case, no gaps).
    spreading_key:
        32-byte secret key (HMAC key material).
    watermark_id:
        Unique identifier for this registration (e.g. "AG-2027-000001").

    Returns
    -------
    str
        Watermarked DNA sequence (length = 3 × len(protein)).
    """
    protein = protein.upper().strip()
    ks = _key_stream(spreading_key, watermark_id, len(protein))
    codons: list[str] = []
    for aa, k in zip(protein, ks):
        pool = CODON_POOLS.get(aa)
        if pool is None:
            raise ValueError(f"Unknown amino acid '{aa}' in sequence")
        codons.append(pool[k % len(pool)])
    return "".join(codons)


def decode_protein(dna: str) -> str:
    """Translate a DNA string back to its protein sequence (no gaps, no stop)."""
    dna = dna.upper().strip()
    if len(dna) % 3 != 0:
        raise ValueError(f"DNA length {len(dna)} is not a multiple of 3")
    protein: list[str] = []
    for i in range(0, len(dna), 3):
        codon = dna[i : i + 3]
        aa = _CODON_TO_AA.get(codon)
        if aa is None:
            raise ValueError(f"Unknown codon '{codon}' at position {i}")
        if aa == "*":
            break
        protein.append(aa)
    return "".join(protein)


def verify(dna: str, spreading_key: bytes, watermark_id: str, original_protein: str) -> bool:
    """Return True if *dna* was produced by encode(original_protein, key, watermark_id).

    This is a clean-channel verification: given the secret key and the
    claimed watermark_id we re-encode the protein and compare exactly.
    The forensic (noisy-channel) decoder that survives mutations is
    implemented in Phase 2 (tinsel.crypto.spreading).
    """
    expected = encode(original_protein, spreading_key, watermark_id)
    return dna == expected


def watermark_capacity(protein: str) -> int:
    """Return the number of watermark bits carried by *protein*.

    Each synonymous position contributes floor(log2(pool_size)) bits.
    M and W contribute 0 bits (single-codon amino acids).
    """
    bits = 0
    for aa in protein.upper():
        pool = CODON_POOLS.get(aa, [])
        size = len(pool)
        if size >= 2:
            bits += size.bit_length() - 1
    return bits
