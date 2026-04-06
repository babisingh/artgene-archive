"""FASTA parsing and sequence normalisation."""

from __future__ import annotations

from tinsel.models import SequenceType

_DNA_CHARS = frozenset("ACGTN")
_RNA_CHARS = frozenset("ACGUN")


def parse_fasta(text: str) -> tuple[str, str]:
    """Return (header, sequence) from a FASTA string.

    Handles single-record FASTA.  Leading ``>`` is stripped from header.
    Sequence lines are concatenated and uppercased.
    """
    lines = text.strip().splitlines()
    header = ""
    seq_lines: list[str] = []
    for line in lines:
        stripped = line.strip()
        if stripped.startswith(">"):
            header = stripped[1:].strip()
        elif stripped:
            seq_lines.append(stripped)
    return header, "".join(seq_lines).upper()


def detect_type(sequence: str) -> SequenceType:
    """Auto-detect sequence type from character set."""
    chars = set(sequence.upper())
    if chars <= _DNA_CHARS:
        return SequenceType.DNA
    if chars <= _RNA_CHARS:
        return SequenceType.RNA
    return SequenceType.PROTEIN


def normalise(fasta_text: str) -> tuple[str, str, SequenceType]:
    """Parse a FASTA string and return (header, sequence, SequenceType).

    Raises
    ------
    ValueError
        If the FASTA text is empty or the sequence is empty.
    """
    header, seq = parse_fasta(fasta_text)
    if not seq:
        raise ValueError("FASTA sequence is empty")
    seq_type = detect_type(seq)
    return header, seq, seq_type
