"""tinsel-core: bioinformatics sequence watermarking primitives.

TINSEL (Traceable Identification of Novel Synthetic bio-Engineering by
codon-Level watermarking) is a cryptographic watermarking library for
protein-coding DNA sequences.  It embeds a short, unforgeable signature
into synonymous codon choices, providing forensic traceability without
altering the protein product.

Public API
----------
Encoding:
    TINSELEncoder     — main encoder class (new v1.0 and legacy v0.x API)
    check_capacity    — capacity check without an encoder instance

Decoding:
    TINSELDecoder     — verify a watermark from a DNA sequence

Data models:
    WatermarkResult   — output of TINSELEncoder.encode_v1()
    WatermarkConfig   — configuration snapshot for the decoder
    AnchorMap         — positional carrier mapping
    VerificationResult — output of TINSELDecoder.verify()
    CapacityReport    — output of check_capacity() / TINSELEncoder.check_capacity()
    CodonBiasMetrics  — chi-squared and covertness statistics

Codecs:
    RSCodec           — systematic Reed-Solomon codec over GF(2^8)
    SpreadingCodeGenerator — HMAC counter-mode spreading code

Registry models (legacy):
    WatermarkTier     — tier enumeration (FULL, STANDARD, REDUCED, MINIMAL, DEMO, REJECTED)
    HostOrganism      — target expression host organism
    EncodeResult      — legacy encode output (v0.x)
    HybridCertificate — full certificate model

Quick start
-----------
>>> import os
>>> from tinsel import TINSELEncoder, TINSELDecoder, check_capacity
>>>
>>> spreading_key = os.urandom(32)
>>> signing_key   = os.urandom(32)
>>> protein = "MAEGTFTSDVSSYLEGQAAKEFIAWLVKGRCEGVLGDTFR" * 4
>>>
>>> cap = check_capacity(protein)
>>> print(cap.tier, cap.n_carrier_positions)
>>>
>>> enc = TINSELEncoder(spreading_key, signing_key=signing_key)
>>> result = enc.encode_v1(protein, "OWNER_A", "2027-01-01T00:00:00Z", "ERC-001")
>>>
>>> dec = TINSELDecoder(spreading_key)
>>> vr = dec.verify(result.dna_sequence, result.signature_hex,
...                 result.config, result.anchor_map, protein=protein)
>>> assert vr.verified

See Also
--------
- SECURITY.md — vulnerability reporting and security design notes
- README.md    — comprehensive usage guide
"""

from __future__ import annotations

__version__ = "1.0.0"
__author__ = "ArtGene Research Platform"
__license__ = "MIT"

# ---------------------------------------------------------------------------
# Codec primitives
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------
from tinsel.registry import (
    MINIMUM_CARRIERS_ABSOLUTE,
    TIER_RS_PARAMS,
    TIER_SIG_BYTES,
    TIER_SPECS,
    AnchorMap,
    CapacityReport,
    CertificateStatus,
    CodonBiasMetrics,
    # Legacy models (v0.x)
    EncodeResult,
    HostOrganism,
    HybridCertificate,
    LWECommitmentData,
    VerificationResult,
    # New v1.0 models
    WatermarkConfig,
    WatermarkResult,
    # Registry enums / tier system
    WatermarkTier,
    WOTSPublicKey,
    WOTSSignature,
    select_tier,
)
from tinsel.watermark.decoder import TINSELDecoder

# ---------------------------------------------------------------------------
# Sequence utilities
# ---------------------------------------------------------------------------
from tinsel.watermark.encoder import (
    CODON_POOLS,
    decode_protein,
    watermark_capacity,
)
from tinsel.watermark.encoder import (
    encode as encode_dna,
)
from tinsel.watermark.rs_codec import ReedSolomonError, RSCodec
from tinsel.watermark.spreading import SpreadingCodeGenerator

# ---------------------------------------------------------------------------
# Core encoder / decoder
# ---------------------------------------------------------------------------
from tinsel.watermark.tinsel_encoder import TINSELEncoder, check_capacity

# ---------------------------------------------------------------------------
# __all__ — defines the stable public surface
# ---------------------------------------------------------------------------

__all__ = [
    # Version
    "__version__",
    "__author__",
    "__license__",
    # Main API
    "TINSELEncoder",
    "TINSELDecoder",
    "check_capacity",
    # Codec primitives
    "RSCodec",
    "ReedSolomonError",
    "SpreadingCodeGenerator",
    # v1.0 models
    "WatermarkConfig",
    "AnchorMap",
    "CodonBiasMetrics",
    "WatermarkResult",
    "VerificationResult",
    "CapacityReport",
    # Registry types
    "WatermarkTier",
    "HostOrganism",
    "CertificateStatus",
    "TIER_SPECS",
    "TIER_RS_PARAMS",
    "TIER_SIG_BYTES",
    "MINIMUM_CARRIERS_ABSOLUTE",
    "select_tier",
    # Legacy
    "EncodeResult",
    "HybridCertificate",
    "WOTSPublicKey",
    "WOTSSignature",
    "LWECommitmentData",
    # Sequence utilities
    "CODON_POOLS",
    "encode_dna",
    "decode_protein",
    "watermark_capacity",
]
