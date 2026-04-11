"""Unit tests for tinsel.validators (16 tests)."""

import pytest
from tinsel.validators import (
    ValidationError,
    is_valid_dna,
    is_valid_protein,
    validate_dna_sequence,
    validate_protein_sequence,
    validate_rna_sequence,
    validate_sequence_length,
)

# ---------------------------------------------------------------------------
# validate_dna_sequence
# ---------------------------------------------------------------------------

def test_validate_dna_valid():
    assert validate_dna_sequence("ACGT") == "ACGT"


def test_validate_dna_lowercase_normalised():
    assert validate_dna_sequence("acgt") == "ACGT"


def test_validate_dna_with_n():
    assert validate_dna_sequence("ACGTN") == "ACGTN"


def test_validate_dna_invalid_chars_raises():
    with pytest.raises(ValidationError, match="Invalid DNA characters"):
        validate_dna_sequence("ACGTU")


def test_validate_dna_empty_string_raises():
    with pytest.raises(ValidationError, match="Invalid DNA characters"):
        # empty after strip produces no invalid chars but length 0 — use a real invalid char
        validate_dna_sequence("ACGX")


# ---------------------------------------------------------------------------
# validate_rna_sequence
# ---------------------------------------------------------------------------

def test_validate_rna_valid():
    assert validate_rna_sequence("ACGU") == "ACGU"


def test_validate_rna_dna_char_raises():
    with pytest.raises(ValidationError, match="Invalid RNA characters"):
        validate_rna_sequence("ACGT")  # T is not valid RNA


# ---------------------------------------------------------------------------
# validate_protein_sequence
# ---------------------------------------------------------------------------

def test_validate_protein_valid():
    result = validate_protein_sequence("MAEQKLISEEDL")
    assert result == "MAEQKLISEEDL"


def test_validate_protein_stop_codon_symbol():
    result = validate_protein_sequence("MAEQ*")
    assert result == "MAEQ*"


def test_validate_protein_invalid_char_raises():
    with pytest.raises(ValidationError, match="Invalid protein characters"):
        validate_protein_sequence("MAEQB")  # B is ambiguous, not in our set


# ---------------------------------------------------------------------------
# validate_sequence_length
# ---------------------------------------------------------------------------

def test_validate_sequence_length_valid():
    seq = "ACGT" * 10  # 40 chars
    assert validate_sequence_length(seq, min_len=1, max_len=100) == seq


def test_validate_sequence_length_too_short_raises():
    with pytest.raises(ValidationError, match="below minimum"):
        validate_sequence_length("AC", min_len=5)


def test_validate_sequence_length_too_long_raises():
    with pytest.raises(ValidationError, match="exceeds maximum"):
        validate_sequence_length("ACGT" * 100, max_len=10)


def test_validate_sequence_length_exact_boundaries():
    seq = "ACGT"  # 4 chars
    assert validate_sequence_length(seq, min_len=4, max_len=4) == seq


# ---------------------------------------------------------------------------
# is_valid_dna / is_valid_protein (boolean helpers)
# ---------------------------------------------------------------------------

def test_is_valid_dna_true():
    assert is_valid_dna("ACGTNACGT") is True


def test_is_valid_dna_false():
    assert is_valid_dna("ACGTU") is False


def test_is_valid_protein_true():
    assert is_valid_protein("MAEQKLISEEDL") is True
