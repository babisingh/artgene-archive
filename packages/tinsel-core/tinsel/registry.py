"""Registry models: tiers, certificates, and issuance constants.

This module contains the Pydantic schemas and enumerations used by the
certificate registry.  The crypto implementations (WOTS+, LWE, Merkle)
live in tinsel.crypto and are phased in; stub objects are provided here
for Phase 3 MVP.

Tier system
-----------
Watermark tiers are determined by the number of synonymous carrier
positions (watermark bit capacity) in the protein sequence:

+----------+-------------------+--------+----------+---------------------+
| Tier     | Min carriers      | Sig    | RS codec | Correctable bytes   |
+==========+===================+========+==========+=====================+
| FULL     | ≥ 1,792           | 128-b  | (32,16)  | 8                   |
+----------+-------------------+--------+----------+---------------------+
| STANDARD | ≥   896           |  64-b  | (16, 8)  | 4                   |
+----------+-------------------+--------+----------+---------------------+
| REDUCED  | ≥   320           |  32-b  | ( 8, 4)  | 2                   |
+----------+-------------------+--------+----------+---------------------+
| MINIMAL  | ≥    96           |  16-b  | ( 4, 2)  | 1                   |
+----------+-------------------+--------+----------+---------------------+
| DEMO     | ≥    24           |   8-b  | none     | 0 (no RS)           |
+----------+-------------------+--------+----------+---------------------+
| REJECTED | <    24           |  —     | —        | not embeddable      |
+----------+-------------------+--------+----------+---------------------+
"""

from __future__ import annotations

import hashlib
from datetime import datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Enumerations
# ---------------------------------------------------------------------------

class WatermarkTier(StrEnum):
    """Watermark quality tiers based on synonymous carrier bit capacity.

    FULL     >= 1792 carriers  — 128-bit signature, RS(32,16), 8-byte correction
    STANDARD >=  896 carriers  — 64-bit signature,  RS(16,8),  4-byte correction
    REDUCED  >=  320 carriers  — 32-bit signature,  RS(8,4),   2-byte correction
    MINIMAL  >=   96 carriers  — 16-bit signature,  RS(4,2),   1-byte correction
    DEMO     >=   24 carriers  — 8-bit  signature,  no RS
    REJECTED <    24 carriers  — cannot embed a watermark
    """

    FULL = "FULL"
    STANDARD = "STANDARD"
    REDUCED = "REDUCED"
    MINIMAL = "MINIMAL"
    DEMO = "DEMO"
    REJECTED = "REJECTED"


class CertificateStatus(StrEnum):
    CERTIFIED = "CERTIFIED"
    FAILED = "FAILED"
    PENDING = "PENDING"


class HostOrganism(StrEnum):
    HUMAN = "HUMAN"
    ECOLI = "ECOLI"
    YEAST = "YEAST"
    CHO = "CHO"
    INSECT = "INSECT"
    PLANT = "PLANT"


# ---------------------------------------------------------------------------
# Carrier capacity constants and tier selection
# ---------------------------------------------------------------------------

MINIMUM_CARRIERS_ABSOLUTE: int = 24

#: Minimum number of carrier bits required for each tier.
TIER_SPECS: dict[WatermarkTier, int] = {
    WatermarkTier.FULL:     1792,
    WatermarkTier.STANDARD:  896,
    WatermarkTier.REDUCED:   320,
    WatermarkTier.MINIMAL:    96,
    WatermarkTier.DEMO:       24,
}

#: RS codec parameters per tier: (n, k) where parity symbols = n - k.
TIER_RS_PARAMS: dict[WatermarkTier, tuple[int, int] | None] = {
    WatermarkTier.FULL:     (32, 16),  # 16 parity symbols, corrects 8 bytes
    WatermarkTier.STANDARD: (16,  8),  # 8  parity symbols, corrects 4 bytes
    WatermarkTier.REDUCED:  ( 8,  4),  # 4  parity symbols, corrects 2 bytes
    WatermarkTier.MINIMAL:  ( 4,  2),  # 2  parity symbols, corrects 1 byte
    WatermarkTier.DEMO:     None,      # no Reed-Solomon
    WatermarkTier.REJECTED: None,
}

#: Signature length in bytes per tier.
TIER_SIG_BYTES: dict[WatermarkTier, int] = {
    WatermarkTier.FULL:     16,   # 128-bit signature
    WatermarkTier.STANDARD:  8,   # 64-bit signature
    WatermarkTier.REDUCED:   4,   # 32-bit signature
    WatermarkTier.MINIMAL:   2,   # 16-bit signature
    WatermarkTier.DEMO:      1,   # 8-bit signature
    WatermarkTier.REJECTED:  0,
}


def select_tier(carrier_positions: int) -> WatermarkTier:
    """Return the watermark tier for *carrier_positions* synonymous positions."""
    if carrier_positions >= TIER_SPECS[WatermarkTier.FULL]:
        return WatermarkTier.FULL
    if carrier_positions >= TIER_SPECS[WatermarkTier.STANDARD]:
        return WatermarkTier.STANDARD
    if carrier_positions >= TIER_SPECS[WatermarkTier.REDUCED]:
        return WatermarkTier.REDUCED
    if carrier_positions >= TIER_SPECS[WatermarkTier.MINIMAL]:
        return WatermarkTier.MINIMAL
    if carrier_positions >= TIER_SPECS[WatermarkTier.DEMO]:
        return WatermarkTier.DEMO
    return WatermarkTier.REJECTED


# ---------------------------------------------------------------------------
# New v1.0 models
# ---------------------------------------------------------------------------

class WatermarkConfig(BaseModel):
    """Configuration snapshot used during encoding — needed for decoding.

    Both the encoder and decoder must agree on every field.
    """

    watermark_id: str
    tier: WatermarkTier
    sig_bytes: int          # length of signature embedded in the watermark
    spreading_key_id: str   # identifier of the spreading key (not the key itself)
    codeword_length: int    # total length of the RS codeword in bits (= sig_bytes if no RS)
    rs_n: int | None = None   # RS block length (None if no RS)
    rs_k: int | None = None   # RS message length (None if no RS)


class AnchorMap(BaseModel):
    """Positional mapping of carrier codons for mutation-tolerant decoding.

    Records which protein positions are synonymous carriers, allowing
    the decoder to skip positions that have been mutated out.

    Attributes
    ----------
    carrier_indices:
        Sorted list of 0-based indices into the protein sequence that are
        used as watermark carriers (pool size >= 2).
    pool_sizes:
        Corresponding pool sizes at each carrier position.
    protein_length:
        Total length of the original protein (used for bounds checking).
    """

    carrier_indices: list[int]
    pool_sizes: list[int]
    protein_length: int

    @property
    def n_carriers(self) -> int:
        return len(self.carrier_indices)


class CodonBiasMetrics(BaseModel):
    """Codon-usage statistics computed after watermarking."""

    chi_squared: float        # χ² deviation from uniform codon usage
    p_value: float            # Wilson-Hilferty approximation p-value
    is_covert: bool           # True if p_value > 0.05
    per_aa_deviations: dict[str, float] = Field(default_factory=dict)


class WatermarkResult(BaseModel):
    """Output of the new TINSELEncoder.encode() API (v1.0)."""

    original_protein: str
    dna_sequence: str
    watermark_id: str
    config: WatermarkConfig
    anchor_map: AnchorMap
    codon_bias_metrics: CodonBiasMetrics
    signature_hex: str        # hex-encoded embedded signature
    carrier_positions: int    # number of synonymous carrier positions


class VerificationResult(BaseModel):
    """Output of TINSELDecoder.verify()."""

    verified: bool
    bit_error_rate: float           # BER after de-spreading (0.0 = perfect)
    anchor_positions_mutated: int   # carrier positions that changed codon-choice
    bits_recovered: int             # bits successfully extracted
    tier: WatermarkTier
    watermark_id: str
    failure_reason: str | None = None


class CapacityReport(BaseModel):
    """Output of check_capacity()."""

    tier: WatermarkTier
    sig_bits: int             # signature bits that can be embedded
    capacity_ok: bool         # True unless REJECTED
    n_carrier_positions: int  # synonymous carrier count
    rejection_reason: str | None = None


# ---------------------------------------------------------------------------
# Cryptographic stub models (Phase 7 — NOT YET IMPLEMENTED)
#
# The .stub() factory methods on each class produce zero-filled placeholder
# values.  Certificates issued before Phase 7 ships contain these stubs and
# carry NO post-quantum cryptographic guarantee.  The HMAC-SHA3-256 codon
# watermark (TINSELEncoder) provides provenance; WOTS+ and LWE are reserved
# for the next major release.
# ---------------------------------------------------------------------------

class WOTSPublicKey(BaseModel):
    """W-OTS+ public key placeholder (Phase 7 — not yet implemented)."""

    chains: list[str]     # WOTS_L hex-encoded 32-byte values
    public_seed: str      # hex-encoded 32-byte seed

    @classmethod
    def stub(cls) -> WOTSPublicKey:
        return cls(chains=["00" * 32] * 35, public_seed="00" * 32)


class WOTSSignature(BaseModel):
    """W-OTS+ one-time signature."""

    signature_chains: list[str]  # WOTS_L hex-encoded 32-byte values
    public_seed: str
    message_hash: str            # hex-encoded SHA3-256 of signed material

    @classmethod
    def stub(cls, message_hash: str = "00" * 32) -> WOTSSignature:
        return cls(
            signature_chains=["00" * 32] * 35,
            public_seed="00" * 32,
            message_hash=message_hash,
        )


class LWECommitmentData(BaseModel):
    """LWE lattice commitment (n=64, q=3329 for Phase 3 MVP)."""

    b_vector: list[int]  # length n=64
    A_seed: str          # hex-encoded seed for the public matrix A
    n_bits: int = 64

    @classmethod
    def stub(cls) -> LWECommitmentData:
        return cls(b_vector=[0] * 64, A_seed="00" * 32, n_bits=64)


class MerkleProof(BaseModel):
    """Merkle inclusion proof for a single sequence in a pathway tree."""

    leaf_hash: str
    siblings: list[str]
    path_bits: list[int]
    root: str
    leaf_index: int


# ---------------------------------------------------------------------------
# Legacy EncodeResult (preserved for backward compatibility)
# ---------------------------------------------------------------------------

class EncodeResult(BaseModel):
    """Legacy output of TINSELEncoder.encode() — preserved for compatibility."""

    original_protein: str
    watermarked_dna: str
    watermark_id: str
    carrier_positions: int
    chi_squared: float
    tier: WatermarkTier
    spreading_key_id: str


# ---------------------------------------------------------------------------
# Hybrid certificate
# ---------------------------------------------------------------------------

class HybridCertificate(BaseModel):
    """Issued TINSEL certificate binding sequence, owner, and crypto proofs."""

    registry_id: str
    owner_id: str
    org_id: str
    ethics_code: str
    host_organism: HostOrganism
    sequence_hash: str
    sequence_type: str
    timestamp: datetime
    watermark_metadata: dict[str, Any] | None = None
    wots_public_key: WOTSPublicKey
    wots_signature: WOTSSignature
    lwe_commitment: LWECommitmentData
    merkle_proof: MerkleProof | None = None
    pathway_id: str | None = None
    consequence_report: dict[str, Any] = Field(default_factory=dict)
    certificate_hash: str
    status: CertificateStatus
    chi_squared: float | None = None
    tier: WatermarkTier

    @classmethod
    def compute_hash(cls, fields: dict[str, Any]) -> str:
        payload = "".join(str(v) for v in fields.values()).encode("utf-8")
        return hashlib.sha3_512(payload).hexdigest()
