"""TINSELEncoder — high-level watermark encoding API.

Wraps the low-level ``tinsel.watermark.encoder`` functions and produces
an :class:`EncodeResult` with carrier count, chi-squared deviation, and
tier classification.

Chi-squared computation
-----------------------
For each amino acid with a synonymous codon pool of size k > 1, the
expected codon frequency under a *uniform* distribution is 1/k.  We
compute the chi-squared statistic per pool and sum contributions:

    χ² = Σ_aa Σ_codon  (observed − expected)² / expected

A low chi-squared (< 0.08) indicates the watermark is well-concealed
within natural codon-usage variation (FULL tier).  Higher values reflect
stronger statistical bias — an unavoidable trade-off for MINIMAL tier
sequences with few carrier positions.
"""

from __future__ import annotations

import hashlib

from tinsel.registry import EncodeResult, WatermarkTier, select_tier
from tinsel.watermark.encoder import CODON_POOLS, encode, watermark_capacity


def _chi_squared(dna: str, protein: str) -> float:
    """Compute codon-usage chi-squared deviation from uniform expectation."""
    dna = dna.upper()
    protein = protein.upper()
    total_chi2 = 0.0

    for aa in set(protein):
        pool = CODON_POOLS.get(aa, [])
        if len(pool) <= 1:
            continue

        counts: dict[str, int] = {codon: 0 for codon in pool}
        for i, paa in enumerate(protein):
            if paa == aa:
                codon = dna[i * 3 : i * 3 + 3]
                if codon in counts:
                    counts[codon] += 1

        n = sum(counts.values())
        if n == 0:
            continue

        expected = n / len(pool)
        for obs in counts.values():
            total_chi2 += (obs - expected) ** 2 / expected

    return round(total_chi2, 6)


class TINSELEncoder:
    """Encode a protein sequence with the TINSEL codon-spreading watermark.

    Parameters
    ----------
    spreading_key:
        32-byte secret key used to derive the per-position key stream.
    spreading_key_id:
        Identifier of the key (used to reconstruct the key stream later).
    """

    def __init__(self, spreading_key: bytes, spreading_key_id: str) -> None:
        if len(spreading_key) != 32:
            raise ValueError("spreading_key must be exactly 32 bytes")
        self._key = spreading_key
        self._key_id = spreading_key_id

    def encode(self, protein: str, watermark_id: str) -> EncodeResult:
        """Watermark *protein* under *watermark_id* and return an :class:`EncodeResult`.

        Parameters
        ----------
        protein:
            Single-letter amino-acid sequence (upper-case, no gaps).
        watermark_id:
            Unique registry identifier (e.g. ``"AG-2027-000001"``).

        Returns
        -------
        EncodeResult
            Contains the watermarked DNA, capacity, chi-squared, and tier.
        """
        protein = protein.upper().strip()
        dna = encode(protein, self._key, watermark_id)
        capacity = watermark_capacity(protein)
        chi2 = _chi_squared(dna, protein)
        tier = select_tier(capacity)

        return EncodeResult(
            original_protein=protein,
            watermarked_dna=dna,
            watermark_id=watermark_id,
            carrier_positions=capacity,
            chi_squared=chi2,
            tier=tier,
            spreading_key_id=self._key_id,
        )

    def sequence_hash(self, protein: str) -> str:
        """SHA3-256 hex digest of the protein sequence (used as DB key)."""
        return hashlib.sha3_256(protein.upper().encode()).hexdigest()
