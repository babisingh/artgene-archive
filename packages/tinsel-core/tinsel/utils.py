"""Bioinformatics utility functions: complement, translate, GC content, MW."""

from typing import List

import numpy as np


_COMPLEMENT_MAP = str.maketrans("ACGTNacgtn", "TGCANtgcan")

CODON_TABLE: dict[str, str] = {
    "TTT": "F", "TTC": "F", "TTA": "L", "TTG": "L",
    "CTT": "L", "CTC": "L", "CTA": "L", "CTG": "L",
    "ATT": "I", "ATC": "I", "ATA": "I", "ATG": "M",
    "GTT": "V", "GTC": "V", "GTA": "V", "GTG": "V",
    "TCT": "S", "TCC": "S", "TCA": "S", "TCG": "S",
    "CCT": "P", "CCC": "P", "CCA": "P", "CCG": "P",
    "ACT": "T", "ACC": "T", "ACA": "T", "ACG": "T",
    "GCT": "A", "GCC": "A", "GCA": "A", "GCG": "A",
    "TAT": "Y", "TAC": "Y", "TAA": "*", "TAG": "*",
    "CAT": "H", "CAC": "H", "CAA": "Q", "CAG": "Q",
    "AAT": "N", "AAC": "N", "AAA": "K", "AAG": "K",
    "GAT": "D", "GAC": "D", "GAA": "E", "GAG": "E",
    "TGT": "C", "TGC": "C", "TGA": "*", "TGG": "W",
    "CGT": "R", "CGC": "R", "CGA": "R", "CGG": "R",
    "AGT": "S", "AGC": "S", "AGA": "R", "AGG": "R",
    "GGT": "G", "GGC": "G", "GGA": "G", "GGG": "G",
}

# Monoisotopic residue masses (Da), water not included per residue
AA_MONOISOTOPIC_MASS: dict[str, float] = {
    "A": 71.03711,  "R": 156.10111, "N": 114.04293, "D": 115.02694,
    "C": 103.00919, "E": 129.04259, "Q": 128.05858, "G": 57.02146,
    "H": 137.05891, "I": 113.08406, "L": 113.08406, "K": 128.09496,
    "M": 131.04049, "F": 147.06841, "P": 97.05276,  "S": 87.03203,
    "T": 101.04768, "W": 186.07931, "Y": 163.06333, "V": 99.06841,
}

_WATER_MASS = 18.01056


def complement(seq: str) -> str:
    """Return the complement of a DNA sequence (preserves case)."""
    return seq.translate(_COMPLEMENT_MAP)


def reverse_complement(seq: str) -> str:
    """Return the reverse complement of a DNA sequence."""
    return complement(seq)[::-1]


def gc_content(seq: str) -> float:
    """Return the GC fraction [0, 1] of a DNA/RNA sequence."""
    seq = seq.upper()
    if not seq:
        return 0.0
    gc = sum(1 for c in seq if c in "GC")
    return gc / len(seq)


def translate(seq: str, stop_symbol: str = "*") -> str:
    """Translate a DNA sequence to a protein string using the standard codon table.

    Translation stops at the first stop codon (inclusive of *stop_symbol*).
    Incomplete trailing codons are silently ignored.
    Unknown codons are rendered as 'X'.
    """
    seq = seq.upper()
    protein: List[str] = []
    for i in range(0, len(seq) - 2, 3):
        codon = seq[i : i + 3]
        aa = CODON_TABLE.get(codon, "X")
        if aa == "*":
            protein.append(stop_symbol)
            break
        protein.append(aa)
    return "".join(protein)


def molecular_weight(protein_seq: str) -> float:
    """Return monoisotopic molecular weight (Da) of a protein sequence.

    Stop codon symbols ('*') are ignored.  Water is added once for the
    N- and C-termini of the intact chain.
    """
    protein_seq = protein_seq.upper()
    residues = [aa for aa in protein_seq if aa != "*"]
    if not residues:
        return 0.0
    mw = sum(AA_MONOISOTOPIC_MASS.get(aa, 0.0) for aa in residues)
    mw += _WATER_MASS
    return mw


def plddt_to_bfactor(plddt_scores: List[float]) -> np.ndarray:
    """Convert a list of pLDDT scores to a numpy array suitable for B-factor columns."""
    return np.array(plddt_scores, dtype=float)


def mean_plddt(plddt_scores: List[float]) -> float:
    """Return the mean pLDDT score, or 0.0 for an empty list."""
    if not plddt_scores:
        return 0.0
    return float(np.mean(plddt_scores))
