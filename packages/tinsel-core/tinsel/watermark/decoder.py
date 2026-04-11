"""TINSELDecoder — watermark verification via de-spreading and RS decoding.

The decoder reconstructs the embedded signature from a DNA sequence without
knowledge of the original protein (given the anchor map) or the signing key.
It reports the Bit Error Rate (BER) and whether the recovered signature
matches what we would expect from the claimed owner/timestamp.

Verification flow
-----------------
1. Extract raw codon-choice bits at each position in the AnchorMap.
2. De-spread by XOR-ing with the same spreading code used during encoding.
3. Collect the codeword_length de-spread bits.
4. RS-decode (if tier != DEMO) → candidate signature bytes.
5. Compare to the expected signature (requires signing_key).

Note: Steps 1–4 can be performed with the spreading_key alone (watermark
extraction).  Step 5 requires the signing_key and is the authentication check.

Usage
-----
>>> dec = TINSELDecoder(spreading_key=sk)
>>> result = dec.verify(dna, expected_sig_hex, config, anchor_map)
>>> result.verified, result.bit_error_rate
(True, 0.0)
"""

from __future__ import annotations

from typing import Optional

import numpy as np

from tinsel.registry import (
    AnchorMap,
    TIER_RS_PARAMS,
    VerificationResult,
    WatermarkConfig,
    WatermarkTier,
)
from tinsel.watermark.encoder import CODON_POOLS
from tinsel.watermark.rs_codec import RSCodec, ReedSolomonError
from tinsel.watermark.spreading import SpreadingCodeGenerator


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _extract_bits_from_anchor(dna: str, protein: str, anchor_map: AnchorMap) -> np.ndarray:
    """Extract the raw codon-choice bit at each anchor carrier position.

    For each position in anchor_map.carrier_indices, read the codon from *dna*
    and record (pool_index % 2) as the bit.  If the codon is unrecognised the
    bit defaults to 0.
    """
    dna = dna.upper()
    protein = protein.upper()
    bits: list[int] = []
    for pos, pool_size in zip(anchor_map.carrier_indices, anchor_map.pool_sizes):
        aa = protein[pos]
        pool = CODON_POOLS.get(aa, [])
        codon = dna[pos * 3: pos * 3 + 3]
        if codon in pool:
            bits.append(pool.index(codon) % 2)
        else:
            bits.append(0)
    return np.array(bits, dtype=np.uint8)


def _count_mutated_anchors(
    dna: str,
    original_dna: str,
    anchor_map: AnchorMap,
) -> int:
    """Count anchor positions where the codon choice changed.

    Used to detect mutations that affect the watermark.
    """
    dna = dna.upper()
    original_dna = original_dna.upper()
    changed = 0
    for pos in anchor_map.carrier_indices:
        if dna[pos * 3: pos * 3 + 3] != original_dna[pos * 3: pos * 3 + 3]:
            changed += 1
    return changed


# ---------------------------------------------------------------------------
# Public class
# ---------------------------------------------------------------------------

class TINSELDecoder:
    """Decode and verify a TINSEL watermark from a DNA sequence.

    Parameters
    ----------
    spreading_key:
        32-byte secret spreading key (same one used during encoding).
    """

    def __init__(self, spreading_key: bytes) -> None:
        if len(spreading_key) != 32:
            raise ValueError("spreading_key must be exactly 32 bytes")
        self._gen = SpreadingCodeGenerator(spreading_key)

    def extract(
        self,
        dna: str,
        protein: str,
        config: WatermarkConfig,
        anchor_map: AnchorMap,
    ) -> tuple[bytes, float]:
        """Extract the candidate signature bytes from *dna* without verification.

        Parameters
        ----------
        dna:
            Watermarked DNA sequence.
        protein:
            Original protein sequence (needed to identify codon positions).
        config:
            WatermarkConfig returned by the encoder.
        anchor_map:
            AnchorMap returned by the encoder.

        Returns
        -------
        tuple[bytes, float]
            ``(candidate_sig, ber)`` where *ber* is the raw bit error rate
            before RS decoding (measured against the spread bits prior to RS
            encoding — useful for diagnostics).
        """
        protein = protein.upper()
        dna = dna.upper()

        # Step 1: extract raw bits from anchor positions
        raw_bits = _extract_bits_from_anchor(dna, protein, anchor_map)

        # Step 2: reconstruct spreading label (same as used in encoder)
        # Label is "owner_id|timestamp_str" encoded in config.watermark_id
        label = config.watermark_id.encode("utf-8")

        # Step 3: de-spread the first codeword_length bits
        n_bits = config.codeword_length
        if len(raw_bits) < n_bits:
            n_bits = len(raw_bits)
        raw_bits = raw_bits[:n_bits]

        code = self._gen.generate(n_bits, label)
        despread = np.bitwise_xor(raw_bits, code).astype(np.uint8)

        # Convert bits to bytes
        # Pad to a multiple of 8 bits
        pad_len = (8 - (n_bits % 8)) % 8
        padded = np.concatenate([despread, np.zeros(pad_len, dtype=np.uint8)])
        codeword_bytes = bytes(np.packbits(padded))

        # Step 4: RS decode (if applicable)
        rs_params = TIER_RS_PARAMS.get(config.tier)
        if rs_params is not None:
            rs_n, rs_k = rs_params
            codec = RSCodec(nsym=rs_n - rs_k)
            try:
                sig_bytes, _ = codec.decode(codeword_bytes)
            except ReedSolomonError:
                sig_bytes = codeword_bytes[: config.sig_bytes]
        else:
            sig_bytes = codeword_bytes[: config.sig_bytes]

        # BER: fraction of bits differing from a reference de-spread (best
        # case = 0 for a perfect copy; returned as a diagnostic float)
        ber = 0.0  # without a reference we can't compute BER here; caller does it

        return sig_bytes, ber

    def verify(
        self,
        dna: str,
        expected_sig_hex: str,
        config: WatermarkConfig,
        anchor_map: AnchorMap,
        protein: Optional[str] = None,
    ) -> VerificationResult:
        """Verify that *dna* carries the expected watermark signature.

        Parameters
        ----------
        dna:
            Watermarked (or possibly mutated) DNA sequence.
        expected_sig_hex:
            Hex string of the signature returned by the encoder
            (``WatermarkResult.signature_hex``).
        config:
            WatermarkConfig from the encoder.
        anchor_map:
            AnchorMap from the encoder.
        protein:
            Optional original protein.  If omitted it is translated from
            *dna* using the CODON_POOLS reverse map.

        Returns
        -------
        VerificationResult
        """
        dna = dna.upper()
        expected_sig = bytes.fromhex(expected_sig_hex)

        # Infer protein from DNA if not provided
        if protein is None:
            from tinsel.watermark.encoder import decode_protein
            try:
                protein = decode_protein(dna)
            except ValueError as exc:
                return VerificationResult(
                    verified=False,
                    bit_error_rate=1.0,
                    anchor_positions_mutated=0,
                    bits_recovered=0,
                    tier=config.tier,
                    watermark_id=config.watermark_id,
                    failure_reason=f"DNA translation failed: {exc}",
                )

        protein = protein.upper()

        # Extract raw bits
        raw_bits = _extract_bits_from_anchor(dna, protein, anchor_map)
        label = config.watermark_id.encode("utf-8")
        n_bits = min(config.codeword_length, len(raw_bits))
        raw_bits = raw_bits[:n_bits]

        # De-spread
        code = self._gen.generate(n_bits, label)
        despread = np.bitwise_xor(raw_bits, code).astype(np.uint8)

        # Build expected codeword to compute BER
        rs_params = TIER_RS_PARAMS.get(config.tier)
        if rs_params is not None:
            rs_n, rs_k = rs_params
            codec = RSCodec(nsym=rs_n - rs_k)
            expected_cw_bytes = codec.encode(expected_sig)
        else:
            expected_cw_bytes = expected_sig

        expected_bits = np.unpackbits(np.frombuffer(expected_cw_bytes, dtype=np.uint8))
        expected_bits = expected_bits[:n_bits]

        # BER: fraction of bits that differ from the expected spread codeword BEFORE de-spreading,
        # i.e. how many despread bits differ from the expected codeword bits
        if len(expected_bits) > 0 and len(despread) > 0:
            compare_len = min(len(expected_bits), len(despread))
            ber = float(np.sum(despread[:compare_len] != expected_bits[:compare_len])) / compare_len
        else:
            ber = 1.0

        # RS decode the received despread bits
        pad_len = (8 - (n_bits % 8)) % 8
        padded = np.concatenate([despread, np.zeros(pad_len, dtype=np.uint8)])
        codeword_bytes = bytes(np.packbits(padded))

        candidate_sig: bytes
        rs_ok = True
        if rs_params is not None:
            try:
                candidate_sig, _ = codec.decode(codeword_bytes)
            except ReedSolomonError as exc:
                return VerificationResult(
                    verified=False,
                    bit_error_rate=ber,
                    anchor_positions_mutated=anchor_map.n_carriers - n_bits,
                    bits_recovered=n_bits,
                    tier=config.tier,
                    watermark_id=config.watermark_id,
                    failure_reason=f"RS decoding failed: {exc}",
                )
        else:
            candidate_sig = codeword_bytes[: config.sig_bytes]

        verified = candidate_sig == expected_sig

        return VerificationResult(
            verified=verified,
            bit_error_rate=ber,
            anchor_positions_mutated=anchor_map.n_carriers - n_bits,
            bits_recovered=n_bits,
            tier=config.tier,
            watermark_id=config.watermark_id,
            failure_reason=None if verified else "Signature mismatch",
        )


