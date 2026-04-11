"""TINSELEncoder — high-level watermark encoding API (v1.0).

Provides two compatible interfaces:

**Legacy interface (v0.x, preserved for compatibility)**
    enc = TINSELEncoder(spreading_key, spreading_key_id)
    result: EncodeResult = enc.encode(protein, watermark_id)

**New interface (v1.0)**
    enc = TINSELEncoder(spreading_key, signing_key=signing_key)
    result: WatermarkResult = enc.encode(
        protein, owner_id, timestamp_str, ethics_code,
        organism=HostOrganism.ECOLI, rng_seed=42
    )
    cap:    CapacityReport  = enc.check_capacity(protein)

Algorithm (v1.0 encode)
-----------------------
1.  Build the AnchorMap: collect all synonymous carrier positions.
2.  Compute capacity and select tier.
3.  Derive the short signature:
        sig = HMAC-SHA3-256(signing_key, owner_id ‖ timestamp_str ‖ ethics_code)
              [:sig_bytes]
4.  Apply Reed-Solomon (if tier != DEMO) to produce a codeword.
5.  Spread the codeword bits with the spreading code:
        spread = SpreadingCodeGenerator(spreading_key).spread(codeword_bits, label)
6.  Embed the spread bits into codon choices at carrier positions.
7.  Compute CodonBiasMetrics (chi-squared, p-value).

Security note
-------------
The signing_key is used only for HMAC-based signature generation.
It MUST be different from the spreading_key.  Reusing keys breaks
the independence between the embedding channel and the authentication
tag.  In production, derive both from a master secret using HKDF with
different info labels.
"""

from __future__ import annotations

import hashlib
import hmac
import math

import numpy as np

from tinsel.registry import (
    TIER_RS_PARAMS,
    TIER_SIG_BYTES,
    AnchorMap,
    CapacityReport,
    CodonBiasMetrics,
    EncodeResult,
    HostOrganism,
    WatermarkConfig,
    WatermarkResult,
    WatermarkTier,
    select_tier,
)
from tinsel.watermark.encoder import CODON_POOLS, watermark_capacity
from tinsel.watermark.rs_codec import RSCodec
from tinsel.watermark.spreading import SpreadingCodeGenerator

# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _chi_squared(dna: str, protein: str) -> float:
    """Compute codon-usage chi-squared deviation from the uniform expected frequency."""
    dna = dna.upper()
    protein = protein.upper()
    total = 0.0
    for aa in set(protein):
        pool = CODON_POOLS.get(aa, [])
        if len(pool) <= 1:
            continue
        counts: dict[str, int] = {codon: 0 for codon in pool}
        for i, paa in enumerate(protein):
            if paa == aa:
                codon = dna[i * 3: i * 3 + 3]
                if codon in counts:
                    counts[codon] += 1
        n = sum(counts.values())
        if n == 0:
            continue
        expected = n / len(pool)
        for obs in counts.values():
            total += (obs - expected) ** 2 / expected
    return round(total, 6)


def _chi2_p_value(chi2: float, df: int) -> float:
    """Wilson-Hilferty normal approximation for the chi-squared CDF p-value.

    Returns P(χ²_df ≤ chi2), i.e. the CDF.  A p-value > 0.05 means we
    cannot reject the null hypothesis of uniform codon usage (covert watermark).
    """
    if df <= 0:
        return 1.0
    # Normalised chi-squared z-score via Wilson-Hilferty
    mu = df
    h = 1 - 2 / (9 * df)
    k = math.sqrt(2 / (9 * df))
    z = ((chi2 / mu) ** (1 / 3) - h) / k
    # Survival function approximation (1 - Φ(z)) using erfc
    p_value_upper = 0.5 * math.erfc(z / math.sqrt(2))
    return round(p_value_upper, 6)


def _build_anchor_map(protein: str) -> AnchorMap:
    """Return the AnchorMap for *protein* (all synonymous carrier positions)."""
    indices = []
    sizes = []
    for i, aa in enumerate(protein.upper()):
        pool = CODON_POOLS.get(aa, [])
        if len(pool) >= 2:
            indices.append(i)
            sizes.append(len(pool))
    return AnchorMap(
        carrier_indices=indices,
        pool_sizes=sizes,
        protein_length=len(protein),
    )


def _codon_bias_metrics(dna: str, protein: str) -> CodonBiasMetrics:
    """Compute chi-squared, Wilson-Hilferty p-value, and per-AA deviations."""
    dna = dna.upper()
    protein = protein.upper()
    chi2 = _chi_squared(dna, protein)

    # Degrees of freedom: Σ_aa (pool_size - 1)
    df = sum(
        len(CODON_POOLS.get(aa, [])) - 1
        for aa in set(protein)
        if len(CODON_POOLS.get(aa, [])) > 1
    )
    p_val = _chi2_p_value(chi2, df)

    # Per-AA maximum fractional deviation from uniform expectation
    per_aa: dict[str, float] = {}
    for aa in set(protein):
        pool = CODON_POOLS.get(aa, [])
        if len(pool) <= 1:
            continue
        counts: dict[str, int] = {c: 0 for c in pool}
        for i, paa in enumerate(protein):
            if paa == aa:
                c = dna[i * 3: i * 3 + 3]
                if c in counts:
                    counts[c] += 1
        n = sum(counts.values())
        if n == 0:
            continue
        expected_frac = 1.0 / len(pool)
        max_dev = max(abs(obs / n - expected_frac) for obs in counts.values())
        per_aa[aa] = round(max_dev * 100, 2)  # express as percentage points

    return CodonBiasMetrics(
        chi_squared=chi2,
        p_value=p_val,
        is_covert=p_val > 0.05,
        per_aa_deviations=per_aa,
    )


def _derive_signature(
    signing_key: bytes, owner_id: str, timestamp_str: str, ethics_code: str, sig_bytes: int
) -> bytes:
    """Derive a short deterministic signature from owner metadata."""
    label = (owner_id + "|" + timestamp_str + "|" + ethics_code).encode("utf-8")
    full = hmac.new(signing_key, label, hashlib.sha3_256).digest()
    return full[:sig_bytes]


def _embed_bits(protein: str, bits: np.ndarray, rng_seed: int = 0) -> str:
    """Embed *bits* into the protein codon choices at synonymous positions.

    For each carrier position, the bit value selects which codon in the pool
    to use (bit % pool_size → pool index).  The remaining higher-order
    pseudo-random entropy is filled from a seeded PRNG to keep usage
    statistically uniform within large pools.

    Parameters
    ----------
    protein:
        Amino-acid sequence (upper-case).
    bits:
        Binary array of length ≤ n_carriers.  Positions beyond len(bits)
        get pseudo-random fill.
    rng_seed:
        Seed for the fill PRNG.

    Returns
    -------
    str
        Watermarked DNA sequence.
    """
    rng = np.random.default_rng(rng_seed)
    protein = protein.upper()
    codons = []
    bit_idx = 0
    for aa in protein:
        pool = CODON_POOLS.get(aa)
        if pool is None:
            raise ValueError(f"Unknown amino acid '{aa}'")
        if len(pool) == 1:
            codons.append(pool[0])
        else:
            if bit_idx < len(bits):
                idx = int(bits[bit_idx]) % len(pool)
                bit_idx += 1
            else:
                idx = int(rng.integers(len(pool)))
            codons.append(pool[idx])
    return "".join(codons)


def _extract_bits(dna: str, protein: str) -> np.ndarray:
    """Extract the codon-choice bit stream from a watermarked DNA string.

    For each synonymous carrier position, the codon's index within the
    pool (mod 2, i.e., the LSB) is recorded as a bit.  This mirrors the
    embedding logic for pool sizes ≥ 2.
    """
    protein = protein.upper()
    dna = dna.upper()
    bits = []
    for i, aa in enumerate(protein):
        pool = CODON_POOLS.get(aa, [])
        if len(pool) >= 2:
            codon = dna[i * 3: i * 3 + 3]
            if codon in pool:
                bits.append(pool.index(codon) % 2)
            else:
                bits.append(0)
    return np.array(bits, dtype=np.uint8)


# ---------------------------------------------------------------------------
# Public class
# ---------------------------------------------------------------------------

class TINSELEncoder:
    """Encode a protein sequence with the TINSEL codon-spreading watermark.

    Parameters
    ----------
    spreading_key:
        32-byte secret key used to derive the per-position spreading code.
    spreading_key_id:
        (Legacy) string identifier of the key (used in the old EncodeResult).
        Ignored when ``signing_key`` is provided.
    signing_key:
        32-byte secret key used to generate the short authentication
        signature embedded in the watermark.  When provided, the v1.0
        encode/check_capacity API is activated.

    Security warning
    ----------------
    ``spreading_key`` and ``signing_key`` MUST be different.  Never derive
    both from the same raw secret without proper key separation.
    """

    def __init__(
        self,
        spreading_key: bytes,
        spreading_key_id: str = "",
        *,
        signing_key: bytes | None = None,
    ) -> None:
        if len(spreading_key) != 32:
            raise ValueError("spreading_key must be exactly 32 bytes")
        if signing_key is not None:
            if len(signing_key) != 32:
                raise ValueError("signing_key must be exactly 32 bytes")
            if spreading_key == signing_key:
                raise ValueError("spreading_key and signing_key must differ")
        self._spreading_key = spreading_key
        self._key_id = spreading_key_id
        self._signing_key = signing_key
        self._spreading_gen = SpreadingCodeGenerator(spreading_key)

    # ------------------------------------------------------------------
    # v1.0 API
    # ------------------------------------------------------------------

    def check_capacity(self, protein: str) -> CapacityReport:
        """Return the capacity report for *protein*.

        Parameters
        ----------
        protein:
            Single-letter amino-acid sequence (upper-case, no gaps).

        Returns
        -------
        CapacityReport
            Includes tier, number of carrier positions, and sig_bits.
        """
        protein = protein.upper().strip()
        capacity = watermark_capacity(protein)
        tier = select_tier(capacity)
        sig_bytes = TIER_SIG_BYTES.get(tier, 0)
        reason = None
        if tier == WatermarkTier.REJECTED:
            reason = (
                f"Sequence has only {capacity} carrier bits "
                f"(minimum {TIER_SIG_BYTES[WatermarkTier.DEMO] * 8} required)"
            )
        return CapacityReport(
            tier=tier,
            sig_bits=sig_bytes * 8,
            capacity_ok=tier != WatermarkTier.REJECTED,
            n_carrier_positions=capacity,
            rejection_reason=reason,
        )

    def encode_v1(
        self,
        protein: str,
        owner_id: str,
        timestamp_str: str,
        ethics_code: str,
        organism: HostOrganism = HostOrganism.ECOLI,
        rng_seed: int = 0,
    ) -> WatermarkResult:
        """Watermark *protein* with a cryptographically bound signature.

        .. warning::
            Requires ``signing_key`` to be set at construction time.

        Parameters
        ----------
        protein:
            Single-letter amino-acid sequence (upper-case, no gaps).
        owner_id:
            Registered owner identifier (e.g. ``"OWNER_A"``).
        timestamp_str:
            ISO-8601 timestamp string (e.g. ``"2027-01-01T00:00:00Z"``).
        ethics_code:
            Ethics approval code (e.g. ``"ERC-001"``).
        organism:
            Target expression host organism (affects codon table selection in
            future versions; currently uses the universal NCBI genetic code).
        rng_seed:
            Seed for the PRNG that fills carrier positions beyond the codeword.

        Returns
        -------
        WatermarkResult
            Contains ``dna_sequence``, ``signature_hex``, ``config``,
            ``anchor_map``, and ``codon_bias_metrics``.
        """
        if self._signing_key is None:
            raise RuntimeError(
                "encode_v1() requires signing_key; "
                "pass signing_key= at construction time"
            )
        protein = protein.upper().strip()
        capacity = watermark_capacity(protein)
        tier = select_tier(capacity)
        if tier == WatermarkTier.REJECTED:
            raise ValueError(
                f"Protein has insufficient carrier capacity ({capacity} bits) "
                f"for watermarking (minimum {TIER_SPECS_MIN} bits required)"
            )

        sig_bytes = TIER_SIG_BYTES[tier]
        rs_params = TIER_RS_PARAMS[tier]

        # Step 1: derive signature
        signature = _derive_signature(
            self._signing_key, owner_id, timestamp_str, ethics_code, sig_bytes
        )

        # Step 2: apply Reed-Solomon (if tier != DEMO)
        if rs_params is not None:
            rs_n, rs_k = rs_params
            codec = RSCodec(nsym=rs_n - rs_k)
            codeword_bytes = codec.encode(signature)
        else:
            codeword_bytes = signature

        # Step 3: convert codeword to bits
        codeword_bits = np.unpackbits(np.frombuffer(codeword_bytes, dtype=np.uint8))

        # Step 4: spread the codeword bits
        label = (owner_id + "|" + timestamp_str).encode("utf-8")
        spread_bits = self._spreading_gen.spread(codeword_bits, label)

        # Step 5: embed into codons
        dna = _embed_bits(protein, spread_bits, rng_seed=rng_seed)

        # Step 6: compute anchor map and codon bias metrics
        anchor_map = _build_anchor_map(protein)
        bias_metrics = _codon_bias_metrics(dna, protein)

        # Step 7: build config
        config = WatermarkConfig(
            watermark_id=f"{owner_id}|{timestamp_str}",
            tier=tier,
            sig_bytes=sig_bytes,
            spreading_key_id=self._key_id,
            codeword_length=len(codeword_bits),
            rs_n=rs_params[0] if rs_params else None,
            rs_k=rs_params[1] if rs_params else None,
        )

        return WatermarkResult(
            original_protein=protein,
            dna_sequence=dna,
            watermark_id=config.watermark_id,
            config=config,
            anchor_map=anchor_map,
            codon_bias_metrics=bias_metrics,
            signature_hex=signature.hex(),
            carrier_positions=capacity,
        )

    def encode(self, protein: str, *args: object, **kwargs: object) -> object:
        """Dispatch to encode_v1 (new API) or encode_legacy (old API).

        When ``signing_key`` was provided at construction, calls ``encode_v1``.
        Otherwise, calls ``encode_legacy(protein, watermark_id)`` for backward
        compatibility with existing code that uses the v0.x interface.
        """
        if self._signing_key is not None:
            return self.encode_v1(protein, *args, **kwargs)  # type: ignore[arg-type]
        # Legacy: encode(protein, watermark_id)
        if args:
            watermark_id = str(args[0])
        elif "watermark_id" in kwargs:
            watermark_id = str(kwargs["watermark_id"])
        else:
            raise TypeError("encode() missing required argument: 'watermark_id'")
        return self.encode_legacy(protein, watermark_id)

    # ------------------------------------------------------------------
    # Legacy v0.x API
    # ------------------------------------------------------------------

    def encode_legacy(self, protein: str, watermark_id: str) -> EncodeResult:
        """Watermark *protein* under *watermark_id* (legacy v0.x interface).

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
        from tinsel.watermark.encoder import encode as _encode_fn

        protein = protein.upper().strip()
        dna = _encode_fn(protein, self._spreading_key, watermark_id)
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
        """SHA3-256 hex digest of the protein sequence."""
        return hashlib.sha3_256(protein.upper().encode()).hexdigest()


# ---------------------------------------------------------------------------
# Convenience function for capacity checking without an encoder instance
# ---------------------------------------------------------------------------

def check_capacity(protein: str) -> CapacityReport:
    """Return the capacity report for *protein* without an encoder instance.

    Parameters
    ----------
    protein:
        Single-letter amino-acid sequence (upper-case, no gaps).

    Returns
    -------
    CapacityReport
    """
    protein = protein.upper().strip()
    capacity = watermark_capacity(protein)
    tier = select_tier(capacity)
    sig_bytes = TIER_SIG_BYTES.get(tier, 0)
    reason = None
    if tier == WatermarkTier.REJECTED:
        reason = (
            f"Sequence has only {capacity} carrier bits "
            f"(minimum {TIER_SIG_BYTES[WatermarkTier.DEMO] * 8} required)"
        )
    return CapacityReport(
        tier=tier,
        sig_bits=sig_bytes * 8,
        capacity_ok=tier != WatermarkTier.REJECTED,
        n_carrier_positions=capacity,
        rejection_reason=reason,
    )


# Fix the missing reference in encode_v1
TIER_SPECS_MIN = TIER_SIG_BYTES[WatermarkTier.DEMO] * 8
