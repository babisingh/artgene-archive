"""Registry models: tiers, certificates, and issuance constants.

This module contains the Pydantic schemas and enumerations used by the
certificate registry.  The crypto implementations (WOTS+, LWE, Merkle)
live in tinsel.crypto and are phased in; stub objects are provided here
for Phase 3 MVP.

Constants
---------
MINIMUM_CARRIERS_ABSOLUTE : int
    Sequences with fewer synonymous carrier positions than this value
    cannot carry a watermark and are REJECTED.

TIER_SPECS : dict[WatermarkTier, int]
    Minimum carrier positions required to reach each tier.

select_tier(carrier_positions) : WatermarkTier
    Classify a sequence into the appropriate watermark tier.
"""

from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Enumerations
# ---------------------------------------------------------------------------

class WatermarkTier(str, Enum):
    """Watermark quality tiers based on synonymous carrier capacity.

    FULL       >= 512 carriers — chi-squared typically < 0.08
    STANDARD   >= 256 carriers
    REDUCED    >= 128 carriers
    MINIMAL    >= 64  carriers — chi-squared 0.30-0.45 (high bias)
    REJECTED   <  64  carriers — cannot reliably embed a watermark
    """

    FULL = "FULL"
    STANDARD = "STANDARD"
    REDUCED = "REDUCED"
    MINIMAL = "MINIMAL"
    REJECTED = "REJECTED"


class CertificateStatus(str, Enum):
    CERTIFIED = "CERTIFIED"
    FAILED = "FAILED"
    PENDING = "PENDING"


class HostOrganism(str, Enum):
    HUMAN = "HUMAN"
    ECOLI = "ECOLI"
    YEAST = "YEAST"
    CHO = "CHO"
    INSECT = "INSECT"
    PLANT = "PLANT"


# ---------------------------------------------------------------------------
# Carrier capacity constants and tier selection
# ---------------------------------------------------------------------------

MINIMUM_CARRIERS_ABSOLUTE: int = 64

TIER_SPECS: Dict[WatermarkTier, int] = {
    WatermarkTier.FULL: 512,
    WatermarkTier.STANDARD: 256,
    WatermarkTier.REDUCED: 128,
    WatermarkTier.MINIMAL: MINIMUM_CARRIERS_ABSOLUTE,
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
    return WatermarkTier.REJECTED


# ---------------------------------------------------------------------------
# Cryptographic stub models (Phase 3 MVP — replaced by real impls in Phase 7)
# ---------------------------------------------------------------------------

class WOTSPublicKey(BaseModel):
    """W-OTS+ public key (WOTS_L=35 chains of WOTS_N=32 bytes each)."""

    chains: List[str]     # WOTS_L hex-encoded 32-byte values
    public_seed: str      # hex-encoded 32-byte seed

    @classmethod
    def stub(cls) -> "WOTSPublicKey":
        """Return a deterministic zero-value stub for Phase 3 MVP."""
        return cls(chains=["00" * 32] * 35, public_seed="00" * 32)


class WOTSSignature(BaseModel):
    """W-OTS+ one-time signature."""

    signature_chains: List[str]  # WOTS_L hex-encoded 32-byte values
    public_seed: str
    message_hash: str            # hex-encoded SHA3-256 of signed material

    @classmethod
    def stub(cls, message_hash: str = "00" * 32) -> "WOTSSignature":
        return cls(
            signature_chains=["00" * 32] * 35,
            public_seed="00" * 32,
            message_hash=message_hash,
        )


class LWECommitmentData(BaseModel):
    """LWE lattice commitment (n=64, q=3329 for Phase 3 MVP)."""

    b_vector: List[int]  # length n=64
    A_seed: str          # hex-encoded seed for the public matrix A
    n_bits: int = 64

    @classmethod
    def stub(cls) -> "LWECommitmentData":
        return cls(b_vector=[0] * 64, A_seed="00" * 32, n_bits=64)


class MerkleProof(BaseModel):
    """Merkle inclusion proof for a single sequence in a pathway tree."""

    leaf_hash: str       # hex SHA3-256
    siblings: List[str]  # hex SHA3-256 values along the proof path
    path_bits: List[int] # 0 = go left, 1 = go right at each level
    root: str            # hex SHA3-256 Merkle root
    leaf_index: int


# ---------------------------------------------------------------------------
# Encode result
# ---------------------------------------------------------------------------

class EncodeResult(BaseModel):
    """Output of TINSELEncoder.encode()."""

    original_protein: str
    watermarked_dna: str
    watermark_id: str
    carrier_positions: int  # number of synonymous positions used
    chi_squared: float      # codon-usage deviation from uniform
    tier: WatermarkTier
    spreading_key_id: str


# ---------------------------------------------------------------------------
# Hybrid certificate
# ---------------------------------------------------------------------------

class HybridCertificate(BaseModel):
    """Issued TINSEL certificate binding sequence, owner, and crypto proofs."""

    registry_id: str              # AG-YYYY-NNNNNN
    owner_id: str
    org_id: str
    ethics_code: str
    host_organism: HostOrganism
    sequence_hash: str            # SHA3-256 hex of original protein
    sequence_type: str            # DNA / RNA / PROTEIN
    timestamp: datetime           # UTC issuance time
    watermark_metadata: Optional[Dict[str, Any]] = None
    wots_public_key: WOTSPublicKey
    wots_signature: WOTSSignature
    lwe_commitment: LWECommitmentData
    merkle_proof: Optional[MerkleProof] = None
    pathway_id: Optional[str] = None
    consequence_report: Dict[str, Any] = Field(default_factory=dict)
    certificate_hash: str         # SHA3-512 hex of all fields
    status: CertificateStatus
    chi_squared: Optional[float] = None
    tier: WatermarkTier

    @classmethod
    def compute_hash(cls, fields: Dict[str, Any]) -> str:
        """SHA3-512 of all certificate fields concatenated as UTF-8."""
        payload = "".join(str(v) for v in fields.values()).encode("utf-8")
        return hashlib.sha3_512(payload).hexdigest()
