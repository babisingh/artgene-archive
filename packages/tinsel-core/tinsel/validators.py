"""Sequence validation utilities for DNA, RNA, and protein sequences."""


DNA_CHARS = frozenset("ACGTN")
RNA_CHARS = frozenset("ACGUN")
PROTEIN_CHARS = frozenset("ACDEFGHIKLMNPQRSTVWY*X")


class ValidationError(ValueError):
    """Raised when a biological sequence fails validation."""


def validate_dna_sequence(seq: str) -> str:
    """Validate and normalise a DNA sequence string. Returns uppercased sequence."""
    seq = seq.upper().strip()
    invalid = set(seq) - DNA_CHARS
    if invalid:
        raise ValidationError(f"Invalid DNA characters: {sorted(invalid)}")
    return seq


def validate_rna_sequence(seq: str) -> str:
    """Validate and normalise an RNA sequence string. Returns uppercased sequence."""
    seq = seq.upper().strip()
    invalid = set(seq) - RNA_CHARS
    if invalid:
        raise ValidationError(f"Invalid RNA characters: {sorted(invalid)}")
    return seq


def validate_protein_sequence(seq: str) -> str:
    """Validate and normalise a protein sequence string. Returns uppercased sequence."""
    seq = seq.upper().strip()
    invalid = set(seq) - PROTEIN_CHARS
    if invalid:
        raise ValidationError(f"Invalid protein characters: {sorted(invalid)}")
    return seq


def validate_sequence_length(seq: str, min_len: int = 1, max_len: int = 10_000) -> str:
    """Validate that *seq* falls within [min_len, max_len]. Returns seq unchanged."""
    if len(seq) < min_len:
        raise ValidationError(
            f"Sequence length {len(seq)} is below minimum {min_len}"
        )
    if len(seq) > max_len:
        raise ValidationError(
            f"Sequence length {len(seq)} exceeds maximum {max_len}"
        )
    return seq


def is_valid_dna(seq: str) -> bool:
    """Return True if *seq* is a valid DNA sequence, False otherwise."""
    try:
        validate_dna_sequence(seq)
        return True
    except ValidationError:
        return False


def is_valid_protein(seq: str) -> bool:
    """Return True if *seq* is a valid protein sequence, False otherwise."""
    try:
        validate_protein_sequence(seq)
        return True
    except ValidationError:
        return False
