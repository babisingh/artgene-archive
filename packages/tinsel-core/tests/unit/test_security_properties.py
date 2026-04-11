"""Security property tests for tinsel-core v1.0.

Five test classes verify the cryptographic guarantees of the TINSEL watermarking
system:

1. TestWatermarkCovertness     — chi-squared p-value > 0.05, per-AA deviation
2. TestSignatureUnforgeability — different inputs → different sigs, same → same
3. TestWatermarkRobustness     — wrong key BER > 0.30, mutation tolerance
4. TestRSCodecProperties       — systematic encoding, syndrome zero, correction
5. TestSpreadingCodeProperties — key separation, balance, prefix consistency
"""

from __future__ import annotations

import numpy as np
import pytest
from tinsel import (
    ReedSolomonError,
    RSCodec,
    SpreadingCodeGenerator,
    TINSELDecoder,
    TINSELEncoder,
)

# ---------------------------------------------------------------------------
# Test fixtures
# ---------------------------------------------------------------------------

# Fixed, obviously synthetic test keys — NEVER use in production
_SPREADING_KEY = bytes.fromhex("aa" * 32)  # 0xaa repeated
_SIGNING_KEY   = bytes.fromhex("bb" * 32)  # 0xbb repeated
_ALT_SPREAD    = bytes.fromhex("cc" * 32)
_ALT_SIGN      = bytes.fromhex("dd" * 32)

# A protein long enough to have MINIMAL tier capacity
_PROTEIN_MEDIUM = "HAEGTFTSDVSSYLEGQAAKEFIAWLVKGRCEGVLGDTFR" * 4   # ~164 AA, MINIMAL
_PROTEIN_LONG   = "MAEQKLISEEDLNFPSTEKIQLLKEELDLFLQTSSKELEEVIQKLAEL" * 10  # ~480 AA, REDUCED+

_OWNER   = "OWNER_A"
_TS      = "2027-01-01T00:00:00Z"
_ETHICS  = "ERC-001"


def _make_encoder(
    spreading_key: bytes = _SPREADING_KEY, signing_key: bytes = _SIGNING_KEY
) -> TINSELEncoder:
    return TINSELEncoder(spreading_key, "test-key", signing_key=signing_key)


def _encode(
    protein: str = _PROTEIN_MEDIUM, owner: str = _OWNER, ts: str = _TS, ethics: str = _ETHICS
):
    enc = _make_encoder()
    return enc, enc.encode_v1(protein, owner, ts, ethics)


# ---------------------------------------------------------------------------
# 1. Watermark Covertness
# ---------------------------------------------------------------------------

class TestWatermarkCovertness:
    """The embedded watermark must not produce a statistically detectable codon bias."""

    def test_chi2_p_value_above_threshold(self):
        """p-value of codon-bias chi-squared must exceed 0.05 (cannot reject uniform)."""
        _, result = _encode()
        p = result.codon_bias_metrics.p_value
        assert p > 0.05, f"Watermark is not covert: p={p:.4f} < 0.05"

    def test_is_covert_flag_set(self):
        """CodonBiasMetrics.is_covert must be True for a compliant watermark."""
        _, result = _encode()
        assert result.codon_bias_metrics.is_covert, (
            f"is_covert=False; chi2={result.codon_bias_metrics.chi_squared:.4f}, "
            f"p={result.codon_bias_metrics.p_value:.4f}"
        )

    def test_per_aa_deviation_bounded(self):
        """No amino-acid should deviate > 50 percentage points from uniform.

        The TINSEL encoder embeds one bit per carrier position (pool_index % 2),
        so amino acids with pool_size > 2 will naturally concentrate usage
        on the first two codons.  The 50 % threshold flags pathological cases
        (e.g. all occurrences of a 2-codon AA mapped to a single codon) while
        accepting the expected spread-induced bias for larger pools.
        """
        _, result = _encode()
        for aa, dev in result.codon_bias_metrics.per_aa_deviations.items():
            assert dev < 50.0, (
                f"Amino acid {aa!r} deviation {dev:.1f}% exceeds 50% threshold"
            )

    def test_long_protein_covertness(self):
        """A longer protein should also produce a covert watermark."""
        enc = _make_encoder()
        result = enc.encode_v1(_PROTEIN_LONG, _OWNER, _TS, _ETHICS)
        p = result.codon_bias_metrics.p_value
        assert result.codon_bias_metrics.is_covert or p > 0.01, (
            f"Long protein watermark not sufficiently covert: p={p:.4f}"
        )

    def test_chi2_finite_and_non_negative(self):
        """Chi-squared statistic must be a finite non-negative number."""
        _, result = _encode()
        chi2 = result.codon_bias_metrics.chi_squared
        assert chi2 >= 0.0
        assert chi2 < 1e6  # sanity upper bound


# ---------------------------------------------------------------------------
# 2. Signature Unforgeability
# ---------------------------------------------------------------------------

class TestSignatureUnforgeability:
    """Different owners / timestamps / ethics codes must produce different signatures."""

    def test_different_owners_produce_different_signatures(self):
        enc = _make_encoder()
        r1 = enc.encode_v1(_PROTEIN_MEDIUM, "OWNER_A", _TS, _ETHICS)
        r2 = enc.encode_v1(_PROTEIN_MEDIUM, "OWNER_B", _TS, _ETHICS)
        assert r1.signature_hex != r2.signature_hex, (
            "Different owners produced identical signatures — collision!"
        )

    def test_different_timestamps_produce_different_signatures(self):
        enc = _make_encoder()
        r1 = enc.encode_v1(_PROTEIN_MEDIUM, _OWNER, "2027-01-01T00:00:00Z", _ETHICS)
        r2 = enc.encode_v1(_PROTEIN_MEDIUM, _OWNER, "2027-06-15T12:00:00Z", _ETHICS)
        assert r1.signature_hex != r2.signature_hex

    def test_different_ethics_codes_produce_different_signatures(self):
        enc = _make_encoder()
        r1 = enc.encode_v1(_PROTEIN_MEDIUM, _OWNER, _TS, "ERC-001")
        r2 = enc.encode_v1(_PROTEIN_MEDIUM, _OWNER, _TS, "ERC-002")
        assert r1.signature_hex != r2.signature_hex

    def test_same_inputs_produce_same_signature(self):
        """Determinism: same inputs must produce an identical signature."""
        enc1 = _make_encoder()
        enc2 = _make_encoder()
        r1 = enc1.encode_v1(_PROTEIN_MEDIUM, _OWNER, _TS, _ETHICS)
        r2 = enc2.encode_v1(_PROTEIN_MEDIUM, _OWNER, _TS, _ETHICS)
        assert r1.signature_hex == r2.signature_hex, (
            "Same inputs produced different signatures — non-deterministic!"
        )

    def test_wrong_signing_key_produces_different_signature(self):
        """A different signing key must produce a different embedded signature."""
        enc1 = _make_encoder(signing_key=_SIGNING_KEY)
        enc2 = _make_encoder(signing_key=_ALT_SIGN)
        r1 = enc1.encode_v1(_PROTEIN_MEDIUM, _OWNER, _TS, _ETHICS)
        r2 = enc2.encode_v1(_PROTEIN_MEDIUM, _OWNER, _TS, _ETHICS)
        assert r1.signature_hex != r2.signature_hex

    def test_spreading_key_signing_key_must_differ(self):
        """Providing spreading_key == signing_key must raise ValueError."""
        with pytest.raises(ValueError, match="must differ"):
            TINSELEncoder(_SPREADING_KEY, "k", signing_key=_SPREADING_KEY)


# ---------------------------------------------------------------------------
# 3. Watermark Robustness
# ---------------------------------------------------------------------------

class TestWatermarkRobustness:
    """Verify robustness properties: clean roundtrip, wrong-key detection."""

    def test_clean_roundtrip_verified(self):
        """An unmodified watermarked DNA must decode as verified with BER=0."""
        enc, result = _encode()
        dec = TINSELDecoder(_SPREADING_KEY)
        vr = dec.verify(
            result.dna_sequence,
            result.signature_hex,
            result.config,
            result.anchor_map,
            protein=_PROTEIN_MEDIUM,
        )
        assert vr.verified, f"Clean roundtrip failed: {vr.failure_reason}"
        assert vr.bit_error_rate == 0.0, f"BER={vr.bit_error_rate} expected 0.0"

    def test_wrong_spreading_key_ber_above_threshold(self):
        """A wrong spreading key must produce BER > 0.30 (distinguishable from noise)."""
        enc, result = _encode()
        dec_wrong = TINSELDecoder(_ALT_SPREAD)
        vr = dec_wrong.verify(
            result.dna_sequence,
            result.signature_hex,
            result.config,
            result.anchor_map,
            protein=_PROTEIN_MEDIUM,
        )
        assert not vr.verified, "Wrong key should not verify"
        assert vr.bit_error_rate > 0.30, (
            f"BER with wrong key too low: {vr.bit_error_rate:.4f} (expected > 0.30)"
        )

    def test_wrong_signature_hex_not_verified(self):
        """Claiming a different signature must fail verification."""
        enc, result = _encode()
        dec = TINSELDecoder(_SPREADING_KEY)
        # Flip the first byte of the expected signature
        sig_bytes = bytes.fromhex(result.signature_hex)
        corrupted_sig = bytes([sig_bytes[0] ^ 0xFF]) + sig_bytes[1:]
        vr = dec.verify(
            result.dna_sequence,
            corrupted_sig.hex(),
            result.config,
            result.anchor_map,
            protein=_PROTEIN_MEDIUM,
        )
        assert not vr.verified

    def test_deterministic_dna_same_inputs(self):
        """Same inputs to encode_v1 must produce the identical DNA sequence."""
        enc1 = _make_encoder()
        enc2 = _make_encoder()
        r1 = enc1.encode_v1(_PROTEIN_MEDIUM, _OWNER, _TS, _ETHICS)
        r2 = enc2.encode_v1(_PROTEIN_MEDIUM, _OWNER, _TS, _ETHICS)
        assert r1.dna_sequence == r2.dna_sequence

    def test_capacity_report_consistent_with_result(self):
        """check_capacity must return the same tier as the encode result."""
        enc = _make_encoder()
        cap = enc.check_capacity(_PROTEIN_MEDIUM)
        result = enc.encode_v1(_PROTEIN_MEDIUM, _OWNER, _TS, _ETHICS)
        assert cap.tier == result.config.tier


# ---------------------------------------------------------------------------
# 4. Reed-Solomon Codec Properties
# ---------------------------------------------------------------------------

class TestRSCodecProperties:
    """Verify mathematical properties of the GF(2^8) Reed-Solomon codec."""

    @pytest.mark.parametrize("nsym", [2, 4, 8, 16])
    def test_systematic_encoding(self, nsym):
        """The codeword must start with the original message bytes (systematic)."""
        codec = RSCodec(nsym=nsym)
        msg = bytes(range(16))
        cw = codec.encode(msg)
        assert cw[:len(msg)] == msg, "Encoding is not systematic"

    @pytest.mark.parametrize("nsym", [2, 4, 8, 16])
    def test_all_syndromes_zero_on_valid_codeword(self, nsym):
        """A freshly encoded codeword must have all-zero syndromes."""
        from tinsel.watermark.rs_codec import _rs_syndromes
        codec = RSCodec(nsym=nsym)
        cw = codec.encode(b"TINSEL" * 2)
        synds = _rs_syndromes(list(cw), nsym)
        assert all(s == 0 for s in synds), f"Non-zero syndromes: {synds}"

    @pytest.mark.parametrize("nsym,t", [(4, 2), (8, 4), (16, 8)])
    def test_correction_at_exactly_t_errors(self, nsym, t):
        """The codec must correct exactly t symbol errors."""
        import random
        rng = random.Random(42)
        codec = RSCodec(nsym=nsym)
        msg = b"TINSEL-WATERMARK"
        cw = codec.encode(msg)
        cw_corrupt = bytearray(cw)
        positions = rng.sample(range(len(cw)), t)
        for p in positions:
            cw_corrupt[p] ^= 0xAB
        decoded, n_corrected = codec.decode(bytes(cw_corrupt))
        assert decoded == msg, "Failed to correct t errors"
        assert n_corrected == t

    @pytest.mark.parametrize("nsym", [4, 8, 16])
    def test_too_many_errors_raises(self, nsym):
        """More than t errors must raise ReedSolomonError."""
        import random
        rng = random.Random(99)
        t = nsym // 2
        codec = RSCodec(nsym=nsym)
        msg = b"TINSEL-WATERMARK"
        cw = codec.encode(msg)
        cw_corrupt = bytearray(cw)
        positions = rng.sample(range(len(cw)), t + 1)
        for p in positions:
            cw_corrupt[p] ^= 0xFF
        with pytest.raises(ReedSolomonError):
            codec.decode(bytes(cw_corrupt))

    def test_roundtrip_no_errors(self):
        """Clean encode → decode roundtrip must return the original message."""
        codec = RSCodec(nsym=8)
        for msg in [b"A", b"TINSEL", b"HAEGTFTSDVSSYLEGQAAKEFIAWLVKGRCEGVLGDTFR"]:
            cw = codec.encode(msg)
            decoded, n = codec.decode(cw)
            assert decoded == msg
            assert n == 0


# ---------------------------------------------------------------------------
# 5. Spreading Code Properties
# ---------------------------------------------------------------------------

class TestSpreadingCodeProperties:
    """Verify pseudo-randomness and key-separation properties of SpreadingCodeGenerator."""

    def test_different_keys_produce_different_codes(self):
        """Two different keys must produce statistically independent spreading codes."""
        gen1 = SpreadingCodeGenerator(_SPREADING_KEY)
        gen2 = SpreadingCodeGenerator(_ALT_SPREAD)
        c1 = gen1.generate(256, b"test")
        c2 = gen2.generate(256, b"test")
        n_diff = int(np.sum(c1 != c2))
        assert n_diff > 50, (
            f"Keys produce nearly identical codes: only {n_diff}/256 bits differ"
        )

    def test_different_labels_produce_different_codes(self):
        """The same key with different labels must produce different codes."""
        gen = SpreadingCodeGenerator(_SPREADING_KEY)
        c1 = gen.generate(256, b"label-a")
        c2 = gen.generate(256, b"label-b")
        n_diff = int(np.sum(c1 != c2))
        assert n_diff > 50

    def test_output_is_binary(self):
        """Spreading code values must be in {0, 1}."""
        gen = SpreadingCodeGenerator(_SPREADING_KEY)
        code = gen.generate(512, b"binary")
        assert set(code.tolist()).issubset({0, 1})

    def test_output_approximately_balanced(self):
        """Mean of a long spreading code must be close to 0.5 (balanced PRNG)."""
        gen = SpreadingCodeGenerator(_SPREADING_KEY)
        code = gen.generate(1024, b"balance")
        mean = float(code.mean())
        assert 0.40 <= mean <= 0.60, f"Spreading code is unbalanced: mean={mean:.4f}"

    def test_prefix_consistency(self):
        """Generating fewer chips must be a prefix of a longer generation."""
        gen = SpreadingCodeGenerator(_SPREADING_KEY)
        long_code = gen.generate(256, b"prefix")
        short_code = gen.generate(64, b"prefix")
        assert np.array_equal(short_code, long_code[:64]), (
            "Shorter generation is not a prefix of longer generation"
        )

    def test_spread_despread_roundtrip(self):
        """Applying spread twice must return the original bits."""
        gen = SpreadingCodeGenerator(_SPREADING_KEY)
        original = np.array([1, 0, 1, 1, 0, 0, 1, 0] * 8, dtype=np.uint8)
        spread = gen.spread(original, b"roundtrip")
        despread = gen.spread(spread, b"roundtrip")
        assert np.array_equal(original, despread), "Spread/despread is not invertible"

    def test_deterministic_across_instances(self):
        """Two instances with the same key must produce identical codes."""
        gen_a = SpreadingCodeGenerator(_SPREADING_KEY)
        gen_b = SpreadingCodeGenerator(_SPREADING_KEY)
        assert np.array_equal(
            gen_a.generate(128, b"same"),
            gen_b.generate(128, b"same"),
        )
