"""Tests for HybridCertificate.compute_hash and its scheme versioning.

The certificate hash is what the W-OTS+ signature signs and what the audit log
chains, so an ambiguity in it is an integrity weakness in everything built on
top. The original scheme joined field values with no delimiter and no keys,
which made field boundaries ambiguous and the digest sensitive to dict order.

These tests demonstrate the defect rather than describe it, so the v1 collision
stays visible and the v2 fix cannot regress unnoticed.
"""

from __future__ import annotations

import pytest
from tinsel.registry import (
    CERT_HASH_SCHEME_DEFAULT,
    CERT_HASH_SCHEME_V1,
    CERT_HASH_SCHEME_V2,
    HybridCertificate,
)

# The field set routes/register.py builds, with fixed values so the digest is
# reproducible.
VECTOR_FIELDS = {
    "registry_id": "AG-2026-000001",
    "owner_id": "OWNER_A",
    "org_id": "00000000-0000-0000-0000-000000000001",
    "ethics_code": "ERC-001",
    "sequence_hash": "a" * 64,
    "timestamp": "2026-01-01T00:00:00+00:00",
}

# Pinned so a change to the canonicalisation fails loudly instead of silently
# invalidating every certificate already issued.
VECTOR_V2_DIGEST = (
    "2d08df7f83a8a496ff23da70e8c3e8c08f0ae2044f4dc352518669cea9201ee4"
    "86b8f8dc4b2b5ce6067db44cb5b5d448ebb2385271f0bc4c6060212273ce43cc"
)


class TestFieldBoundaryAmbiguity:
    """Two different field sets must never produce the same digest."""

    # Same concatenation, different fields: "ab"+"c" and "a"+"bc" are both "abc".
    AMBIGUOUS_A = {"owner_id": "ab", "ethics_code": "c"}
    AMBIGUOUS_B = {"owner_id": "a", "ethics_code": "bc"}

    def test_v1_collides_across_field_boundaries(self) -> None:
        """The defect, kept as a test so the reason for v2 stays legible."""
        assert HybridCertificate.compute_hash(
            self.AMBIGUOUS_A, CERT_HASH_SCHEME_V1
        ) == HybridCertificate.compute_hash(self.AMBIGUOUS_B, CERT_HASH_SCHEME_V1)

    def test_v2_distinguishes_them(self) -> None:
        assert HybridCertificate.compute_hash(
            self.AMBIGUOUS_A
        ) != HybridCertificate.compute_hash(self.AMBIGUOUS_B)


class TestCanonicalisation:
    def test_v2_is_independent_of_key_order(self) -> None:
        assert HybridCertificate.compute_hash(
            {"a": "1", "b": "2"}
        ) == HybridCertificate.compute_hash({"b": "2", "a": "1"})

    def test_v1_was_not(self) -> None:
        assert HybridCertificate.compute_hash(
            {"a": "1", "b": "2"}, CERT_HASH_SCHEME_V1
        ) != HybridCertificate.compute_hash(
            {"b": "2", "a": "1"}, CERT_HASH_SCHEME_V1
        )

    def test_schemes_are_domain_separated(self) -> None:
        """The same fields must not hash alike under two schemes."""
        assert HybridCertificate.compute_hash(
            VECTOR_FIELDS, CERT_HASH_SCHEME_V2
        ) != HybridCertificate.compute_hash(VECTOR_FIELDS, CERT_HASH_SCHEME_V1)

    def test_stringified_and_native_values_agree(self) -> None:
        """A caller passing an int and one passing its str must agree."""
        assert HybridCertificate.compute_hash(
            {"n": 42}
        ) == HybridCertificate.compute_hash({"n": "42"})


class TestSchemeHandling:
    def test_default_is_v2(self) -> None:
        assert CERT_HASH_SCHEME_DEFAULT == CERT_HASH_SCHEME_V2

    def test_default_matches_the_pinned_vector(self) -> None:
        assert HybridCertificate.compute_hash(VECTOR_FIELDS) == VECTOR_V2_DIGEST

    def test_digest_is_sha3_512_length(self) -> None:
        assert len(HybridCertificate.compute_hash(VECTOR_FIELDS)) == 128

    def test_unknown_scheme_is_rejected(self) -> None:
        with pytest.raises(ValueError, match="Unknown certificate hash scheme"):
            HybridCertificate.compute_hash(VECTOR_FIELDS, "sha1-lol")
